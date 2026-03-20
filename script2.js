const fileInput = document.getElementById('fileInput');
const loadExample = document.getElementById('loadExample');
const courseSelect = document.getElementById('courseSelect');
const teacherSelect = document.getElementById('teacherSelect');
const sectionSelect = document.getElementById('sectionSelect');
const sectionTimes = document.getElementById('sectionTimes');
const addBlock = document.getElementById('addBlock');
const schedule = document.getElementById('schedule');
const tablePreview = document.getElementById('tablePreview');
const downloadImageBtn = document.getElementById('downloadImageBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const clearBtn = document.getElementById('clearBtn');
const calendarGrid = document.getElementById('calendarGrid');

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

    const curso = idxCurso !== -1 ? (cells[idxCurso] || '') : (cells[2] || '');
    const docente = idxDocente !== -1 ? (cells[idxDocente] || '') : (cells[cells.length - 1] || '');
    const seccion = idxSeccion !== -1 ? (cells[idxSeccion] || '--') : (cells[1] || '--');
    const horario = idxHorario !== -1 ? (cells[idxHorario] || '') : (cells[4] || cells[3] || '');
    const aula = idxAula !== -1 ? (cells[idxAula] || '').trim() : '';
    let tipo = idxTipo !== -1 ? (cells[idxTipo] || '').toLowerCase() : '';
    if (!tipo) {
      const lowerCells = cells.map(c => c.toLowerCase());
      if (lowerCells.some(c => c.includes('pract'))) tipo = 'practica';
      else if (lowerCells.some(c => c.includes('teor'))) tipo = 'teoria';
    }
    tipo = tipo.toLowerCase();

    if (!curso || !docente || !horario) continue;
    rows.push({ curso: curso.trim(), docente: docente.trim(), seccion: seccion.trim(), horario: horario.trim(), tipo: tipo.includes('pract') ? 'practica' : tipo.includes('teor') ? 'teoria' : 'otro', aula: aula || 'sin aula' });
  }

  return rows;
}

function buildSectionMap(rows) {
  sectionMap = {};
  rows.forEach(r => {
    const key = `${r.curso}||${r.docente}||${r.seccion}`;
    if (!sectionMap[key]) sectionMap[key] = { curso: r.curso, docente: r.docente, seccion: r.seccion, horarios: [] };
    const exists = sectionMap[key].horarios.some(h => h.horario === r.horario && h.tipo === r.tipo && h.aula === r.aula);
    if (!exists) sectionMap[key].horarios.push({ horario: r.horario, tipo: r.tipo, aula: r.aula });
  });
}

function updateCourseSelect() {
  const courses = [...new Set(loadedRows.map(r => r.curso))].sort((a,b) => a.localeCompare(b,'es',{numeric:true}));
  courseSelect.innerHTML = '<option value="">-- seleccione curso --</option>' + courses.map(c => `<option value="${c}">${c}</option>`).join('');
  teacherSelect.innerHTML = '<option value="">-- primero selecciona curso --</option>';
  sectionSelect.innerHTML = '<option value="">-- primero selecciona docente --</option>';
  sectionTimes.textContent = 'Selecciona sección.';
}

function updateTeacherSelect() {
  const curso = courseSelect.value;
  if (!curso) {
    teacherSelect.innerHTML = '<option value="">-- primero selecciona curso --</option>';
    sectionSelect.innerHTML = '<option value="">-- primero selecciona docente --</option>';
    return;
  }
  const teachers = [...new Set(loadedRows.filter(r => r.curso === curso).map(r => r.docente))].sort((a,b) => a.localeCompare(b,'es',{numeric:true}));
  teacherSelect.innerHTML = '<option value="">-- seleccione docente --</option>' + teachers.map(t => `<option value="${t}">${t}</option>`).join('');
  sectionSelect.innerHTML = '<option value="">-- primero selecciona docente --</option>';
  sectionTimes.textContent = 'Selecciona sección.';
}

function updateSectionSelect() {
  const curso = courseSelect.value;
  const docente = teacherSelect.value;
  if (!curso || !docente) {
    sectionSelect.innerHTML = '<option value="">-- primero selecciona docente --</option>';
    return;
  }
  const sections = Object.values(sectionMap).filter(s => s.curso === curso && s.docente === docente);
  sectionSelect.innerHTML = '<option value="">-- seleccione sección --</option>' + sections.map(s => `<option value="${s.curso}||${s.docente}||${s.seccion}">${s.seccion}</option>`).join('');
  sectionTimes.textContent = 'Selecciona sección.';
}

function showSectionHorario() {
  const key = sectionSelect.value;
  if (!key) { sectionTimes.textContent = 'Selecciona sección.'; return; }
  const section = sectionMap[key];
  if (!section) { sectionTimes.textContent = 'Sección inválida.'; return; }
  sectionTimes.textContent = 'Horarios: ' + section.horarios.map(h => `${h.horario} (${h.tipo}) [${h.aula}]`).join(' | ');
}

