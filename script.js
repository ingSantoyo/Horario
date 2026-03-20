const fileInput = document.getElementById('fileInput');
const loadExample = document.getElementById('loadExample');
const courseSelect = document.getElementById('courseSelect');
const teacherSelect = document.getElementById('teacherSelect');
const timeSelect = document.getElementById('timeSelect');
const addBlock = document.getElementById('addBlock');
const schedule = document.getElementById('schedule');
const tablePreview = document.getElementById('tablePreview');
const downloadBtn = document.getElementById('downloadBtn');

let loadedRows = [];
let scheduleBlocks = [];

function parseHTMLTable(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  const table = doc.querySelector('table');
  if (!table) return [];

  const rows = [];
  const trs = table.querySelectorAll('tr');
  if (!trs.length) return rows;

  // Detect header indexes
  const headerCells = Array.from(trs[0].querySelectorAll('th,td')).map(c => c.textContent.trim().toLowerCase());
  const idxCurso = headerCells.findIndex(t => t.includes('curso') || t.includes('materia') || t.includes('asignatura'));
  const idxProfesor = headerCells.findIndex(t => t.includes('docente') || t.includes('profesor') || t.includes('teacher'));
  const idxHorario = headerCells.findIndex(t => t.includes('horario') || t.includes('hora'));
  const idxGrupo = headerCells.findIndex(t => t.includes('grupo') || t.includes('secc') || t.includes('sección') || t.includes('seccion'));

  for (let i = 1; i < trs.length; i++) {
    const cells = Array.from(trs[i].querySelectorAll('th,td')).map(c => c.textContent.trim());
    if (cells.length < 3) continue;

    let curso = '';
    let profesor = '';
    let horario = '';
    let grupo = '';

    if (idxCurso !== -1) curso = cells[idxCurso] ?? '';
    if (idxProfesor !== -1) profesor = cells[idxProfesor] ?? '';
    if (idxHorario !== -1) horario = cells[idxHorario] ?? '';
    if (idxGrupo !== -1) grupo = cells[idxGrupo] ?? '';

    // If any required header not found, fallback to the first 4 columns
    if (!curso && !profesor && !horario) {
      if (cells.length >= 4) {
        curso = cells[0];
        profesor = cells[3] || cells[1];
        horario = cells[4] || cells[2];
        grupo = cells[1] || cells[3] || '';
      } else {
        continue;
      }
    }

    // If group is still empty, set as "--"
    if (!grupo) grupo = '—';

    if (!curso || !profesor || !horario) continue;

    rows.push({curso, profesor, horario, grupo});
  }

  return rows;
}

function updateSelects() {
  const cursos = [...new Set(loadedRows.map(r => r.curso))];
  courseSelect.innerHTML = '<option value="">-- seleccione curso --</option>' + cursos.map(c => `<option value="${c}">${c}</option>`).join('');
  teacherSelect.innerHTML = '<option value="">-- primero selecciona curso --</option>';
  timeSelect.innerHTML = '<option value="">-- primero selecciona profesor --</option>';
  renderTablePreview();
}

function updateTeacherAndTime() {
  const curso = courseSelect.value;
  if (!curso) {
    teacherSelect.innerHTML = '<option value="">-- primero selecciona curso --</option>';
    timeSelect.innerHTML = '<option value="">-- primero selecciona profesor --</option>';
    return;
  }
  const byCourse = loadedRows.filter(r => r.curso === curso);
  const teachers = [...new Set(byCourse.map(r => r.profesor))];
  teacherSelect.innerHTML = '<option value="">-- seleccione profesor --</option>' + teachers.map(t => `<option value="${t}">${t}</option>`).join('');
  timeSelect.innerHTML = '<option value="">-- primero selecciona profesor --</option>';
}

function updateTime() {
  const curso = courseSelect.value;
  const profesor = teacherSelect.value;
  if (!curso || !profesor) {
    timeSelect.innerHTML = '<option value="">-- primero selecciona profesor --</option>';
    return;
  }
  const options = loadedRows.filter(r => r.curso === curso && r.profesor === profesor)
    .map(r => r.horario);
  const unique = [...new Set(options)];
  timeSelect.innerHTML = '<option value="">-- seleccione horario --</option>' + unique.map(t => `<option value="${t}">${t}</option>`).join('');
}

