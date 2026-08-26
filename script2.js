const fileInput = document.getElementById('fileInput');
const loadExample = document.getElementById('loadExample');
const especialidadSelect = document.getElementById('especialidadSelect');
const courseSelect = document.getElementById('courseSelect');
const sectionSelect = document.getElementById('sectionSelect');
const sectionTimes = document.getElementById('sectionTimes');
const addBlock = document.getElementById('addBlock');
const schedule = document.getElementById('schedule');
const tablePreview = document.getElementById('tablePreview');
const downloadImageBtn = document.getElementById('downloadImageBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const clearBtn = document.getElementById('clearBtn');
const calendarGrid = document.getElementById('calendarGrid');
const blocksList = document.getElementById('blocksList');

let loadedRows = [];
let sectionMap = {};
let scheduleBlocks = [];
let lastWorkbook = null; // último Excel leído, para poder re-parsear si cambian de especialidad sin re-subir el archivo

/* ============================================================
   LECTURA DE EXCEL (HORARIOS_XX-X.xlsx)
   ------------------------------------------------------------
   El archivo tiene 3 hojas fijas: "s1", "s2" y "s3" (una por
   especialidad), y cada una usa un formato de columnas distinto.
   Aquí "desunimos" las celdas combinadas (para que cada fila
   tenga todos sus datos) y extraemos curso/sección/docente/
   horario/créditos/ciclo con un parser específico por hoja.
   ============================================================ */

function romanToInt(str) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  const s = (str || '').toUpperCase();
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]] || 0;
    const next = map[s[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total || null;
}

// Detecta filas que marcan el inicio de un bloque ("I CICLO", "ELECTIVOS DE ESPECIALIDAD", etc.)
function detectBlockMarker(text) {
  if (!text) return undefined;
  const t = text.toUpperCase();
  const roman = t.match(/^([IVXLC]+)\s*CICLO\b/);
  if (roman) return romanToInt(roman[1]);
  if (t.includes('ELECTIV')) return 'ELECTIVO';
  return undefined;
}

function formatCiclo(ciclo) {
  if (ciclo === 'ELECTIVO' || ciclo === 11) return 'Electivo';
  if (typeof ciclo === 'number') return String(ciclo);
  return '—';
}

// Convierte "T"/"P"/"L" (o texto completo) a nuestro tipo normalizado
function normalizeTipoClase(clase) {
  const c = (clase || '').trim().toUpperCase();
  if (c.startsWith('P')) return 'practica';
  if (c.startsWith('L')) return 'laboratorio';
  if (c.startsWith('T')) return 'teoria';
  return 'otro';
}

// Extrae todas las parejas día/hora de una celda que puede traer varias
// juntas, con o sin dos puntos: "LU: 10-12   JU: 10-12", "SA 08-10", etc.
function parseHorasCell(cell) {
  if (!cell) return [];
  const re = /([A-ZÁÉÍÓÚÑ]{2,4})\s*:?\s*(\d{1,2})\s*-\s*(\d{1,2})/gi;
  const out = [];
  let m;
  while ((m = re.exec(cell)) !== null) {
    out.push({ dia: m[1].toUpperCase(), horaIni: m[2], horaFin: m[3] });
  }
  return out;
}

function limpiarTexto(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

function dedupeRows(rows) {
  const seen = new Set();
  const out = [];
  rows.forEach(r => {
    const key = [r.codigo, r.curso, r.docente, r.seccion, r.horario, r.tipo].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(r);
  });
  return out;
}

// Rellena las celdas combinadas con el valor de su celda superior-izquierda,
// para que cada fila tenga toda su información aunque en el Excel esté fusionada.
function unmergeFillSheet(ws) {
  const merges = ws['!merges'] || [];
  merges.forEach(range => {
    const topAddr = XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c });
    const topCell = ws[topAddr];
    if (!topCell) return;
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (addr === topAddr) continue;
        ws[addr] = { ...topCell };
      }
    }
  });
}

function sheetToRows(ws) {
  unmergeFillSheet(ws);
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
}

// ---- Hoja "s1": Ingeniería Sanitaria ----
// COD.CURSO | SECC. | CURSO | CRED. | PRE-REQ. | ESPEC | CICLO | CLASE | DOCENTE | DIA | HORA
function parseSheetS1(rows) {
  const out = [];
  let cicloActual = null;
  let headerSeen = false;
  rows.forEach(row => {
    const cells = Array.from({ length: 11 }, (_, i) => limpiarTexto(row[i]));
    const joined = cells.join('');
    const marker = detectBlockMarker(cells[0]);
    if (marker !== undefined) { cicloActual = marker; headerSeen = false; return; }
    if (/^COD/i.test(cells[0])) { headerSeen = true; return; }
    if (!joined || !headerSeen) return;

    const [codigo, seccion, curso, cred, , , cicloCell, clase, docente, dia, hora] = cells;
    if (!codigo || !curso || !docente || !dia || !hora) return;

    const cicloNum = cicloCell ? (Number(cicloCell) || cicloActual) : cicloActual;
    const credNum = cred ? Number(cred) : null;

    out.push({
      codigo: codigo.replace(/-/g, '').toUpperCase(),
      curso: curso.toUpperCase(),
      docente,
      seccion,
      horario: `${dia} ${hora}`,
      tipo: normalizeTipoClase(clase),
      aula: 'sin aula',
      creditosDirectos: credNum,
      cicloDirecto: cicloNum
    });
  });
  return dedupeRows(out);
}