function addBlockHandler() {
  const key = sectionSelect.value;
  if (!key) { alert('Selecciona sección.'); return; }
  const section = sectionMap[key];
  if (!section) { alert('Sección inválida.'); return; }
  section.horarios.forEach(h => {
      if (!scheduleBlocks.some(b => b.curso === section.curso && b.docente === section.docente && b.seccion === section.seccion && b.horario === h.horario && b.tipo === h.tipo && b.aula === h.aula)) {
      scheduleBlocks.push({ curso: section.curso, docente: section.docente, seccion: section.seccion, horario: h.horario, tipo: h.tipo || 'otro', aula: h.aula || 'sin aula' });
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

  let html = '<div class="cell"></div>' + days.map(d => `<div class="header">${d}</div>`).join('');
  hours.forEach((h, row) => {
    const next = `${(startHour + row + 1).toString().padStart(2,'0')}:00`;
    html += `<div class="hour">${h} a ${next}</div>` + days.map(() => '<div class="cell"></div>').join('');
  });
  calendarGrid.innerHTML = html;

  const rect = calendarGrid.getBoundingClientRect();
  const hourColumnWidth = 110;
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
        const rowHeight = 48;
        const headerHeight = 48;
        const topPx = headerHeight + ((event.startMin - startHour * 60) / 60) * rowHeight;
        const heightPx = ((event.endMin - event.startMin) / 60) * rowHeight;
        const colWidth = dayWidth / totalCols;
        const leftPos = 110 + dayIndex * dayWidth + event.col * colWidth;
        const widthPx = colWidth - 4;

        const chip = document.createElement('div');
        chip.className = 'block-chip ' + (event.tipo === 'practica' ? 'practica' : event.tipo === 'otro' ? 'otro' : 'teoria');
        chip.style.position = 'absolute';
        chip.style.top = `${topPx}px`;
        chip.style.left = `${leftPos}px`;
        chip.style.width = `${widthPx}px`;
        chip.style.height = `${Math.max(heightPx - 4, 18)}px`;
        chip.style.padding = '2px 4px';
        chip.style.fontSize = '0.65rem';
        chip.style.zIndex = '1';
        chip.style.overflow = 'hidden';
        if (event.tipo === 'teoria') chip.style.background = '#2563eb';
        else if (event.tipo === 'practica') chip.style.background = '#dc2626';
        else chip.style.background = '#6b7280';
        chip.textContent = `${event.curso} ${event.seccion} | ${event.aula || 'sin aula'}`;
        chip.style.whiteSpace = 'pre-wrap';
        chip.addEventListener('mouseenter', () => { chip.style.zIndex = '10'; });
        chip.addEventListener('mouseleave', () => { chip.style.zIndex = '1'; });
        calendarGrid.appendChild(chip);
      });
    });
  });
}

function renderSchedule() {
  renderCalendar();
  if (!schedule) return;
  if (!scheduleBlocks.length) { schedule.innerHTML = '<p class="hint">Aún no hay bloques.</p>'; return; }
  schedule.innerHTML = scheduleBlocks.map((b,i) => `<div class="block"><div><strong>${b.curso}</strong><br>${b.docente}<br>Sección: ${b.seccion}<br>${b.horario} (${b.tipo})</div><button data-i="${i}">X</button></div>`).join('');
  schedule.querySelectorAll('button[data-i]').forEach(btn => btn.addEventListener('click', () => { scheduleBlocks.splice(Number(btn.dataset.i),1); renderSchedule(); renderCalendar(); }));
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
  const r = new FileReader();
  r.onload = () => { loadedRows = parseHTMLTable(r.result); if (!loadedRows.length) { alert('No se encontraron datos válidos.'); return; } buildSectionMap(loadedRows); updateCourseSelect(); renderPreview(); scheduleBlocks=[]; renderSchedule(); renderCalendar(); };
  r.readAsText(file);
});

loadExample.addEventListener('click', () => {
  const html = '<table><tr><th>Cod</th><th>Secc</th><th>Curso</th><th>Tipo</th><th>Horario</th><th>Aula</th><th>Docente</th></tr><tr><td>AA215</td><td>E</td><td>GEOLOGIA</td><td>TEORIA</td><td>MA 10-12</td><td>D2-351</td><td>ROJAS LEON</td></tr><tr><td>AA215</td><td>E</td><td>GEOLOGIA</td><td>PRACTICA</td><td>MA 12-14</td><td>D2-351</td><td>ROJAS LEON</td></tr></table>';
  loadedRows = parseHTMLTable(html); buildSectionMap(loadedRows); updateCourseSelect(); renderPreview(); scheduleBlocks=[]; renderSchedule(); renderCalendar();
});

courseSelect.addEventListener('change', updateTeacherSelect);
teacherSelect.addEventListener('change', updateSectionSelect);
sectionSelect.addEventListener('change', showSectionHorario);
addBlock.addEventListener('click', addBlockHandler);
downloadImageBtn.addEventListener('click', exportCalendarAsImage);
downloadPdfBtn.addEventListener('click', exportCalendarAsPdf);
clearBtn.addEventListener('click', () => { scheduleBlocks=[]; renderSchedule(); });

renderPreview();
renderSchedule();renderCalendar();