function renderTablePreview() {
  if (!loadedRows.length) {
    tablePreview.innerHTML = '<p class="hint">No hay datos cargados. Carga un HTML con tabla.</p>';
    return;
  }
  let html = '<table style="width:100%;border-collapse:collapse;">';
  html += '<tr><th style="border:1px solid #d9e2f0;padding:.35rem;background:#eef3ff">Curso</th><th style="border:1px solid #d9e2f0;padding:.35rem;background:#eef3ff">Profesor</th><th style="border:1px solid #d9e2f0;padding:.35rem;background:#eef3ff">Horario</th><th style="border:1px solid #d9e2f0;padding:.35rem;background:#eef3ff">Grupo</th></tr>';
  loadedRows.forEach(r => {
    html += `<tr><td style="border:1px solid #e4eaf6;padding:.3rem">${r.curso}</td><td style="border:1px solid #e4eaf6;padding:.3rem">${r.profesor}</td><td style="border:1px solid #e4eaf6;padding:.3rem">${r.horario}</td><td style="border:1px solid #e4eaf6;padding:.3rem">${r.grupo}</td></tr>`;
  });
  html += '</table>';
  tablePreview.innerHTML = html;
}

function renderSchedule() {
  if (!scheduleBlocks.length) {
    schedule.innerHTML = '<p class="hint">Aún no hay bloques agregados.</p>';
    return;
  }
  schedule.innerHTML = scheduleBlocks.map((b, i) =>
    `<div class="block"><span>${b.curso} - ${b.profesor} - ${b.horario}</span><button data-index="${i}">X</button></div>`
  ).join('');
  schedule.querySelectorAll('button[data-index]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.index);
      scheduleBlocks.splice(idx, 1);
      renderSchedule();
    });
  });
}

fileInput.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    loadedRows = parseHTMLTable(reader.result);
    if (!loadedRows.length) {
      alert('No se detectó tabla con curso/profesor/horario. Asegúrate de que tu HTML incluya una tabla con al menos 4 columnas.');
      return;
    }
    updateSelects();
  };
  reader.readAsText(file);
});

loadExample.addEventListener('click', () => {
  const sample = `<!DOCTYPE html><html><body><table><tr><th>Curso</th><th>Profesor</th><th>Horario</th><th>Grupo</th></tr><tr><td>Matemáticas I</td><td>Ing. Ruiz</td><td>Lun 8:00-10:00</td><td>A</td></tr><tr><td>Física I</td><td>Profa. Gómez</td><td>Mar 10:00-12:00</td><td>B</td></tr><tr><td>Programación</td><td>Lic. Pérez</td><td>Mié 14:00-16:00</td><td>A</td></tr></table></body></html>`;
  loadedRows = parseHTMLTable(sample);
  updateSelects();
});

courseSelect.addEventListener('change', updateTeacherAndTime);
teacherSelect.addEventListener('change', updateTime);

addBlock.addEventListener('click', () => {
  const curso = courseSelect.value;
  const profesor = teacherSelect.value;
  const horario = timeSelect.value;
  if (!curso || !profesor || !horario) {
    alert('Selecciona curso, profesor y horario antes de agregar.');
    return;
  }
  if (scheduleBlocks.some(b => b.curso === curso && b.horario === horario)) {
    alert('Ya agregaste este curso en el mismo horario. Elimina primero si quieres cambiarlo.');
    return;
  }
  scheduleBlocks.push({curso, profesor, horario});
  renderSchedule();
});

downloadBtn.addEventListener('click', () => {
  if (!scheduleBlocks.length) {
    alert('Agrega al menos un bloque antes de descargar.');
    return;
  }
  const data = JSON.stringify(scheduleBlocks, null, 2);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'horario.json';
  a.click();
  URL.revokeObjectURL(url);
});

renderTablePreview();
renderSchedule();
