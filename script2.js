const fileInput = document.getElementById('fileInput');
const loadExample = document.getElementById('loadExample');
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

function parseHTMLTable(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return [];

  const trs = Array.from(table.querySelectorAll('tr'));
  if (trs.length < 2) return [];

  const header = Array.from(trs[0].querySelectorAll('th,td')).map(c => c.textContent.trim().toLowerCase());
  const idxCodigo = header.findIndex(h => /^cod|código|codigo/.test(h));
  const idxCurso = header.findIndex(h => /curso|materia|asignatura/.test(h));
  const idxDocente = header.findIndex(h => /docente|profesor|teacher/.test(h));
  const idxSeccion = header.findIndex(h => /secc|sección|seccion/.test(h));
  const idxHorario = header.findIndex(h => /horario|hora/.test(h));
  const idxTipo = header.findIndex(h => /tipo|teoria|practica|práctica/.test(h));
  const idxAula = header.findIndex(h => /aula|salon|sala|ambiente/.test(h));

  const rows = [];
  for (let i = 1; i < trs.length; i++) {
    const cells = Array.from(trs[i].querySelectorAll('th,td')).map(c => c.textContent.trim());
    if (!cells.length) continue;

    const codigo = idxCodigo !== -1 ? (cells[idxCodigo] || '').trim() : '';
    const curso = idxCurso !== -1 ? (cells[idxCurso] || '') : (cells[2] || '');
    const docente = idxDocente !== -1 ? (cells[idxDocente] || '') : (cells[cells.length - 1] || '');
    const seccion = idxSeccion !== -1 ? (cells[idxSeccion] || '--') : (cells[1] || '--');
    const horario = idxHorario !== -1 ? (cells[idxHorario] || '') : (cells[4] || cells[3] || '');
    const aula = idxAula !== -1 ? (cells[idxAula] || '').trim() : '';
    let tipo = idxTipo !== -1 ? (cells[idxTipo] || '').toLowerCase() : '';
    if (!tipo) {
      const lowerCells = cells.map(c => c.toLowerCase());
      if (lowerCells.some(c => c.includes('pract'))) tipo = 'practica';
      else if (lowerCells.some(c => c.includes('lab'))) tipo = 'laboratorio';
      else if (lowerCells.some(c => c.includes('teor'))) tipo = 'teoria';
    }
    tipo = tipo.toLowerCase();
    const tipoNorm = tipo.includes('pract') ? 'practica' : tipo.includes('lab') ? 'laboratorio' : tipo.includes('teor') ? 'teoria' : 'otro';

    if (!curso || !docente || !horario) continue;
    rows.push({ codigo: codigo.trim(), curso: curso.trim(), docente: docente.trim(), seccion: seccion.trim(), horario: horario.trim(), tipo: tipoNorm, aula: aula || 'sin aula' });
  }

  return rows;
}

// Busca los créditos y el ciclo de un curso en el catálogo, primero por código y
// si no lo encuentra, por coincidencia de nombre (ignorando tildes/mayúsculas).
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
    if (!sectionMap[key]) sectionMap[key] = { curso: r.curso, codigo: r.codigo, seccion: r.seccion, docentes: [], horarios: [] };
    if (!sectionMap[key].docentes.includes(r.docente)) sectionMap[key].docentes.push(r.docente);
    const exists = sectionMap[key].horarios.some(h => h.horario === r.horario && h.tipo === r.tipo && h.aula === r.aula && h.docente === r.docente);
    if (!exists) sectionMap[key].horarios.push({ horario: r.horario, tipo: r.tipo, aula: r.aula, docente: r.docente });
  });
}

