// ============================================================
// GradePrep - Student Performance Tracker & PDF Generator
// Pure JS + LocalStorage
// ============================================================

const STORAGE_KEY = 'student_records';

// --- Utility Helpers ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function generateId() {
  return 'std_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

function getGrade(pct) {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// --- LocalStorage CRUD ---
function loadStudents() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveStudents(students) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

function addStudent(data) {
  const students = loadStudents();
  const pct = parseFloat(((data.correctAnswers / data.totalQuestions) * 100).toFixed(1));
  students.push({
    id: generateId(),
    name: data.name.trim(),
    gradeClass: data.gradeClass.trim(),
    totalQuestions: data.totalQuestions,
    correctAnswers: data.correctAnswers,
    percentage: pct,
    grade: getGrade(pct),
    createdAt: new Date().toISOString()
  });
  saveStudents(students);
}

function updateStudent(id, data) {
  const students = loadStudents();
  const idx = students.findIndex(s => s.id === id);
  if (idx === -1) return;
  const pct = parseFloat(((data.correctAnswers / data.totalQuestions) * 100).toFixed(1));
  Object.assign(students[idx], {
    name: data.name.trim(),
    gradeClass: data.gradeClass.trim(),
    totalQuestions: data.totalQuestions,
    correctAnswers: data.correctAnswers,
    percentage: pct,
    grade: getGrade(pct)
  });
  saveStudents(students);
}

function deleteStudent(id) {
  saveStudents(loadStudents().filter(s => s.id !== id));
}

// --- State ---
let selectedIds = new Set();
let editingId = null;

// --- DOM References ---
const form = $('#student-form');
const nameInput = $('#student-name');
const classInput = $('#student-class');
const totalInput = $('#total-questions');
const correctInput = $('#correct-answers');
const hiddenId = $('#student-id');
const submitBtn = $('#submit-btn');
const cancelBtn = $('#cancel-btn');
const formTitle = $('#form-title');
const formSubtitle = $('#form-subtitle');
const tableBody = $('#student-rows');
const emptyState = $('#empty-state-view');
const searchInput = $('#search-input');
const sortSelect = $('#sort-select');
const selectAllCb = $('#select-all-checkbox');
const printSelectedBtn = $('#print-selected-btn');
const printAllBtn = $('#print-all-btn');
const selectedCountEl = $('#selected-count');
const clearAllBtn = $('#clear-all-btn');
const themeToggle = $('#theme-toggle');
const headerDate = $('#header-date');

// Stat elements
const statTotal = $('#stat-total');
const statAverage = $('#stat-average');
const statAverageTrend = $('#stat-average-trend');
const statHigh = $('#stat-high');
const statHighStudent = $('#stat-high-student');
const statLow = $('#stat-low');

// Grade chart
const countA = $('#count-A');
const countB = $('#count-B');
const countC = $('#count-C');
const countD = $('#count-D');
const countF = $('#count-F');
const chartBars = $$('.chart-bar-fill');

// Modal
const modal = $('#print-preview-modal');
const closeModalBtn = $('#close-modal-btn');
const triggerPrintBtn = $('#trigger-print-btn');
const printSheetContent = $('#print-sheet-content');
const printOnlyContainer = $('#print-only-container');

// Print config inputs
const printTitleInput = $('#print-title');
const printSubtitleInput = $('#print-subtitle');
const showDateCb = $('#show-print-date');
const showClassCb = $('#show-print-class');
const showGradeCb = $('#show-print-grade');
const showStatsCb = $('#show-print-stats');
const showSignCb = $('#show-print-sign');

// --- Set header date ---
headerDate.textContent = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// --- Theme ---
function initTheme() {
  const saved = localStorage.getItem('gradeprep_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('gradeprep_theme', next);
});

// --- Rendering ---
function getFilteredStudents() {
  let students = loadStudents();
  const query = searchInput.value.toLowerCase().trim();
  if (query) students = students.filter(s => s.name.toLowerCase().includes(query));

  const sort = sortSelect.value;
  students.sort((a, b) => {
    switch (sort) {
      case 'date-desc': return new Date(b.createdAt) - new Date(a.createdAt);
      case 'date-asc': return new Date(a.createdAt) - new Date(b.createdAt);
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'score-desc': return b.percentage - a.percentage;
      case 'score-asc': return a.percentage - b.percentage;
      default: return 0;
    }
  });
  return students;
}

function renderTable() {
  const students = getFilteredStudents();
  tableBody.innerHTML = '';

  if (students.length === 0) {
    emptyState.classList.remove('hidden');
    $('#students-table').style.display = 'none';
  } else {
    emptyState.classList.add('hidden');
    $('#students-table').style.display = '';
  }

  students.forEach(s => {
    const tr = document.createElement('tr');
    const checked = selectedIds.has(s.id) ? 'checked' : '';
    tr.innerHTML = `
      <td class="col-checkbox">
        <label class="checkbox-container">
          <input type="checkbox" class="row-checkbox" data-id="${s.id}" ${checked}>
          <span class="checkmark"></span>
        </label>
      </td>
      <td class="col-name">${escapeHtml(s.name)}</td>
      <td class="col-class">${escapeHtml(s.gradeClass || '—')}</td>
      <td class="col-score text-center">${s.correctAnswers} / ${s.totalQuestions}</td>
      <td class="col-pct text-center">${s.percentage}%</td>
      <td class="col-grade text-center"><span class="grade-badge ${s.grade.toLowerCase()}">${s.grade}</span></td>
      <td class="col-actions text-right">
        <button class="btn-row-action edit" data-id="${s.id}" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="btn-row-action delete" data-id="${s.id}" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>`;
    tableBody.appendChild(tr);
  });

  updateSelectionUI();
  updateStats();
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// --- Stats ---
function updateStats() {
  const all = loadStudents();
  statTotal.textContent = all.length;

  if (all.length === 0) {
    statAverage.textContent = '0.0%';
    statAverageTrend.textContent = 'No data';
    statAverageTrend.className = 'stat-trend neutral';
    statHigh.textContent = 'N/A';
    statHighStudent.textContent = '—';
    statLow.textContent = '0';
  } else {
    const avg = (all.reduce((s, x) => s + x.percentage, 0) / all.length).toFixed(1);
    statAverage.textContent = avg + '%';
    statAverageTrend.textContent = avg >= 70 ? 'Above passing' : 'Below passing';
    statAverageTrend.className = 'stat-trend ' + (avg >= 70 ? 'positive' : 'negative');

    const best = all.reduce((a, b) => a.percentage > b.percentage ? a : b);
    statHigh.textContent = best.percentage + '%';
    statHighStudent.textContent = best.name;

    statLow.textContent = all.filter(s => s.percentage < 60).length;
  }

  updateGradeChart(all);
}

function updateGradeChart(all) {
  const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  all.forEach(s => counts[s.grade]++);
  const max = Math.max(...Object.values(counts), 1);

  countA.textContent = counts.A;
  countB.textContent = counts.B;
  countC.textContent = counts.C;
  countD.textContent = counts.D;
  countF.textContent = counts.F;

  const fills = $$('.chart-bar-fill');
  const grades = ['A', 'B', 'C', 'D', 'F'];
  // Order in DOM: A(green), B(purple), C(blue), D(orange), F(red)
  fills.forEach((bar, i) => {
    const pct = (counts[grades[i]] / max) * 100;
    setTimeout(() => { bar.style.width = pct + '%'; }, 50 * i);
  });
}

// --- Selection Logic ---
function updateSelectionUI() {
  const checkboxes = $$('.row-checkbox');
  const totalVisible = checkboxes.length;
  const checkedCount = selectedIds.size;

  selectedCountEl.textContent = checkedCount;
  printSelectedBtn.disabled = checkedCount === 0;
  selectAllCb.checked = totalVisible > 0 && checkedCount >= totalVisible;
}

tableBody.addEventListener('change', (e) => {
  if (!e.target.classList.contains('row-checkbox')) return;
  const id = e.target.dataset.id;
  if (e.target.checked) selectedIds.add(id); else selectedIds.delete(id);
  updateSelectionUI();
});

selectAllCb.addEventListener('change', () => {
  const checkboxes = $$('.row-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = selectAllCb.checked;
    if (selectAllCb.checked) selectedIds.add(cb.dataset.id);
    else selectedIds.delete(cb.dataset.id);
  });
  updateSelectionUI();
});

// --- Form Handling ---
function clearForm() {
  form.reset();
  hiddenId.value = '';
  editingId = null;
  formTitle.textContent = 'Add New Student';
  formSubtitle.textContent = 'Enter exam details below';
  submitBtn.querySelector('span').textContent = 'Add Student';
  cancelBtn.classList.add('hidden');
  $$('.form-group').forEach(g => g.classList.remove('has-error'));
}

function validateForm() {
  let valid = true;
  const name = nameInput.value.trim();
  const total = parseInt(totalInput.value);
  const correct = parseInt(correctInput.value);

  $$('.form-group').forEach(g => g.classList.remove('has-error'));

  if (!name) { nameInput.closest('.form-group').classList.add('has-error'); valid = false; }
  if (!total || total < 1) { totalInput.closest('.form-group').classList.add('has-error'); valid = false; }
  if (isNaN(correct) || correct < 0 || correct > total) { correctInput.closest('.form-group').classList.add('has-error'); valid = false; }
  return valid;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const data = {
    name: nameInput.value,
    gradeClass: classInput.value,
    totalQuestions: parseInt(totalInput.value),
    correctAnswers: parseInt(correctInput.value)
  };

  if (editingId) {
    updateStudent(editingId, data);
  } else {
    addStudent(data);
  }
  clearForm();
  renderTable();
});