// ---- Hoja "s2": Higiene y Seguridad Industrial ----
// COD CUR | Sec. | CRED. | PRE-REQ. | CURSO | DOCENTE | HORA DE TEORIA | HORA DE PRACTICA
function parseSheetS2(rows) {
  const out = [];
  let cicloActual = null;
  let headerSeen = false;
  rows.forEach(row => {
    const cells = Array.from({ length: 9 }, (_, i) => limpiarTexto(row[i]));
    const joined = cells.join('');
    const marker = detectBlockMarker(cells[0]);
    if (marker !== undefined) { cicloActual = marker; headerSeen = false; return; }
    if (/^COD/i.test(cells[0])) { headerSeen = true; return; }
    if (!joined || !headerSeen) return;

    const [codigo, seccion, cred, , curso, docente, horaTeo, horaPrac] = cells;
    if (!codigo || !curso || !docente) return;
    const credNum = cred ? Number(cred) : null;

    parseHorasCell(horaTeo).forEach(s => out.push({
      codigo: codigo.replace(/-/g, '').toUpperCase(), curso: curso.toUpperCase(), docente, seccion,
      horario: `${s.dia} ${s.horaIni}-${s.horaFin}`, tipo: 'teoria', aula: 'sin aula',
      creditosDirectos: credNum, cicloDirecto: cicloActual
    }));
    parseHorasCell(horaPrac).forEach(s => out.push({
      codigo: codigo.replace(/-/g, '').toUpperCase(), curso: curso.toUpperCase(), docente, seccion,
      horario: `${s.dia} ${s.horaIni}-${s.horaFin}`, tipo: 'practica', aula: 'sin aula',
      creditosDirectos: credNum, cicloDirecto: cicloActual
    }));
  });
  return dedupeRows(out);
}

// ---- Hoja "s3": Ingeniería Ambiental ----
// COD.CUR. | Sec. | CURSO | DOCENTE | HORA DE TEORIA | HORA DE PRÁCTICA (sin créditos en el archivo)
function parseSheetS3(rows) {
  const out = [];
  let cicloActual = null;
  let headerSeen = false;
  rows.forEach(row => {
    const cells = Array.from({ length: 6 }, (_, i) => limpiarTexto(row[i]));
    const joined = cells.join('');
    const marker = detectBlockMarker(cells[0]);
    if (marker !== undefined) { cicloActual = marker; headerSeen = false; return; }
    if (/^COD/i.test(cells[0])) { headerSeen = true; return; }
    if (!joined || !headerSeen) return;

    const [codigo, seccion, curso, docente, horaTeo, horaPrac] = cells;
    if (!codigo || !curso || !docente) return;

    parseHorasCell(horaTeo).forEach(s => out.push({
      codigo: codigo.replace(/-/g, '').toUpperCase(), curso: curso.toUpperCase(), docente, seccion,
      horario: `${s.dia} ${s.horaIni}-${s.horaFin}`, tipo: 'teoria', aula: 'sin aula',
      creditosDirectos: null, cicloDirecto: cicloActual
    }));
    parseHorasCell(horaPrac).forEach(s => out.push({
      codigo: codigo.replace(/-/g, '').toUpperCase(), curso: curso.toUpperCase(), docente, seccion,
      horario: `${s.dia} ${s.horaIni}-${s.horaFin}`, tipo: 'practica', aula: 'sin aula',
      creditosDirectos: null, cicloDirecto: cicloActual
    }));
  });
  return dedupeRows(out);
}

function parseWorkbookForEspecialidad(workbook, especialidad) {
  const sheetName = workbook.SheetNames.find(n => n.toLowerCase().trim() === especialidad) || workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  if (!ws) return [];
  const rows = sheetToRows(ws);
  if (especialidad === 's2') return parseSheetS2(rows);
  if (especialidad === 's3') return parseSheetS3(rows);
  return parseSheetS1(rows);
}

let parsedBySheet = { s1: [], s2: [], s3: [] }; // filas de cada hoja, por separado
let courseSpecialties = {}; // curso -> Set('s1','s2','s3') en qué carreras aparece
let courseCiclo = {}; // curso -> { s1: ciclo, s2: ciclo, s3: ciclo }

function loadFromWorkbook() {
  if (!lastWorkbook) return;
  const especialidades = ['s1', 's2', 's3'];

  parsedBySheet = {};
  especialidades.forEach(esp => { parsedBySheet[esp] = parseWorkbookForEspecialidad(lastWorkbook, esp); });

  // Unimos las 3 hojas: cualquier sección de cualquier carrera es matriculable por cualquiera
  loadedRows = dedupeRows([].concat(parsedBySheet.s1, parsedBySheet.s2, parsedBySheet.s3));

  if (!loadedRows.length) {
    alert('No se pudo leer información de ese archivo. Revisa que tenga el mismo formato de HORARIOS_XX-X.xlsx (hojas "s1", "s2", "s3").');
    return;
  }

  // El selector de especialidad solo sirve para saber qué cursos pertenecen a cada carrera
  courseSpecialties = {};
  courseCiclo = {};
  especialidades.forEach(esp => {
    parsedBySheet[esp].forEach(r => {
      if (!courseSpecialties[r.curso]) courseSpecialties[r.curso] = new Set();
      courseSpecialties[r.curso].add(esp);
      if (!courseCiclo[r.curso]) courseCiclo[r.curso] = {};
      if (courseCiclo[r.curso][esp] == null && r.cicloDirecto != null) courseCiclo[r.curso][esp] = r.cicloDirecto;
    });
  });

  // sectionMap se arma con TODAS las secciones juntas (de las 3 carreras)
  buildSectionMap(loadedRows);
  updateCourseSelect();
  renderPreview();
  scheduleBlocks = [];
  renderSchedule();
  renderCalendar();
  persistAutosave();
}