function updateCourseSelect() {
  const courses = [...new Set(loadedRows.map(r => r.curso))].sort((a,b) => a.localeCompare(b,'es',{numeric:true}));
  courseSelect.innerHTML = '<option value="">-- seleccione curso --</option>' + courses.map(c => `<option value="${c}">${c}</option>`).join('');
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

function showSectionHorario() {
  const key = sectionSelect.value;
  if (!key) { sectionTimes.textContent = 'Selecciona sección.'; return; }
  const section = sectionMap[key];
  if (!section) { sectionTimes.textContent = 'Sección inválida.'; return; }
  const info = lookupCourseInfo(section.codigo, section.curso);
  const creditosLabel = info.creditos !== null ? `${info.creditos} créditos` : 'créditos no encontrados en el catálogo';
  const cicloLabel = info.ciclo ? ` · Ciclo ${info.ciclo}` : '';
  const horariosLabel = section.horarios.map(h => `${h.horario} (${h.tipo}) [${h.aula}] - ${h.docente}`).join(' | ');
  sectionTimes.textContent = `${creditosLabel}${cicloLabel} — ${horariosLabel}`;
}

function addBlockHandler() {
  const key = sectionSelect.value;
  if (!key) { alert('Selecciona sección.'); return; }
  const section = sectionMap[key];
  if (!section) { alert('Sección inválida.'); return; }

  // Obtenemos créditos y ciclo automáticamente del catálogo de la malla curricular
  const info = lookupCourseInfo(section.codigo, section.curso);
  if (info.creditos === null) {
    console.warn(`No se encontraron créditos en el catálogo para "${section.curso}" (${section.codigo || 'sin código'}). Se guardó con 0 créditos.`);
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

async function exportCalendarAsImage() {
  const wrapper = document.querySelector('.calendar-wrapper');
  if (!wrapper) {
    alert('No hay calendario para exportar.');
    return;
  }
  const ok = await ensureHtml2Canvas();
  if (!ok || typeof window.html2canvas !== 'function') {
    alert('No se puede exportar. No se cargó html2canvas.');
    return;
  }
  try {
    const canvas = await window.html2canvas(wrapper, { backgroundColor: '#ffffff', scale: 2 });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `horario-${Date.now()}.png`;
    link.click();
  } catch (error) {
    console.error(error);
    alert('Error exportando imagen.');
  }
}

async function exportCalendarAsPdf() {
  const wrapper = document.querySelector('.calendar-wrapper');
  if (!wrapper) {
    alert('No hay calendario para exportar.');
    return;
  }
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
  try {
    const canvas = await html2canvasFn(wrapper, { backgroundColor: '#ffffff', scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new JsPdfClass('landscape', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`horario-${Date.now()}.pdf`);
  } catch (error) {
    console.error(error);
    alert('Error exportando PDF.');
  }
}

function renderCalendar() {
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
  calendarGrid.innerHTML = html;

  const rect = calendarGrid.getBoundingClientRect();
  const hourColumnWidth = 100;
  const dayWidth = Math.max((rect.width - hourColumnWidth) / 6, 90);
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
        chip.className = 'block-chip ' + (event.tipo === 'practica' ? 'practica' : event.tipo === 'otro' ? 'otro' : 'teoria');
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
        calendarGrid.appendChild(chip);
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
      <td class="col-mono">${c.ciclo || '—'}</td>
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
  const r = new FileReader();
  r.onload = () => { loadedRows = parseHTMLTable(r.result); if (!loadedRows.length) { alert('No se encontraron datos válidos.'); return; } buildSectionMap(loadedRows); updateCourseSelect(); renderPreview(); scheduleBlocks=[]; renderSchedule(); renderCalendar(); };
  r.readAsText(file);
});

loadExample.addEventListener('click', () => {
  const html = '<table><tr><th>Cod</th><th>Secc</th><th>Curso</th><th>Tipo</th><th>Horario</th><th>Aula</th><th>Docente</th></tr><tr><td>AA215</td><td>E</td><td>GEOLOGIA</td><td>TEORIA</td><td>MA 10-12</td><td>D2-351</td><td>ROJAS LEON</td></tr><tr><td>AA215</td><td>E</td><td>GEOLOGIA</td><td>PRACTICA</td><td>MA 12-14</td><td>D2-351</td><td>ROJAS LEON</td></tr></table>';
  loadedRows = parseHTMLTable(html); buildSectionMap(loadedRows); updateCourseSelect(); renderPreview(); scheduleBlocks=[]; renderSchedule(); renderCalendar();
});

courseSelect.addEventListener('change', updateSectionSelect);
sectionSelect.addEventListener('change', showSectionHorario);
addBlock.addEventListener('click', addBlockHandler);
downloadImageBtn.addEventListener('click', exportCalendarAsImage);
downloadPdfBtn.addEventListener('click', exportCalendarAsPdf);
clearBtn.addEventListener('click', () => { scheduleBlocks=[]; renderSchedule(); });

renderPreview();
renderSchedule();renderCalendar();