cancelBtn.addEventListener('click', clearForm);

// --- Edit & Delete ---
tableBody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.btn-row-action.edit');
  const deleteBtn = e.target.closest('.btn-row-action.delete');

  if (editBtn) {
    const id = editBtn.dataset.id;
    const s = loadStudents().find(x => x.id === id);
    if (!s) return;
    editingId = id;
    hiddenId.value = id;
    nameInput.value = s.name;
    classInput.value = s.gradeClass;
    totalInput.value = s.totalQuestions;
    correctInput.value = s.correctAnswers;
    formTitle.textContent = 'Edit Student';
    formSubtitle.textContent = 'Modify details and save';
    submitBtn.querySelector('span').textContent = 'Save Changes';
    cancelBtn.classList.remove('hidden');
    nameInput.focus();
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    if (confirm('Delete this student record?')) {
      deleteStudent(id);
      selectedIds.delete(id);
      renderTable();
    }
  }
});

// --- Clear All ---
clearAllBtn.addEventListener('click', () => {
  if (loadStudents().length === 0) return;
  if (confirm('Are you sure you want to delete ALL student records? This cannot be undone.')) {
    localStorage.removeItem(STORAGE_KEY);
    selectedIds.clear();
    clearForm();
    renderTable();
  }
});

// --- Search & Sort ---
searchInput.addEventListener('input', renderTable);
sortSelect.addEventListener('change', renderTable);