async function handleExcelFile(file) {
  const buffer = await file.arrayBuffer();
  lastWorkbook = XLSX.read(buffer, { type: 'array' });
  loadFromWorkbook();
}

// Busca los créditos y el ciclo de un curso en el catálogo de la malla curricular,
// primero por código y si no lo encuentra, por coincidencia de nombre.
function lookupCourseInfo(codigo, curso) {
  if (codigo && typeof COURSE_CATALOG !== 'undefined' && COURSE_CATALOG[codigo]) {
    const c = COURSE_CATALOG[codigo];
    return { creditos: c.creditos, ciclo: c.ciclo };
  }
  if (typeof COURSE_CATALOG !== 'undefined' && curso) {
    const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    const target = normalize(curso);
    for (const code in COURSE_CATALOG) {
      if (normalize(COURSE_CATALOG[code].nombre) === target) {
        return { creditos: COURSE_CATALOG[code].creditos, ciclo: COURSE_CATALOG[code].ciclo };
      }
    }
  }
  return { creditos: null, ciclo: null };
}

function buildSectionMap(rows) {
  sectionMap = {};
  rows.forEach(r => {
    const key = `${r.curso}||${r.seccion}`;
    if (!sectionMap[key]) {
      sectionMap[key] = {
        curso: r.curso, codigo: r.codigo, seccion: r.seccion, docentes: [], horarios: [],
        creditosDirectos: (r.creditosDirectos !== undefined ? r.creditosDirectos : null),
        cicloDirecto: (r.cicloDirecto !== undefined ? r.cicloDirecto : null)
      };
    }
    if (!sectionMap[key].docentes.includes(r.docente)) sectionMap[key].docentes.push(r.docente);
    const exists = sectionMap[key].horarios.some(h => h.horario === r.horario && h.tipo === r.tipo && h.aula === r.aula && h.docente === r.docente);
    if (!exists) sectionMap[key].horarios.push({ horario: r.horario, tipo: r.tipo, aula: r.aula, docente: r.docente });
    if (sectionMap[key].creditosDirectos === null && r.creditosDirectos != null) sectionMap[key].creditosDirectos = r.creditosDirectos;
    if (sectionMap[key].cicloDirecto === null && r.cicloDirecto != null) sectionMap[key].cicloDirecto = r.cicloDirecto;
  });
}

// Ciclo a usar para un curso dentro de una especialidad (si no aparece en esa
// especialidad puntual, usamos el ciclo más bajo que tenga en cualquier otra).
function getCicloForCourse(curso, especialidad) {
  const porCarrera = courseCiclo[curso];
  if (!porCarrera) return null;
  if (porCarrera[especialidad] != null) return porCarrera[especialidad];
  const valores = Object.values(porCarrera).filter(v => v != null && v !== 'ELECTIVO');
  if (valores.length) return Math.min(...valores);
  const tieneElectivo = Object.values(porCarrera).some(v => v === 'ELECTIVO');
  return tieneElectivo ? 'ELECTIVO' : null;
}

function updateCourseSelect() {
  const especialidad = (especialidadSelect && especialidadSelect.value) || 's1';
  let courses = [...new Set(loadedRows.map(r => r.curso))];

  // El selector de especialidad filtra: solo cursos que pertenecen a esa carrera
  if (Object.keys(courseSpecialties).length) {
    courses = courses.filter(c => !courseSpecialties[c] || courseSpecialties[c].has(especialidad));
  }

  // Orden por ciclo (Electivos al final), luego alfabético
  courses.sort((a, b) => {
    const ca = getCicloForCourse(a, especialidad);
    const cb = getCicloForCourse(b, especialidad);
    const na = ca === 'ELECTIVO' ? 99 : (ca ?? 999);
    const nb = cb === 'ELECTIVO' ? 99 : (cb ?? 999);
    if (na !== nb) return na - nb;
    return a.localeCompare(b, 'es', { numeric: true });
  });

  courseSelect.innerHTML = '<option value="">-- seleccione curso --</option>' + courses.map(c => {
    const ciclo = getCicloForCourse(c, especialidad);
    const cicloLabel = ciclo ? `Ciclo ${formatCiclo(ciclo)} · ` : '';
    return `<option value="${c}">${cicloLabel}${c}</option>`;
  }).join('');
  sectionSelect.innerHTML = '<option value="">-- primero selecciona curso --</option>';
  sectionTimes.textContent = 'Selecciona sección.';
}

function updateSectionSelect() {
  const curso = courseSelect.value;
  if (!curso) {
    sectionSelect.innerHTML = '<option value="">-- primero selecciona curso --</option>';
    sectionTimes.textContent = 'Selecciona sección.';
    return;
  }
  const sections = Object.values(sectionMap)
    .filter(s => s.curso === curso)
    .sort((a,b) => a.seccion.localeCompare(b.seccion,'es',{numeric:true}));
  sectionSelect.innerHTML = '<option value="">-- seleccione sección --</option>' + sections.map(s => {
    const key = `${s.curso}||${s.seccion}`;
    const docentesLabel = s.docentes.join(' / ');
    return `<option value="${key}">${s.seccion} (${docentesLabel})</option>`;
  }).join('');
  sectionTimes.textContent = 'Selecciona sección.';
}