// --- Print Preview Modal ---
function openPrintModal(studentsToPrint) {
  modal.classList.remove('hidden');
  modal._studentsToPrint = studentsToPrint;
  renderPrintPreview();
  document.body.style.overflow = 'hidden';
}

function closePrintModal() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

closeModalBtn.addEventListener('click', closePrintModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closePrintModal(); });

// Config changes re-render preview
[printTitleInput, printSubtitleInput].forEach(el => el.addEventListener('input', renderPrintPreview));
[showDateCb, showClassCb, showGradeCb, showStatsCb, showSignCb].forEach(el => el.addEventListener('change', renderPrintPreview));

printSelectedBtn.addEventListener('click', () => {
  const all = loadStudents();
  const selected = all.filter(s => selectedIds.has(s.id));
  if (selected.length === 0) return;
  openPrintModal(selected);
});

printAllBtn.addEventListener('click', () => {
  const all = loadStudents();
  if (all.length === 0) { alert('No students to print.'); return; }
  openPrintModal(all);
});

function renderPrintPreview() {
  const students = modal._studentsToPrint || [];
  const title = printTitleInput.value || 'Student Performance Report';
  const subtitle = printSubtitleInput.value || '';
  const showDate = showDateCb.checked;
  const showClass = showClassCb.checked;
  const showGrade = showGradeCb.checked;
  const showStats = showStatsCb.checked;
  const showSign = showSignCb.checked;

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const avg = students.length ? (students.reduce((s, x) => s + x.percentage, 0) / students.length).toFixed(1) : '0.0';
  const high = students.length ? Math.max(...students.map(s => s.percentage)) : 0;
  const low = students.length ? Math.min(...students.map(s => s.percentage)) : 0;

  let html = `
    <div class="print-header">
      <div class="print-header-left">
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <div class="print-header-right">
        ${showDate ? `<span class="print-date">Generated: ${today}</span>` : ''}
      </div>
    </div>`;

  if (showStats) {
    html += `
    <div class="print-stats-summary">
      <div class="print-stat-item"><span>Students</span><h3>${students.length}</h3></div>
      <div class="print-stat-item"><span>Average</span><h3>${avg}%</h3></div>
      <div class="print-stat-item"><span>Highest</span><h3>${high}%</h3></div>
      <div class="print-stat-item"><span>Lowest</span><h3>${low}%</h3></div>
    </div>`;
  }

  html += `<table class="print-table"><thead><tr>
    <th>#</th><th>Student Name</th>
    ${showClass ? '<th>Class / Group</th>' : ''}
    <th>Score</th><th>Percentage</th>
    ${showGrade ? '<th>Grade</th>' : ''}
  </tr></thead><tbody>`;

  students.forEach((s, i) => {
    html += `<tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(s.name)}</td>
      ${showClass ? `<td>${escapeHtml(s.gradeClass || '—')}</td>` : ''}
      <td>${s.correctAnswers} / ${s.totalQuestions}</td>
      <td>${s.percentage}%</td>
      ${showGrade ? `<td><span class="print-badge ${s.grade.toLowerCase()}">${s.grade}</span></td>` : ''}
    </tr>`;
  });

  html += '</tbody></table>';

  if (showSign) {
    html += `
    <div class="print-signatures">
      <div class="signature-line-wrapper">
        <div class="signature-line"></div>
        <span>Authorized Signature</span>
      </div>
    </div>`;
  }

  printSheetContent.innerHTML = html;
}

// --- Trigger actual browser print ---
triggerPrintBtn.addEventListener('click', () => {
  printOnlyContainer.innerHTML = '';
  const clone = printSheetContent.cloneNode(true);
  clone.classList.add('preview-canvas');
  printOnlyContainer.appendChild(clone);
  closePrintModal();
  setTimeout(() => window.print(), 200);
});

// --- Init ---
initTheme();
renderTable();