function getSectionInfo(section) {
  if (section.creditosDirectos !== null && section.creditosDirectos !== undefined) {
    return { creditos: section.creditosDirectos, ciclo: section.cicloDirecto };
  }
  return lookupCourseInfo(section.codigo, section.curso);
}

function showSectionHorario() {
  const key = sectionSelect.value;
  if (!key) { sectionTimes.textContent = 'Selecciona sección.'; return; }
  const section = sectionMap[key];
  if (!section) { sectionTimes.textContent = 'Sección inválida.'; return; }
  const info = getSectionInfo(section);
  const creditosLabel = info.creditos !== null && info.creditos !== undefined ? `${info.creditos} créditos` : 'créditos no encontrados';
  const cicloLabel = info.ciclo ? ` · Ciclo ${formatCiclo(info.ciclo)}` : '';
  const horariosLabel = section.horarios.map(h => `${h.horario} (${h.tipo}) [${h.aula}] - ${h.docente}`).join(' | ');
  sectionTimes.textContent = `${creditosLabel}${cicloLabel} — ${horariosLabel}`;
}

function addBlockHandler() {
  const key = sectionSelect.value;
  if (!key) { alert('Selecciona sección.'); return; }
  const section = sectionMap[key];
  if (!section) { alert('Sección inválida.'); return; }

  const info = getSectionInfo(section);
  if (info.creditos === null || info.creditos === undefined) {
    console.warn(`No se encontraron créditos para "${section.curso}" (${section.codigo || 'sin código'}). Se guardó con 0 créditos.`);
  }
  const creditos = info.creditos ?? 0;
  const ciclo = info.ciclo ?? null;

  section.horarios.forEach(h => {
      if (!scheduleBlocks.some(b => b.curso === section.curso && b.docente === h.docente && b.seccion === section.seccion && b.horario === h.horario && b.tipo === h.tipo && b.aula === h.aula)) {
      scheduleBlocks.push({ codigo: section.codigo || '', curso: section.curso, docente: h.docente, seccion: section.seccion, horario: h.horario, tipo: h.tipo || 'otro', aula: h.aula || 'sin aula', creditos: creditos, ciclo: ciclo });
    }
  });
  renderSchedule();
}

function parseTime(time) {
  const parts = time.split(':').map(Number);
  if (parts.length === 1) return parts[0] || 0;
  return parts[0] + (parts[1] || 0) / 60;
}

async function ensureHtml2Canvas() {
  if (typeof window.html2canvas === 'function') return true;
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => resolve(typeof window.html2canvas === 'function');
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

async function ensureJsPDF() {
  if (window.jspdf || window.jsPDF) return true;
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => resolve(Boolean(window.jspdf || window.jsPDF));
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

async function buildExportContainer() {
  const EXPORT_WIDTH = 1400;

  const container = document.createElement('div');
  container.className = 'export-root';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-10000px';
  container.style.width = EXPORT_WIDTH + 'px';
  container.style.background = '#fdfaf0';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'export-title-row';
  const blocksTitle = document.querySelector('.card-matricula h2');
  const blocksTitleText = blocksTitle ? blocksTitle.textContent : 'Bloques seleccionados';
  titleWrap.innerHTML = `
    <img src="UNI-logo.png" alt="" class="export-logo" />
    <div>
      <h2>Universidad Nacional de Ingeniería</h2>
      <span>Mi Horario · Lunes a Sábado, 07:00 – 22:00</span>
    </div>`;
  container.appendChild(titleWrap);

  const calWrapper = document.createElement('div');
  calWrapper.className = 'calendar-wrapper export-calendar-wrapper';
  const calGrid = document.createElement('div');
  calGrid.className = 'calendar-grid';
  calWrapper.appendChild(calGrid);
  container.appendChild(calWrapper);

  const blocksCard = document.createElement('div');
  blocksCard.className = 'card export-blocks-card';
  blocksCard.innerHTML = `<h2>${blocksTitleText}</h2><div>${blocksList.innerHTML}</div>`;
  container.appendChild(blocksCard);

  document.body.appendChild(container);
  renderCalendarInto(calGrid, EXPORT_WIDTH); // ancho fijo -> siempre se ve completo y bien cuadrado, sin depender del tamaño de pantalla
  // Esperamos un frame para que el navegador aplique estilos/fuentes antes de capturar
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  return container;
}

async function exportCalendarAsImage() {
  const ok = await ensureHtml2Canvas();
  if (!ok || typeof window.html2canvas !== 'function') {
    alert('No se puede exportar. No se cargó html2canvas.');
    return;
  }
  let container;
  try {
    container = await buildExportContainer();
    const canvas = await window.html2canvas(container, { backgroundColor: '#fdfaf0', scale: 2, useCORS: true, width: container.scrollWidth, windowWidth: container.scrollWidth });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `horario-${Date.now()}.png`;
    link.click();
  } catch (error) {
    console.error(error);
    alert('Error exportando imagen.');
  } finally {
    if (container) container.remove();
  }
}

async function exportCalendarAsPdf() {
  const okCanvas = await ensureHtml2Canvas();
  const okPdf = await ensureJsPDF();
  const html2canvasFn = window.html2canvas;
  const JsPdfClass = window.jspdf?.jsPDF || window.jsPDF || window.jspdf;
  if (!okCanvas || !html2canvasFn) {
    alert('No se puede exportar PDF: falta html2canvas.');
    return;
  }
  if (!okPdf || !JsPdfClass) {
    alert('No se puede exportar PDF: falta jsPDF.');
    return;
  }
  let container;
  try {
    container = await buildExportContainer();
    const canvas = await html2canvasFn(container, { backgroundColor: '#fdfaf0', scale: 2, useCORS: true, width: container.scrollWidth, windowWidth: container.scrollWidth });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new JsPdfClass('landscape', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidthMm = pageWidth;
    const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    if (imgHeightMm <= pageHeight) {
      // Cabe en una sola página: se centra verticalmente para que quede bien cuadrado
      const offsetY = (pageHeight - imgHeightMm) / 2;
      pdf.addImage(imgData, 'PNG', 0, offsetY, imgWidthMm, imgHeightMm);
    } else {
      // Contenido más alto que una página: lo dividimos en páginas sin cortar bloques a la mitad de forma abrupta
      const pageHeightPx = (pageHeight * canvas.width) / imgWidthMm;
      let renderedPx = 0;
      let firstPage = true;
      while (renderedPx < canvas.height) {
        const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;
        const ctx = pageCanvas.getContext('2d');
        ctx.fillStyle = '#fdfaf0';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
        const sliceImgData = pageCanvas.toDataURL('image/png');
        const sliceHeightMm = (sliceHeightPx * imgWidthMm) / canvas.width;
        if (!firstPage) pdf.addPage();
        pdf.addImage(sliceImgData, 'PNG', 0, 0, imgWidthMm, sliceHeightMm);
        firstPage = false;
        renderedPx += sliceHeightPx;
      }
    }
    pdf.save(`horario-${Date.now()}.pdf`);
  } catch (error) {
    console.error(error);
    alert('Error exportando PDF.');
  } finally {
    if (container) container.remove();
  }
}

/* ============================================================
   PERSISTENCIA LOCAL (evita que se borre todo al cambiar de app
   en el celular) + SINCRONIZACIÓN EN LA NUBE (Firestore) para que
   tus horarios se vean en cualquier dispositivo con tu correo.
   Si Firebase no está configurado o no hay conexión, todo sigue
   funcionando solo con este navegador (respaldo local).
   ============================================================ */
const AUTOSAVE_KEY = 'uni_horario_autosave_v1';
const SAVED_KEY_PREFIX = 'uni_horarios_guardados_';
let _cloudSyncTimer = null;

function persistAutosave() {
  try {
    const especialidad = (especialidadSelect && especialidadSelect.value) || 's1';
    const courseSpecialtiesArr = {};
    Object.keys(courseSpecialties).forEach(c => { courseSpecialtiesArr[c] = [...courseSpecialties[c]]; });
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ loadedRows, scheduleBlocks, especialidad, courseSpecialties: courseSpecialtiesArr, courseCiclo }));
  } catch (e) {
    console.warn('No se pudo autoguardar en este navegador:', e);
  }
  clearTimeout(_cloudSyncTimer);
  _cloudSyncTimer = setTimeout(syncCurrentToCloud, 900);
}

function restoreAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (Array.isArray(data.loadedRows)) loadedRows = data.loadedRows;
    if (Array.isArray(data.scheduleBlocks)) scheduleBlocks = data.scheduleBlocks;
    if (data.especialidad && especialidadSelect) especialidadSelect.value = data.especialidad;
    if (data.courseSpecialties) {
      courseSpecialties = {};
      Object.keys(data.courseSpecialties).forEach(c => { courseSpecialties[c] = new Set(data.courseSpecialties[c]); });
    }
    if (data.courseCiclo) courseCiclo = data.courseCiclo;
    return true;
  } catch (e) {
    console.warn('No se pudo restaurar el autoguardado:', e);
    return false;
  }
}

// Devuelve el usuario de Firebase (o null) esperando primero a que
// Firebase termine de resolver la sesión persistida.
async function currentFirebaseUser() {
  if (typeof firebase === 'undefined' || !firebase.firestore || typeof window.firebaseAuthReady === 'undefined') return null;
  try {
    const user = await window.firebaseAuthReady;
    return firebase.auth().currentUser || user || null;
  } catch {
    return null;
  }
}

function usuarioDocRef(email) {
  return firebase.firestore().collection('usuarios').doc(email.toLowerCase());
}

// Sube el horario que se está editando ahora mismo a la nube (silencioso, sin bloquear la UI)
async function syncCurrentToCloud() {
  const email = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : null;
  if (!email) return;
  const user = await currentFirebaseUser();
  if (!user) return;
  try {
    await usuarioDocRef(email).set({
      actual: scheduleBlocks,
      actualizado: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('No se pudo sincronizar tu horario actual con la nube:', e);
  }
}

// Trae el horario "en curso" desde la nube (para verlo igual en otro dispositivo)
async function pullCurrentFromCloud() {
  const email = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : null;
  if (!email) return false;
  const user = await currentFirebaseUser();
  if (!user) return false;
  try {
    const doc = await usuarioDocRef(email).get();
    const data = doc.exists ? doc.data() : null;
    if (data && Array.isArray(data.actual) && data.actual.length) {
      scheduleBlocks = data.actual;
      return true;
    }
  } catch (e) {
    console.warn('No se pudo traer tu horario desde la nube:', e);
  }
  return false;
}

async function getSavedSchedules() {
  const email = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : null;
  if (!email) return [];
  const cacheKey = SAVED_KEY_PREFIX + email.toLowerCase();
  const user = await currentFirebaseUser();
  if (user) {
    try {
      const snap = await usuarioDocRef(email).collection('guardados').orderBy('fecha', 'desc').get();
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      localStorage.setItem(cacheKey, JSON.stringify(list)); // copia local por si luego no hay conexión
      return list;
    } catch (e) {
      console.warn('No se pudo leer de la nube, mostrando la última copia guardada en este navegador:', e);
    }
  }
  try { return JSON.parse(localStorage.getItem(cacheKey) || '[]'); } catch { return []; }
}

async function saveCurrentSchedule(nombre) {
  if (!scheduleBlocks.length) { alert('No hay bloques en tu horario para guardar.'); return; }
  const email = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : null;
  if (!email) { alert('Inicia sesión con tu cuenta autorizada para guardar tu horario.'); return; }

  const entry = {
    nombre: (nombre && nombre.trim()) || `Horario ${new Date().toLocaleDateString('es-PE')}`,
    fecha: new Date().toISOString(),
    scheduleBlocks: JSON.parse(JSON.stringify(scheduleBlocks))
  };

  const user = await currentFirebaseUser();
  if (user) {
    try {
      await usuarioDocRef(email).collection('guardados').add(entry);
      await renderSavedSchedulesList();
      return;
    } catch (e) {
      console.warn('No se pudo guardar en la nube, se guardó solo en este navegador:', e);
    }
  }
  const cacheKey = SAVED_KEY_PREFIX + email.toLowerCase();
  const list = JSON.parse(localStorage.getItem(cacheKey) || '[]');
  list.unshift({ id: Date.now().toString(36), ...entry });
  localStorage.setItem(cacheKey, JSON.stringify(list));
  renderSavedSchedulesList();
}

async function loadSavedSchedule(id) {
  const list = await getSavedSchedules();
  const entry = list.find(e => e.id === id);
  if (!entry) return;
  scheduleBlocks = JSON.parse(JSON.stringify(entry.scheduleBlocks));
  renderSchedule(); // esto también sube el cambio a la nube vía persistAutosave
}

async function deleteSavedSchedule(id) {
  const email = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : null;
  if (!email) return;
  const user = await currentFirebaseUser();
  if (user) {
    try {
      await usuarioDocRef(email).collection('guardados').doc(id).delete();
      await renderSavedSchedulesList();
      return;
    } catch (e) {
      console.warn('No se pudo eliminar en la nube:', e);
    }
  }
  const cacheKey = SAVED_KEY_PREFIX + email.toLowerCase();
  const list = JSON.parse(localStorage.getItem(cacheKey) || '[]').filter(e => e.id !== id);
  localStorage.setItem(cacheKey, JSON.stringify(list));
  renderSavedSchedulesList();
}

async function renderSavedSchedulesList() {
  const el = document.getElementById('savedSchedulesList');
  const emailEl = document.getElementById('savedForEmail');
  const email = (typeof getCurrentUserEmail === 'function') ? getCurrentUserEmail() : null;
  if (emailEl) emailEl.textContent = email || 'inicia sesión';
  if (!el) return;

  if (!email) {
    el.innerHTML = '<p class="hint">Inicia sesión para ver y guardar tus horarios.</p>';
    return;
  }

  el.innerHTML = '<p class="hint">Cargando horarios guardados…</p>';
  const list = await getSavedSchedules();
  if (!list.length) {
    el.innerHTML = '<p class="hint">Aún no tienes horarios guardados.</p>';
    return;
  }

  el.innerHTML = list.map(e => `
    <div class="saved-item">
      <div class="saved-item-info">
        <div class="saved-item-name">${e.nombre}</div>
        <div class="saved-item-date">${new Date(e.fecha).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      </div>
      <div class="saved-item-actions">
        <button data-load="${e.id}" class="ghost">Cargar</button>
        <button data-delete="${e.id}" class="danger">✕</button>
      </div>
    </div>`).join('');

  el.querySelectorAll('button[data-load]').forEach(btn => {
    btn.addEventListener('click', () => loadSavedSchedule(btn.dataset.load));
  });
  el.querySelectorAll('button[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('¿Eliminar este horario guardado? Esta acción no se puede deshacer.')) deleteSavedSchedule(btn.dataset.delete);
    });
  });
}

// Se llama desde auth.js apenas se confirma la sesión (existente o nueva)
window.onAuthReady = async function () {
  const huboRemoto = await pullCurrentFromCloud();
  if (huboRemoto) {
    renderSchedule(); // usamos el horario que ya estaba en la nube (de otro dispositivo)
  } else if (scheduleBlocks.length) {
    syncCurrentToCloud(); // no había nada en la nube todavía: subimos lo que teníamos local
  }
  renderSavedSchedulesList();
};

function renderCalendar() {
  renderCalendarInto(calendarGrid);
}

function renderCalendarInto(targetGrid, widthOverride) {
  const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const startHour = 7;
  const endHour = 22;
  const totalHours = endHour - startHour;
  const hours = [];
  for (let h = startHour; h < endHour; h++) hours.push(`${h.toString().padStart(2,'0')}:00`);

  let html = '<div class="header corner"></div>' + days.map(d => `<div class="header">${d}</div>`).join('');
  hours.forEach((h, row) => {
    const next = `${(startHour + row + 1).toString().padStart(2,'0')}:00`;
    html += `<div class="hour">${h} a ${next}</div>` + days.map(() => '<div class="cell"></div>').join('');
  });
  targetGrid.innerHTML = html;

  const rect = targetGrid.getBoundingClientRect();
  const hourColumnWidth = 100;
  const availableWidth = widthOverride || rect.width;
  const dayWidth = Math.max((availableWidth - hourColumnWidth) / 6, 90);
  const totalMinutes = (endHour - startHour) * 60;

  const dayMap = {lu:0,ma:1,mi:2,mie:2,ju:3,vi:4,sa:5,sab:5};

  function parseHorario(horario) {
    const tr = horario.trim().toLowerCase().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u');
    const m = tr.match(/(lu|ma|mi|mie|ju|vi|sa|sab)[^\d]*(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?/i);
    if (!m) return null;
    const dayKey = m[1].substr(0,2);
    const day = dayMap[dayKey];
    if (day === undefined) return null;
    const startH = Number(m[2]);
    const startM = m[3] ? Number(m[3]) : 0;
    const endH = Number(m[4]);
    const endM = m[5] ? Number(m[5]) : 0;
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    if (isNaN(startMin) || isNaN(endMin) || endMin <= startMin) return null;
    return { day, startMin, endMin };
  }

  const dayEvents = [[],[],[],[],[],[]];
  scheduleBlocks.forEach(b => {
    const parsed = parseHorario(b.horario);
    if (!parsed) return;
    if (parsed.startMin < startHour * 60 || parsed.endMin > endHour * 60) return;
    dayEvents[parsed.day].push({ ...b, ...parsed });
  });

  dayEvents.forEach((events, dayIndex) => {
    events.sort((a,b) => a.startMin - b.startMin || a.endMin - b.endMin);

    const groups = [];
    events.forEach(event => {
      let placed = false;
      for (const g of groups) {
        if (event.startMin < g.maxEnd) {
          g.events.push(event);
          g.maxEnd = Math.max(g.maxEnd, event.endMin);
          placed = true;
          break;
        }
      }
      if (!placed) groups.push({events:[event], maxEnd:event.endMin});
    });

    groups.forEach(group => {
      const groupEvents = group.events;
      const columns = [];
      groupEvents.forEach(event => {
        let col = columns.findIndex(end => end <= event.startMin);
        if (col === -1) col = columns.length;
        columns[col] = event.endMin;
        event.col = col;
      });
      const totalCols = columns.length || 1;

      groupEvents.forEach(event => {
        const rowHeight = 50;
        const headerHeight = 50;
        const topPx = headerHeight + ((event.startMin - startHour * 60) / 60) * rowHeight;
        const heightPx = ((event.endMin - event.startMin) / 60) * rowHeight;
        const colWidth = dayWidth / totalCols;
        const leftPos = hourColumnWidth + dayIndex * dayWidth + event.col * colWidth;
        const widthPx = colWidth - 4;

        const chip = document.createElement('div');
        const tipoClass = event.tipo === 'practica' ? 'practica' : event.tipo === 'laboratorio' ? 'laboratorio' : event.tipo === 'otro' ? 'otro' : 'teoria';
        chip.className = 'block-chip ' + tipoClass;
        chip.style.position = 'absolute';
        chip.style.top = `${topPx}px`;
        chip.style.left = `${leftPos}px`;
        chip.style.width = `${widthPx}px`;
        chip.style.height = `${Math.max(heightPx - 4, 18)}px`;
        chip.style.zIndex = '1';
        const showMeta = heightPx > 30;
        const showProf = heightPx > 46;
        chip.innerHTML = `<div class="chip-course">${event.curso} · ${event.seccion}</div>` +
          (showMeta ? `<div class="chip-meta">${event.aula || 'sin aula'}</div>` : '') +
          (showProf ? `<div class="chip-prof">${event.docente || ''}</div>` : '');
        chip.title = `${event.curso} — Sección ${event.seccion}\n${event.horario}\n${event.aula || 'sin aula'}\n${event.docente || ''}`;
        chip.addEventListener('mouseenter', () => { chip.style.zIndex = '10'; });
        chip.addEventListener('mouseleave', () => { chip.style.zIndex = '1'; });
        targetGrid.appendChild(chip);
      });
    });
  });
}

function renderSchedule() {
  renderCalendar();

  const blocksList = document.getElementById('blocksList');
  if (!blocksList) return;

  if (!scheduleBlocks.length) {
    blocksList.innerHTML = '<p class="hint">Aún no hay bloques seleccionados.</p>';
    persistAutosave();
    return;
  }

  const uniqueCourses = [];
  const seen = new Set();

  scheduleBlocks.forEach(b => {
    const key = `${b.curso}|${b.seccion}`;
    if (!seen.has(key)) {
      seen.add(key);
      const relacionados = scheduleBlocks.filter(x => x.curso === b.curso && x.seccion === b.seccion);
      uniqueCourses.push({
        codigo: b.codigo || '—',
        curso: b.curso,
        seccion: b.seccion,
        creditos: b.creditos || 0,
        ciclo: b.ciclo,
        horarios: relacionados.map(x => ({ horario: x.horario, aula: x.aula, tipo: x.tipo, docente: x.docente }))
      });
    }
  });

  const totalCursos = uniqueCourses.length;
  const totalCreditos = uniqueCourses.reduce((sum, c) => sum + (c.creditos || 0), 0);
  const tipoLabel = { teoria: 'TEORÍA', practica: 'PRÁCTICA', laboratorio: 'LABORATORIO', otro: 'OTRO' };

  let html = '<div class="matricula-wrapper"><table class="matricula-table"><thead><tr>' +
    '<th>N°</th><th>Código</th><th>Curso</th><th>Sección</th><th>Cred</th><th>Ciclo</th><th>Horario</th><th></th>' +
    '</tr></thead><tbody>';

  uniqueCourses.forEach((c, i) => {
    const cursoAttr = c.curso.replace(/"/g, '&quot;');
    const seccionAttr = c.seccion.replace(/"/g, '&quot;');
    html += `<tr>
      <td>${i + 1}</td>
      <td class="col-mono">${c.codigo || '—'}</td>
      <td class="col-curso">${c.curso}</td>
      <td>${c.seccion}</td>
      <td class="col-mono">${c.creditos}</td>
      <td class="col-mono">${formatCiclo(c.ciclo)}</td>
      <td>
        <div class="horario-cell">
          ${c.horarios.map(h => `
            <div class="horario-line">
              <span class="pill pill-day">${h.horario}</span>
              <span class="pill pill-room">${h.aula}</span>
              <span class="pill pill-tipo pill-${h.tipo}">${tipoLabel[h.tipo] || 'OTRO'}</span>
              <span class="horario-docente">${h.docente}</span>
            </div>`).join('')}
        </div>
      </td>
      <td><button class="row-remove" data-curso="${cursoAttr}" data-seccion="${seccionAttr}" title="Eliminar curso">✕</button></td>
    </tr>`;
  });

  html += '</tbody></table>';
  html += `<div class="matricula-summary">
    <div class="summary-row"><span class="summary-label">Total cursos matriculados</span><span class="pill pill-count">${totalCursos}</span></div>
    <div class="summary-row"><span class="summary-label">Total créditos matriculados</span><span class="pill pill-credits">${totalCreditos}</span></div>
  </div></div>`;

  blocksList.innerHTML = html;

  blocksList.querySelectorAll('button.row-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const cursoEliminar = btn.dataset.curso;
      const seccionEliminar = btn.dataset.seccion;
      scheduleBlocks = scheduleBlocks.filter(b => !(b.curso === cursoEliminar && b.seccion === seccionEliminar));
      renderSchedule();
    });
  });

  persistAutosave();
}
function renderPreview() {
  if (!loadedRows.length) { tablePreview.innerHTML = '<p class="hint">No hay datos cargados.</p>'; return; }
  let html = '<table><tr><th>Curso</th><th>Docente</th><th>Sección</th><th>Horario</th></tr>';
  loadedRows.forEach(r => { html += `<tr><td>${r.curso}</td><td>${r.docente}</td><td>${r.seccion}</td><td>${r.horario}</td></tr>`; });
  html += '</table>';
  tablePreview.innerHTML = html;
}

fileInput.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const fileLabelText = document.getElementById('fileLabelText');
  if (fileLabelText) fileLabelText.textContent = file.name;
  handleExcelFile(file).catch(err => {
    console.error(err);
    alert('No se pudo leer ese archivo Excel. Revisa que sea el formato de HORARIOS_XX-X.xlsx con hojas "s1", "s2" y "s3".');
  });
});

loadExample.addEventListener('click', () => {
  loadedRows = [
    { codigo: 'AA215', curso: 'GEOLOGÍA', docente: 'ROJAS LEON', seccion: 'E', horario: 'MA 10-12', tipo: 'teoria', aula: 'sin aula', creditosDirectos: 3, cicloDirecto: 1 },
    { codigo: 'AA215', curso: 'GEOLOGÍA', docente: 'ROJAS LEON', seccion: 'E', horario: 'MA 12-14', tipo: 'practica', aula: 'sin aula', creditosDirectos: 3, cicloDirecto: 1 }
  ];
  courseSpecialties = { 'GEOLOGÍA': new Set(['s1']) };
  courseCiclo = { 'GEOLOGÍA': { s1: 1 } };
  buildSectionMap(loadedRows); updateCourseSelect(); renderPreview(); scheduleBlocks=[]; renderSchedule(); renderCalendar(); persistAutosave();
});

if (especialidadSelect) {
  especialidadSelect.addEventListener('change', () => {
    // No hace falta re-leer el Excel: solo cambiamos qué cursos se muestran y su orden
    if (loadedRows.length) updateCourseSelect();
    persistAutosave();
  });
}

courseSelect.addEventListener('change', updateSectionSelect);
sectionSelect.addEventListener('change', showSectionHorario);
addBlock.addEventListener('click', addBlockHandler);
downloadImageBtn.addEventListener('click', exportCalendarAsImage);
downloadPdfBtn.addEventListener('click', exportCalendarAsPdf);
clearBtn.addEventListener('click', () => {
  if (scheduleBlocks.length && !confirm('¿Vaciar todo tu horario actual? Puedes guardarlo antes si quieres conservarlo.')) return;
  scheduleBlocks=[];
  renderSchedule();
});

const saveScheduleBtn = document.getElementById('saveScheduleBtn');
if (saveScheduleBtn) {
  saveScheduleBtn.addEventListener('click', () => {
    const nameInput = document.getElementById('saveNameInput');
    saveCurrentSchedule(nameInput ? nameInput.value : '');
    if (nameInput) nameInput.value = '';
  });
}

// Restauramos lo que había en este navegador (evita perder todo si el
// celular recarga la página al cambiar de app) y luego pintamos todo.
restoreAutosave();
if (loadedRows.length) { buildSectionMap(loadedRows); updateCourseSelect(); }
renderPreview();
renderSchedule();
renderCalendar();
renderSavedSchedulesList();