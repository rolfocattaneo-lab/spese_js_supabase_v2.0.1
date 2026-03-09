/*import { $, euro, ymd, parseAmount, fillSelect, getMultiSelectValues, message, confirmDelete, fileToMeta, downloadText, todayRange } from './ui.js';*/
import { $, euro, ymd, parseAmount, fillSelect, getMultiSelectValues, message, confirmDelete, fileToMeta, downloadText, todayRange, escapeHtml } from './ui.js';
import { buildReportHtml, buildAiReportHtml, openPdfPreview } from './report.js';
import { exportExpensesCsv, exportRecurringCsv, importExpensesCsv, importRecurringCsv } from './csv.js';
import { ping, subjectsApi, accountsApi, categoriesApi, expensesApi, attachmentsApi, recurringApi } from './api.js';
import { STORAGE_LIMIT_BYTES, STORAGE_WARN_RATIO, STORAGE_ALERT_RATIO, STORAGE_BLOCK_RATIO, ENABLE_AI_TAB } from './config.js';
import { generateAiAnalysis } from './aiApi.js';

const state = {
  subjects: [],
  accounts: [],
  categories: [],
  expenses: [],
  recurring: [],
  defaultSubjectId: localStorage.getItem('defaultSubjectId') || ''
};

bootstrap().catch(handleError);

/*async function bootstrap() {
  bindTabs();
  bindActions();
  applyAiTabVisibility();
  initMobileCollapsibles();
  setDefaultDates();
  await reloadAll();
  window.addEventListener('resize', () => renderExpenses());
}*/
async function bootstrap() {
  bindTabs();
  bindActions();
  applyAiTabVisibility();
  initMobileCollapsibles();
  setDefaultDates();

  await reloadAll();

  // genera automaticamente le ricorrenze dovute
  await autoGenerateRecurring();

  await refreshExpenses();
  await reloadRecurring();

  window.addEventListener('resize', () => renderExpenses());
}

function bindTabs() {
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x => x.classList.add('hidden'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.remove('hidden');
  }));
}

function bindActions() {
  $('btnPing')?.addEventListener('click', testConnection);
  $('btnAddSubject')?.addEventListener('click', onAddSubject);
  $('btnAddCategory')?.addEventListener('click', onAddCategory);
  $('btnAddAccount')?.addEventListener('click', onAddAccount);
  $('btnAddExpense')?.addEventListener('click', onAddExpense);
  $('btnClearExpense')?.addEventListener('click', clearExpenseForm);
  $('btnApplyFilters')?.addEventListener('click', refreshExpenses);
  $('btnResetFilters')?.addEventListener('click', resetExpenseFilters);
  $('btnRefreshExpenses')?.addEventListener('click', refreshExpenses);

  $('e_account')?.addEventListener('change', syncExpenseSubjectsForAccount);
  $('e_subject')?.addEventListener('change', applyDefaultAccountToExpenseForm);

  $('m_account')?.addEventListener('change', syncEditSubjectsForAccount);

  $('r_account')?.addEventListener('change', syncRecurringSubjectsForAccount);
  $('r_subject')?.addEventListener('change', applyDefaultAccountToRecurringForm);

  $('btnSaveExpenseChanges')?.addEventListener('click', onSaveExpenseChanges);
  $('btnCloseExpenseDialog')?.addEventListener('click', () => $('editExpenseDialog').close());
  $('btnSaveRecurringChanges')?.addEventListener('click', onSaveRecurringChanges);
  $('btnCloseRecurringDialog')?.addEventListener('click', () => $('editRecurringDialog').close());
  $('btnAddRecurring')?.addEventListener('click', onAddRecurring);
  $('btnGenerateRecurring')?.addEventListener('click', onGenerateRecurring);
  $('btnExportExpensesCsv')?.addEventListener('click', onExportExpensesCsv);
  $('btnExportRecurringCsv')?.addEventListener('click', onExportRecurringCsv);
  $('btnImportCsv')?.addEventListener('click', onImportCsv);
  $('btnPreviewReport')?.addEventListener('click', onPreviewReport);
  $('btnPreviewAiReport')?.addEventListener('click', () => onPreviewAiReport().catch(handleError));

$('defaultSubjectSelect')?.addEventListener('change', (e) => {
  const subjectId = e.target.value || '';
  setDefaultSubjectId(subjectId);

  initExpenseFormDefaults();
  initRecurringFormDefaults();

  if ($('f_subject')) $('f_subject').value = subjectId;
  if ($('rp_subject')) $('rp_subject').value = subjectId;
  if ($('ai_subject')) $('ai_subject').value = subjectId;
});

  $('btnSaveSubjectChanges')?.addEventListener('click', onSaveSubjectChanges);
  $('btnCloseSubjectDialog')?.addEventListener('click', () => $('editSubjectDialog').close());
}

function applyAiTabVisibility() {
  const btn = $('aiTabButton');
  const panel = $('tab-ai');
  if (!btn || !panel) return;

  if (ENABLE_AI_TAB) {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
    panel.classList.add('hidden');
  }
}

function initMobileCollapsibles() {
  document.querySelectorAll('.collapsibleToggle').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth > 900) return;

      const card = btn.closest('.collapsibleCard');
      if (!card) return;

      card.classList.toggle('mobileOpen');
    });
  });
}

function getDefaultSubjectId() {
  return state.defaultSubjectId || '';
}

function setDefaultSubjectId(subjectId) {
  state.defaultSubjectId = subjectId || '';
  localStorage.setItem('defaultSubjectId', state.defaultSubjectId);
}

function renderDefaultSubjectSelect() {
  const sel = $('defaultSubjectSelect');
  if (!sel) return;

  sel.innerHTML = '<option value="">Nessuno</option>';

  for (const s of state.subjects) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name || s.email || s.id;
    sel.appendChild(opt);
  }

  sel.value = getDefaultSubjectId();
}

function applyDefaultSubjectToExpenseForm() {
  initExpenseFormDefaults();
}

function applyDefaultSubjectToRecurringForm() {
  initRecurringFormDefaults();
}

function applyDefaultSubjectToFilters() {
  const subjectId = getDefaultSubjectId();
  if ($('f_subject')) $('f_subject').value = subjectId;
}

function applyDefaultSubjectToReport() {
  const subjectId = getDefaultSubjectId();
  if ($('rp_subject')) $('rp_subject').value = subjectId;
}

function applyDefaultSubjectToAiReport() {
  const subjectId = getDefaultSubjectId();
  if ($('ai_subject')) $('ai_subject').value = subjectId;
}

function initExpenseFormDefaults() {
  const subjectId = getDefaultSubjectId();

  fillSelect($('e_subject'), state.subjects);

  if ($('e_subject')) {
    $('e_subject').value = subjectId || '';
  }

  applyDefaultAccountToExpenseForm();
}

function initRecurringFormDefaults() {
  const subjectId = getDefaultSubjectId();

  fillSelect($('r_subject'), state.subjects);

  if ($('r_subject')) {
    $('r_subject').value = subjectId || '';
  }

  applyDefaultAccountToRecurringForm();
}

function getSubjectDefaultAccountId(subjectId) {
  if (!subjectId) return '';

  const subject = state.subjects.find(x => x.id === subjectId);
  return subject?.default_account_id || '';
}

function applyDefaultAccountToExpenseForm() {
  const subjectId = $('e_subject')?.value || '';
  const defaultAccountId = getSubjectDefaultAccountId(subjectId);

  if (!$('e_account')) return;

  if (!defaultAccountId) {
    $('e_account').value = '';
    return;
  }

  const account = state.accounts.find(x => x.id === defaultAccountId);
  if (!account) {
    $('e_account').value = '';
    return;
  }

  if ((account.subject_ids || []).includes(subjectId)) {
    $('e_account').value = defaultAccountId;
  } else {
    $('e_account').value = '';
  }
}

function applyDefaultAccountToRecurringForm() {
  const subjectId = $('r_subject')?.value || '';
  const defaultAccountId = getSubjectDefaultAccountId(subjectId);

  if (!$('r_account')) return;

  if (!defaultAccountId) {
    $('r_account').value = '';
    return;
  }

  const account = state.accounts.find(x => x.id === defaultAccountId);
  if (!account) {
    $('r_account').value = '';
    return;
  }

  if ((account.subject_ids || []).includes(subjectId)) {
    $('r_account').value = defaultAccountId;
  } else {
    $('r_account').value = '';
  }
}

function setDefaultDates() {

  const { from, to } = todayRange();
  const today = ymd(new Date());

  // FILTRI SPESE → oggi
  $('f_from').value = today;
  $('f_to').value = today;

  // REPORT → mese corrente
  $('rp_from').value = from;
  $('rp_to').value = to;

  // AI → mese corrente
  if ($('ai_from')) $('ai_from').value = from;
  if ($('ai_to')) $('ai_to').value = to;

  // NUOVA SPESA
  $('e_date').value = today;

  // RICORRENZA
  $('r_start').value = today;
}

async function testConnection() {
  try {
    await ping();
    $('connectionBadge').textContent = 'Connesso';
    $('connectionBadge').className = 'pill ok';
    message('Connessione Supabase riuscita.', 'ok');
  } catch (err) {
    $('connectionBadge').textContent = 'Errore';
    $('connectionBadge').className = 'pill danger';
    handleError(err);
  }
}

async function reloadAll() {
  await reloadSubjects();
  await reloadCategories();
  await reloadAccounts();
  await reloadRecurring();

  renderDefaultSubjectSelect();

  initExpenseFormDefaults();
  initRecurringFormDefaults();

  applyDefaultSubjectToFilters();
  applyDefaultSubjectToReport();
  applyDefaultSubjectToAiReport();

  await refreshExpenses();
  await refreshStorageBadge();
}

async function reloadSubjects() {
  state.subjects = await subjectsApi.list();
  fillSelect($('e_subject'), state.subjects);
  fillSelect($('f_subject'), state.subjects, { includeEmpty: true, emptyText: 'Tutti' });
  fillSelect($('rp_subject'), state.subjects, { includeEmpty: true, emptyText: 'Tutti' });
  fillSelect($('ai_subject'), state.subjects, { includeEmpty: true, emptyText: 'Tutti' });
  fillSelect($('r_subject'), state.subjects);
  fillSelect($('m_subject'), state.subjects);
  fillSelect($('a_subjects'), state.subjects);
  renderSubjects();
}

async function reloadCategories() {
  state.categories = await categoriesApi.list();
  fillSelect($('e_category'), state.categories);
  fillSelect($('f_category'), state.categories, { includeEmpty: true, emptyText: 'Tutte' });
  fillSelect($('rp_category'), state.categories, { includeEmpty: true, emptyText: 'Tutte' });
  fillSelect($('ai_category'), state.categories, { includeEmpty: true, emptyText: 'Tutte' });
  fillSelect($('r_category'), state.categories);
  fillSelect($('m_category'), state.categories);
  renderCategories();
}

async function reloadAccounts() {
  state.accounts = await accountsApi.list();

  fillSelect($('e_account'), state.accounts);
  fillSelect($('f_account'), state.accounts, { includeEmpty: true, emptyText: 'Tutti' });
  fillSelect($('rp_account'), state.accounts, { includeEmpty: true, emptyText: 'Tutti' });
  fillSelect($('ai_account'), state.accounts, { includeEmpty: true, emptyText: 'Tutti' });
  fillSelect($('r_account'), state.accounts);
  fillSelect($('m_account'), state.accounts);

  renderAccounts();
  await syncEditSubjectsForAccount();
}

async function reloadRecurring() {
  state.recurring = await recurringApi.list();
  renderRecurring();
}

async function refreshExpenses() {
  const filters = {
    from: $('f_from').value || null,
    to: $('f_to').value || null,
    subject_id: $('f_subject').value || null,
    account_id: $('f_account').value || null,
    category_id: $('f_category').value || null,
    text: $('f_text').value.trim() || null
  };
  state.expenses = await expensesApi.list(filters);
  renderExpenses();
}

async function refreshStorageBadge() {
  const used = await attachmentsApi.storageUsage();
  const ratio = used / STORAGE_LIMIT_BYTES;
  const pct = Math.round(ratio * 100);
  $('storageBadge').textContent = `Storage: ${pct}%`;
  $('storageBadge').className = 'pill';
  if (ratio >= STORAGE_BLOCK_RATIO) $('storageBadge').classList.add('danger');
  else if (ratio >= STORAGE_ALERT_RATIO) $('storageBadge').classList.add('warn');
  else if (ratio >= STORAGE_WARN_RATIO) $('storageBadge').classList.add('ok');
}

function selectedAccount() {
  return state.accounts.find(x => x.id === $('e_account').value) || null;
}

async function syncExpenseSubjectsForAccount() {
  const account = selectedAccount();

  if (!account) {
    fillSelect($('e_subject'), state.subjects);
    applyDefaultSubjectToExpenseForm();
    return;
  }

  const rows = account.subject_ids?.length
    ? state.subjects.filter(s => account.subject_ids.includes(s.id))
    : await accountsApi.subjectsForAccount(account.id);

  fillSelect($('e_subject'), rows);

  const defaultId = getDefaultSubjectId();
  if (defaultId && rows.some(x => x.id === defaultId)) {
    $('e_subject').value = defaultId;
  }
}

async function syncEditSubjectsForAccount() {
  const accountId = $('m_account').value;
  if (!accountId) return fillSelect($('m_subject'), state.subjects);

  const account = state.accounts.find(x => x.id === accountId);
  const rows = account?.subject_ids?.length
    ? state.subjects.filter(s => account.subject_ids.includes(s.id))
    : await accountsApi.subjectsForAccount(accountId);

  fillSelect($('m_subject'), rows);
}

async function syncRecurringSubjectsForAccount() {
  const accountId = $('r_account').value;
  if (!accountId) return fillSelect($('r_subject'), state.subjects);

  const account = state.accounts.find(x => x.id === accountId);
  const rows = account?.subject_ids?.length
    ? state.subjects.filter(s => account.subject_ids.includes(s.id))
    : await accountsApi.subjectsForAccount(accountId);

  fillSelect($('r_subject'), rows);
}

async function autoGenerateRecurring() {

  const today = new Date();

  for (const rec of state.recurring) {

    const dueDates = getDueDates(rec, today);

    for (const due of dueDates) {

      await expensesApi.create({
        account_id: rec.account_id,
        subject_id: rec.subject_id,
        category_id: rec.category_id,
        description: rec.description,
        amount: rec.amount,
        expense_date: due,
        notes: rec.notes || null,
        recurring_expense_id: rec.id
      });

    }

    if (dueDates.length) {

      await recurringApi.update(rec.id, {
        last_generated_date: dueDates[dueDates.length - 1]
      });

    }

  }

}

async function onAddSubject() {
  const name = $('s_name').value.trim();
  if (!name) throw new Error('Nome soggetto obbligatorio.');

  await subjectsApi.create({
    name,
    email: $('s_email').value.trim() || null,
    notes: $('s_notes').value.trim() || null
  });

  $('s_name').value = '';
  $('s_email').value = '';
  $('s_notes').value = '';

  await reloadSubjects();
  renderDefaultSubjectSelect();
  message('Soggetto salvato.');
}

async function onAddCategory() {
  const name = $('c_name').value.trim();
  if (!name) throw new Error('Nome categoria obbligatorio.');

  await categoriesApi.create({
    name,
    description: $('c_desc').value.trim() || null,
    color: $('c_color').value.trim() || null,
    icon: $('c_icon').value.trim() || null
  });

  $('c_name').value = '';
  $('c_desc').value = '';
  $('c_color').value = '';
  $('c_icon').value = '';

  await reloadCategories();
  message('Categoria salvata.');
}

async function onAddAccount() {
  const name = $('a_name').value.trim();
  if (!name) throw new Error('Nome conto obbligatorio.');

  const subjectIds = getMultiSelectValues($('a_subjects'));
  if (!subjectIds.length) throw new Error('Seleziona almeno un soggetto per il conto.');

  await accountsApi.create({
    name,
    description: $('a_desc').value.trim() || null,
    subjectIds
  });

  $('a_name').value = '';
  $('a_desc').value = '';
  [...$('a_subjects').options].forEach(o => { o.selected = false; });

  await reloadAccounts();
  message('Conto salvato.');
}

async function onAddExpense() {
  const amount = parseAmount($('e_amount').value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Importo non valido.');

  const payload = {
    account_id: $('e_account').value,
    subject_id: $('e_subject').value,
    category_id: $('e_category').value,
    description: $('e_desc').value.trim(),
    amount,
    expense_date: $('e_date').value,
    notes: $('e_notes').value.trim() || null
  };

  validateExpensePayload(payload);

  const expense = await expensesApi.create(payload);
  const file = $('e_attach').files[0];

  if (file) {
    const meta = await fileToMeta(file);
    await attachmentsApi.upload({ expenseId: expense.id, ...meta });
  }

  clearExpenseForm();
  await refreshExpenses();
  await refreshStorageBadge();
  message('Spesa salvata.');
}

function clearExpenseForm() {
  if ($('e_account')) $('e_account').value = '';
  if ($('e_category')) $('e_category').value = '';
  if ($('e_desc')) $('e_desc').value = '';
  if ($('e_amount')) $('e_amount').value = '';
  if ($('e_notes')) $('e_notes').value = '';
  if ($('e_attach')) $('e_attach').value = '';
  if ($('e_date')) $('e_date').value = ymd(new Date());

  applyDefaultSubjectToExpenseForm();
}

function clearRecurringForm() {
  if ($('r_desc')) $('r_desc').value = '';
  if ($('r_amount')) $('r_amount').value = '';
  if ($('r_notes')) $('r_notes').value = '';
  if ($('r_end')) $('r_end').value = '';
  if ($('r_interval')) $('r_interval').value = '1';
  if ($('r_frequency')) $('r_frequency').value = 'monthly';
  if ($('r_start')) $('r_start').value = ymd(new Date());
  if ($('r_category')) $('r_category').value = '';
  if ($('r_account')) $('r_account').value = '';

  fillSelect($('r_subject'), state.subjects);
  applyDefaultSubjectToRecurringForm();
}

function validateExpensePayload(payload) {
  if (!payload.account_id) throw new Error('Conto obbligatorio.');
  if (!payload.subject_id) throw new Error('Soggetto obbligatorio.');
  if (!payload.category_id) throw new Error('Categoria obbligatoria.');
  if (!payload.description) throw new Error('Descrizione obbligatoria.');
  if (!payload.expense_date) throw new Error('Data obbligatoria.');

  const account = state.accounts.find(a => a.id === payload.account_id);
  if (!account || !(account.subject_ids || []).includes(payload.subject_id)) {
    throw new Error('Il soggetto selezionato non è associato al conto.');
  }
}

function renderExpenses() {
  const tbody = $('tbodyExpenses');
  if (tbody) tbody.innerHTML = '';

  const expenses = [...state.expenses].sort(
    (a, b) => new Date(a.expense_date) - new Date(b.expense_date)
  );

  let total = 0;

  for (const item of expenses) {
    total += Number(item.amount || 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(item.expense_date || '-')}</td>
      <td>${item.subject_name || '-'}</td>
      <td>${item.account_name || '-'}</td>
      <td>${item.category_name || '-'}</td>
      <td class="expenseDescCell">${item.description || '-'}</td>
      <td class="r amountCell">${euro(item.amount)}</td>
      <td>${renderAttachmentLinks(item.attachments)}</td>
      <td class="actionsCell r">
        <button class="small" data-edit-expense="${item.id}">Modifica</button>
        <button class="small danger" data-del-expense="${item.id}">Elimina</button>
      </td>
    `;
    tbody.append(tr);
  }

  $('kpiFiltered').textContent = `Righe: ${expenses.length}`;
  $('kpiTotal').textContent = `Totale: ${euro(total)}`;

  tbody.querySelectorAll('[data-edit-expense]').forEach(btn =>
    btn.addEventListener('click', () => openEditExpense(btn.dataset.editExpense))
  );

  tbody.querySelectorAll('[data-del-expense]').forEach(btn =>
    btn.addEventListener('click', () => onDeleteExpense(btn.dataset.delExpense))
  );

  tbody.querySelectorAll('[data-open-attachment]').forEach(btn =>
    btn.addEventListener('click', () => window.open(btn.dataset.openAttachment, '_blank'))
  );

  renderMobileExpenses(expenses);
}

function renderMobileExpenses(expenses = state.expenses) {
  const box = $('mobileExpensesList');
  if (!box) return;

  box.innerHTML = '';

  if (!expenses.length) {
    box.innerHTML = `<div class="mobileExpenseEmpty">Nessuna spesa trovata.</div>`;
    return;
  }

  for (const item of expenses) {
    const card = document.createElement('details');
    card.className = 'mobileExpenseCard';

    card.innerHTML = `
      <summary>
        <div class="mobileExpenseSummary">
          <div class="mobileExpenseMain">
            <div class="mobileExpenseTitle">${item.description || '-'}</div>
            <div class="mobileExpenseMeta">${escapeHtml(item.expense_date || '-')} · ${item.category_name || '-'}</div>
          </div>
          <div class="mobileExpenseAmount">${euro(item.amount)}</div>
        </div>
      </summary>

      <div class="mobileExpenseBody">
        <div class="mobileExpenseGrid">
          <div><span class="muted">Soggetto</span><strong>${item.subject_name || '-'}</strong></div>
          <div><span class="muted">Conto</span><strong>${item.account_name || '-'}</strong></div>
          <div><span class="muted">Categoria</span><strong>${item.category_name || '-'}</strong></div>
          <div><span class="muted">Data</span><strong>${escapeHtml(item.expense_date || '-')}</strong></div>
        </div>

        ${item.notes ? `
          <div class="mobileExpenseNotes">
            <span class="muted">Note</span>
            <div>${item.notes}</div>
          </div>
        ` : ''}

        <div class="mobileExpenseAttachments">
          <span class="muted">Ricevute</span>
          <div>${renderAttachmentLinks(item.attachments)}</div>
        </div>

        <div class="actions mobileExpenseActions">
          <button class="small" data-edit-expense="${item.id}">Modifica</button>
          <button class="small danger" data-del-expense="${item.id}">Elimina</button>
        </div>
      </div>
    `;

    box.append(card);
  }

  box.querySelectorAll('[data-edit-expense]').forEach(btn =>
    btn.addEventListener('click', () => openEditExpense(btn.dataset.editExpense))
  );

  box.querySelectorAll('[data-del-expense]').forEach(btn =>
    btn.addEventListener('click', () => onDeleteExpense(btn.dataset.delExpense))
  );

  box.querySelectorAll('[data-open-attachment]').forEach(btn =>
    btn.addEventListener('click', () => window.open(btn.dataset.openAttachment, '_blank'))
  );
}

function renderAttachmentLinks(attachments) {
  if (!attachments?.length) return '-';
  return attachments
    .map(a => `<button class="linkBtn" data-open-attachment="${attachmentsApi.getPublicUrl(a.storage_path)}">${a.file_name}</button>`)
    .join(' ');
}

function renderSubjects() {
  const tbody = $('tbodySubjects');
  tbody.innerHTML = '';

  for (const item of state.subjects) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.email || ''}</td>
      <td class="actionsCell">
        <button class="small" data-edit-subject="${item.id}">Modifica</button>
        <button class="small danger" data-del-subject="${item.id}">Elimina</button>
      </td>
    `;

    tbody.append(tr);
  }

  tbody.querySelectorAll('[data-edit-subject]').forEach(btn =>
    btn.addEventListener('click', () => openEditSubject(btn.dataset.editSubject))
  );

  tbody.querySelectorAll('[data-del-subject]').forEach(btn =>
    btn.addEventListener('click', () => onDeleteSubject(btn.dataset.delSubject))
  );

  renderMobileSubjects();
}

function renderMobileSubjects(subjects = state.subjects) {
  const box = $('mobileSubjectsList');
  if (!box) return;

  box.innerHTML = '';

  if (!subjects.length) {
    box.innerHTML = `<div class="mobileExpenseEmpty">Nessun soggetto trovato.</div>`;
    return;
  }

  for (const item of subjects) {
    const card = document.createElement('details');
    card.className = 'mobileExpenseCard';

    card.innerHTML = `
      <summary>
        <div class="mobileExpenseSummary">
          <div class="mobileExpenseMain">
            <div class="mobileExpenseTitle">${item.name || '-'}</div>
            <div class="mobileExpenseMeta">${item.email || 'Nessuna email'}</div>
          </div>
        </div>
      </summary>

      <div class="mobileExpenseBody">
        <div class="mobileExpenseGrid">
          <div>
            <span class="muted">Email</span>
            <strong>${item.email || '-'}</strong>
          </div>
          <div>
            <span class="muted">Conto predefinito</span>
            <strong>${state.accounts.find(a => a.id === item.default_account_id)?.name || '-'}</strong>
          </div>
        </div>

        ${item.notes ? `
          <div class="mobileExpenseNotes">
            <span class="muted">Note</span>
            <div>${item.notes}</div>
          </div>
        ` : ''}

        <div class="actions mobileExpenseActions">
          <button class="small" data-edit-subject="${item.id}">Modifica</button>
          <button class="small danger" data-del-subject="${item.id}">Elimina</button>
        </div>
      </div>
    `;

    box.append(card);
  }

  box.querySelectorAll('[data-edit-subject]').forEach(btn =>
    btn.addEventListener('click', () => openEditSubject(btn.dataset.editSubject))
  );

  box.querySelectorAll('[data-del-subject]').forEach(btn =>
    btn.addEventListener('click', () => onDeleteSubject(btn.dataset.delSubject))
  );
}

function renderAccounts() {
  const tbody = $('tbodyAccounts');
  tbody.innerHTML = '';

  for (const item of state.accounts) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.description || ''}</td>
      <td>${(item.subject_names || []).join(', ')}</td>
      <td class="actionsCell">
        <button class="small danger" data-del-account="${item.id}">Elimina</button>
      </td>
    `;
    tbody.append(tr);
  }

  tbody.querySelectorAll('[data-del-account]').forEach(btn =>
    btn.addEventListener('click', () => onDeleteAccount(btn.dataset.delAccount))
  );

  renderMobileAccounts();
}

function renderMobileAccounts(accounts = state.accounts) {
  const box = $('mobileAccountsList');
  if (!box) return;

  box.innerHTML = '';

  if (!accounts.length) {
    box.innerHTML = `<div class="mobileExpenseEmpty">Nessun conto trovato.</div>`;
    return;
  }

  for (const item of accounts) {
    const card = document.createElement('details');
    card.className = 'mobileExpenseCard';

    card.innerHTML = `
      <summary>
        <div class="mobileExpenseSummary">
          <div class="mobileExpenseMain">
            <div class="mobileExpenseTitle">${item.name || '-'}</div>
            <div class="mobileExpenseMeta">${item.description || 'Nessuna descrizione'}</div>
          </div>
        </div>
      </summary>

      <div class="mobileExpenseBody">
        <div class="mobileExpenseGrid">
          <div>
            <span class="muted">Descrizione</span>
            <strong>${item.description || '-'}</strong>
          </div>
          <div>
            <span class="muted">Soggetti</span>
            <strong>${(item.subject_names || []).join(', ') || '-'}</strong>
          </div>
        </div>

        <div class="actions mobileExpenseActions">
          <button class="small danger" data-del-account="${item.id}">Elimina</button>
        </div>
      </div>
    `;

    box.append(card);
  }

  box.querySelectorAll('[data-del-account]').forEach(btn =>
    btn.addEventListener('click', () => onDeleteAccount(btn.dataset.delAccount))
  );
}


function renderCategories() {
  const tbody = $('tbodyCategories');
  tbody.innerHTML = '';

  for (const item of state.categories) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.description || ''}</td>
      <td class="actionsCell">
        <button class="small danger" data-del-category="${item.id}">Elimina</button>
      </td>
    `;
    tbody.append(tr);
  }

  tbody.querySelectorAll('[data-del-category]').forEach(btn =>
    btn.addEventListener('click', () => onDeleteCategory(btn.dataset.delCategory))
  );

  renderMobileCategories();
}

function renderMobileCategories(categories = state.categories) {
  const box = $('mobileCategoriesList');
  if (!box) return;

  box.innerHTML = '';

  if (!categories.length) {
    box.innerHTML = `<div class="mobileExpenseEmpty">Nessuna categoria trovata.</div>`;
    return;
  }

  for (const item of categories) {
    const card = document.createElement('details');
    card.className = 'mobileExpenseCard';

    card.innerHTML = `
      <summary>
        <div class="mobileExpenseSummary">
          <div class="mobileExpenseMain">
            <div class="mobileExpenseTitle">${item.name || '-'}</div>
            <div class="mobileExpenseMeta">${item.description || 'Nessuna descrizione'}</div>
          </div>
        </div>
      </summary>

      <div class="mobileExpenseBody">
        <div class="mobileExpenseGrid">
          <div>
            <span class="muted">Descrizione</span>
            <strong>${item.description || '-'}</strong>
          </div>
          <div>
            <span class="muted">Colore</span>
            <strong>${item.color || '-'}</strong>
          </div>
          <div>
            <span class="muted">Icona</span>
            <strong>${item.icon || '-'}</strong>
          </div>
        </div>

        <div class="actions mobileExpenseActions">
          <button class="small danger" data-del-category="${item.id}">Elimina</button>
        </div>
      </div>
    `;

    box.append(card);
  }

  box.querySelectorAll('[data-del-category]').forEach(btn =>
    btn.addEventListener('click', () => onDeleteCategory(btn.dataset.delCategory))
  );
}

function renderRecurring() {
  const tbody = $('tbodyRecurring');
  tbody.innerHTML = '';

  for (const item of state.recurring) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${item.description || '-'}</td>
      <td>${item.frequency || '-'} / ${item.interval_value || '-'}</td>
      <td>${escapeHtml(item.end_date || '-')}</td>
      <td>${escapeHtml(item.last_generated_date || '-')}</td>
      <td class="actionsCell">
        <button class="small" data-edit-recurring="${item.id}">Modifica</button>
        <button class="small danger" data-del-recurring="${item.id}">Elimina</button>
      </td>
    `;

    tbody.append(tr);
  }

  tbody.querySelectorAll('[data-edit-recurring]').forEach(btn =>
    btn.addEventListener('click', () => openEditRecurring(btn.dataset.editRecurring))
  );

  tbody.querySelectorAll('[data-del-recurring]').forEach(btn =>
    btn.addEventListener('click', () => onDeleteRecurring(btn.dataset.delRecurring))
  );
  renderMobileRecurring(state.recurring);
}

function renderMobileRecurring(recurring = state.recurring) {

  const box = $('mobileRecurringList');
  if (!box) return;

  box.innerHTML = '';

  if (!recurring.length) {
    box.innerHTML = `<div class="mobileExpenseEmpty">Nessuna ricorrenza.</div>`;
    return;
  }

  for (const item of recurring) {

    const card = document.createElement('details');
    card.className = 'mobileExpenseCard';

    card.innerHTML = `
      <summary>
        <div class="mobileExpenseSummary">

          <div class="mobileExpenseMain">
            <div class="mobileExpenseTitle">${item.description || '-'}</div>
            <div class="mobileExpenseMeta">
              ${item.frequency} · ogni ${item.interval_value}
            </div>
          </div>

        </div>
      </summary>

      <div class="mobileExpenseBody">

        <div class="mobileExpenseGrid">

          <div>
            <span class="muted">Data fine</span>
            <strong>${item.end_date || '-'}</strong>
          </div>

          <div>
            <span class="muted">Ultima generazione</span>
            <strong>${item.last_generated_date || '-'}</strong>
          </div>

        </div>

        <div class="actions mobileExpenseActions">

          <button class="small" data-edit-recurring="${item.id}">
            Modifica
          </button>

          <button class="small danger" data-del-recurring="${item.id}">
            Elimina
          </button>

        </div>

      </div>
    `;

    box.append(card);
  }

  box.querySelectorAll('[data-edit-recurring]').forEach(btn =>
    btn.addEventListener('click', () => openEditRecurring(btn.dataset.editRecurring))
  );

  box.querySelectorAll('[data-del-recurring]').forEach(btn =>
    btn.addEventListener('click', () => onDeleteRecurring(btn.dataset.delRecurring))
  );

}

async function openEditExpense(expenseId) {
  const item = state.expenses.find(x => x.id === expenseId);
  if (!item) return;

  $('m_expense_id').value = item.id;
  $('m_account').value = item.account_id;
  await syncEditSubjectsForAccount();
  $('m_subject').value = item.subject_id;
  $('m_category').value = item.category_id;
  $('m_date').value = item.expense_date;
  $('m_desc').value = item.description;
  $('m_amount').value = String(item.amount).replace('.', ',');
  $('m_notes').value = item.notes || '';
  $('editExpenseDialog').showModal();
}

async function openEditRecurring(recurringId) {
  const item = state.recurring.find(x => x.id === recurringId);
  if (!item) return;

  $('mr_recurring_id').value = item.id;
  $('mr_subject').value = item.subject_name || '';
  $('mr_account').value = item.account_name || '';
  $('mr_category').value = item.category_name || '';
  $('mr_frequency').value = item.frequency || '';
  $('mr_interval').value = String(item.interval_value || '');
  $('mr_start').value = item.start_date || '';
  $('mr_desc').value = item.description || '';
  $('mr_amount').value = String(item.amount ?? '').replace('.', ',');
  $('mr_end').value = item.end_date || '';
  $('mr_notes').value = item.notes || '';

  $('editRecurringDialog').showModal();
}

async function onSaveRecurringChanges() {
  const recurringId = $('mr_recurring_id').value;
  const item = state.recurring.find(x => x.id === recurringId);
  if (!item) throw new Error('Ricorrenza non trovata.');

  const endDate = $('mr_end').value || null;
  const notes = $('mr_notes').value.trim() || null;

  if (endDate && item.start_date && endDate < item.start_date) {
    throw new Error('La data fine non può essere precedente alla data inizio.');
  }

  if (endDate && item.last_generated_date && endDate < item.last_generated_date) {
    throw new Error('La data fine non può essere precedente all’ultima data già generata.');
  }

  await recurringApi.update(recurringId, {
    end_date: endDate,
    notes
  });

  $('editRecurringDialog').close();
  await reloadRecurring();
  message('Ricorrenza aggiornata.');
}

async function onSaveExpenseChanges() {
  const payload = {
    account_id: $('m_account').value,
    subject_id: $('m_subject').value,
    category_id: $('m_category').value,
    description: $('m_desc').value.trim(),
    amount: parseAmount($('m_amount').value),
    expense_date: $('m_date').value,
    notes: $('m_notes').value.trim() || null
  };

  validateExpensePayload(payload);
  await expensesApi.update($('m_expense_id').value, payload);
  $('editExpenseDialog').close();
  await refreshExpenses();
  message('Spesa aggiornata.');
}

async function onDeleteExpense(id) {
  const item = state.expenses.find(x => x.id === id);
  if (!item || !confirmDelete(item.description)) return;

  for (const att of item.attachments || []) {
    await attachmentsApi.remove(att);
  }

  await expensesApi.remove(id);
  await refreshExpenses();
  await refreshStorageBadge();
  message('Spesa eliminata.');
}

async function onDeleteSubject(id) {
  const item = state.subjects.find(x => x.id === id);
  if (!item || !confirmDelete(item.name)) return;

  await subjectsApi.remove(id);
  await reloadAll();
  message('Soggetto eliminato.');
}

async function onDeleteAccount(id) {
  const item = state.accounts.find(x => x.id === id);
  if (!item || !confirmDelete(item.name)) return;

  await accountsApi.remove(id);
  await reloadAll();
  message('Conto eliminato.');
}

async function onDeleteCategory(id) {
  const item = state.categories.find(x => x.id === id);
  if (!item || !confirmDelete(item.name)) return;

  await categoriesApi.remove(id);
  await reloadAll();
  message('Categoria eliminata.');
}

async function onAddRecurring() {
  const payload = {
    account_id: $('r_account').value,
    subject_id: $('r_subject').value,
    category_id: $('r_category').value,
    description: $('r_desc').value.trim(),
    amount: parseAmount($('r_amount').value),
    notes: $('r_notes').value.trim() || null,
    frequency: $('r_frequency').value,
    interval_value: Number($('r_interval').value || 1),
    start_date: $('r_start').value,
    end_date: $('r_end').value || null,
    last_generated_date: null
  };

  validateExpensePayload({ ...payload, expense_date: payload.start_date });

  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error('Importo ricorrenza non valido.');
  }

  /*await recurringApi.create(payload);

  await reloadRecurring();
  message('Ricorrenza salvata.');*/
  const rec = await recurringApi.create(payload);

// genera subito le dovute della nuova ricorrenza
const dueDates = getDueDates(rec, new Date());

for (const due of dueDates) {

  await expensesApi.create({
    account_id: rec.account_id,
    subject_id: rec.subject_id,
    category_id: rec.category_id,
    description: rec.description,
    amount: rec.amount,
    expense_date: due,
    notes: rec.notes || null,
    recurring_expense_id: rec.id
  });

}

if (dueDates.length) {

  await recurringApi.update(rec.id, {
    last_generated_date: dueDates[dueDates.length - 1]
  });

}

await reloadRecurring();
await refreshExpenses();

message('Ricorrenza salvata.');
}

async function onGenerateRecurring() {
  const today = new Date();
  const generated = [];

  for (const rec of state.recurring) {
    const dueDates = getDueDates(rec, today);

    for (const due of dueDates) {
      await expensesApi.create({
        account_id: rec.account_id,
        subject_id: rec.subject_id,
        category_id: rec.category_id,
        description: rec.description,
        amount: rec.amount,
        expense_date: due,
        notes: rec.notes || null,
        recurring_expense_id: rec.id
      });

      generated.push(`${rec.description} (${due})`);
    }

    if (dueDates.length) {
      await recurringApi.update(rec.id, {
        last_generated_date: dueDates[dueDates.length - 1]
      });
    }
  }

  await reloadRecurring();
  await refreshExpenses();
  clearRecurringForm();

  message(generated.length ? `Generate ${generated.length} spese ricorrenti.` : 'Nessuna ricorrenza dovuta.');
}

function getDueDates(rec, untilDate) {
  const out = [];
  const start = new Date(rec.start_date);
  const end = rec.end_date ? new Date(rec.end_date) : null;

  let current = rec.last_generated_date
    ? nextDate(new Date(rec.last_generated_date), rec.frequency, rec.interval_value)
    : start;

  while (current <= untilDate) {
    if (!end || current <= end) out.push(ymd(current));
    current = nextDate(current, rec.frequency, rec.interval_value);
    if (out.length > 100) break;
  }

  return out;
}

function nextDate(date, frequency, interval) {
  const d = new Date(date);
  if (frequency === 'daily') d.setDate(d.getDate() + interval);
  if (frequency === 'weekly') d.setDate(d.getDate() + (7 * interval));
  if (frequency === 'monthly') d.setMonth(d.getMonth() + interval);
  if (frequency === 'yearly') d.setFullYear(d.getFullYear() + interval);
  return d;
}

async function onDeleteRecurring(id) {
  const item = state.recurring.find(x => x.id === id);
  if (!item) return;

  const confirm = window.confirm(
    "Eliminare questa ricorrenza?\n\nVerranno eliminate anche tutte le spese generate automaticamente."
  );

  if (!confirm) return;

  await recurringApi.remove(id);

  await reloadRecurring();
  await refreshExpenses();

  message('Ricorrenza e spese generate eliminate.');
}

function resetExpenseFilters() {
  const { from, to } = todayRange();
  $('f_from').value = from;
  $('f_to').value = to;
  applyDefaultSubjectToFilters();
  $('f_account').value = '';
  $('f_category').value = '';
  $('f_text').value = '';
  refreshExpenses().catch(handleError);
}

async function openEditSubject(id) {
  const subject = state.subjects.find(s => s.id === id);

  if (!subject) return;

  $('ms_subject_id').value = subject.id;
  $('ms_name').value = subject.name || '';
  $('ms_email').value = subject.email || '';
  $('ms_notes').value = subject.notes || '';

  const accounts = state.accounts.filter(a =>
    (a.subject_ids || []).includes(subject.id)
  );

  fillSelect(
    $('ms_default_account'),
    accounts,
    { includeEmpty: true, emptyText: 'Nessuno' }
  );

  $('ms_default_account').value = subject.default_account_id || '';

  $('editSubjectDialog').showModal();
}

async function onSaveSubjectChanges() {
  const id = $('ms_subject_id').value;

  const payload = {
    email: $('ms_email').value.trim() || null,
    notes: $('ms_notes').value.trim() || null,
    default_account_id: $('ms_default_account').value || null
  };

  await subjectsApi.update(id, payload);

  $('editSubjectDialog').close();

  await reloadSubjects();

  message('Soggetto aggiornato.');
}

async function onExportExpensesCsv() {
  const rows = await expensesApi.list({});
  const normalized = rows.map(x => ({
    id: x.id,
    account_id: x.account_id,
    subject_id: x.subject_id,
    category_id: x.category_id,
    description: x.description,
    amount: x.amount,
    expense_date: x.expense_date,
    notes: x.notes || ''
  }));

  downloadText(
    `spese_${ymd(new Date())}.csv`,
    exportExpensesCsv(normalized),
    'text/csv;charset=utf-8'
  );
}

async function onExportRecurringCsv() {
  const rows = await recurringApi.list();
  const normalized = rows.map(x => ({
    id: x.id,
    account_id: x.account_id,
    subject_id: x.subject_id,
    category_id: x.category_id,
    description: x.description,
    amount: x.amount,
    notes: x.notes || '',
    frequency: x.frequency,
    interval_value: x.interval_value,
    start_date: x.start_date,
    end_date: x.end_date || '',
    last_generated_date: x.last_generated_date || ''
  }));

  downloadText(
    `ricorrenze_${ymd(new Date())}.csv`,
    exportRecurringCsv(normalized),
    'text/csv;charset=utf-8'
  );
}

async function onImportCsv() {
  const file = $('importFile').files[0];
  if (!file) throw new Error('Seleziona un file CSV.');

  const text = await file.text();
  const kind = $('importKind').value;
  let count = 0;

  if (kind === 'expenses') {
    const rows = importExpensesCsv(text);
    for (const row of rows) validateExpensePayload(row);
    if (rows.length) await expensesApi.bulkInsert(rows);
    count = rows.length;
    await refreshExpenses();
  } else {
    const rows = importRecurringCsv(text);
    for (const row of rows) validateExpensePayload({ ...row, expense_date: row.start_date });
    if (rows.length) await recurringApi.bulkInsert(rows);
    count = rows.length;
    await reloadRecurring();
  }

  $('importResult').textContent = `Righe importate: ${count}`;
  message('Import completato.');
}

async function onPreviewReport() {
  const rows = await expensesApi.list({
    from: $('rp_from').value || null,
    to: $('rp_to').value || null,
    subject_id: $('rp_subject').value || null,
    account_id: $('rp_account').value || null,
    category_id: $('rp_category').value || null
  });

  openPdfPreview(buildReportHtml({
    filters: {
      from: $('rp_from').value,
      to: $('rp_to').value,
      subjectName: state.subjects.find(x => x.id === $('rp_subject').value)?.name || '',
      accountName: state.accounts.find(x => x.id === $('rp_account').value)?.name || '',
      categoryName: state.categories.find(x => x.id === $('rp_category').value)?.name || ''
    },
    expenses: rows
  }));
}

function getSelectedLabel(selectId, rows) {
  const value = $(selectId)?.value || '';
  return rows.find(x => x.id === value)?.name || '';
}

function sumAmounts(rows) {
  return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

function shiftYmdByMonths(dateStr, monthsBack) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const date = new Date(y, (m - 1) - monthsBack, d || 1);
  return ymd(date);
}

function buildCategoryGrowth(currentRows, previousRows) {
  const currentMap = new Map();
  const previousMap = new Map();

  for (const row of currentRows) {
    const key = row.category_name || 'Altro';
    currentMap.set(key, Number(currentMap.get(key) || 0) + Number(row.amount || 0));
  }

  for (const row of previousRows) {
    const key = row.category_name || 'Altro';
    previousMap.set(key, Number(previousMap.get(key) || 0) + Number(row.amount || 0));
  }

  const names = new Set([...currentMap.keys(), ...previousMap.keys()]);

  return [...names].map(name => {
    const current = Number(currentMap.get(name) || 0);
    const previous = Number(previousMap.get(name) || 0);
    const delta = current - previous;
    return {
      name,
      current_total: current,
      previous_total: previous,
      delta,
      delta_pct: previous > 0 ? Number(((delta / previous) * 100).toFixed(2)) : null
    };
  }).sort((a, b) => b.delta - a.delta).slice(0, 6);
}

function buildAnomalies(currentRows, previousRows) {
  const previousByCategory = new Map();

  for (const row of previousRows) {
    const key = row.category_name || 'Altro';
    if (!previousByCategory.has(key)) previousByCategory.set(key, []);
    previousByCategory.get(key).push(Number(row.amount || 0));
  }

  const anomalies = [];

  for (const row of currentRows) {
    const key = row.category_name || 'Altro';
    const history = previousByCategory.get(key) || [];
    if (!history.length) continue;

    const amount = Number(row.amount || 0);
    const avg = history.reduce((sum, value) => sum + value, 0) / history.length;
    const max = Math.max(...history);

    if ((avg > 0 && amount >= avg * 1.8) || amount > max) {
      anomalies.push({
        description: row.description || '',
        category: key,
        amount,
        expense_date: row.expense_date,
        historical_avg: Number(avg.toFixed(2)),
        historical_max: Number(max.toFixed(2))
      });
    }
  }

  return anomalies
    .sort((a, b) => (b.amount - b.historical_avg) - (a.amount - a.historical_avg))
    .slice(0, 5);
}

function normalizeTextKey(value) {
  return String(value || '').trim().toLowerCase();
}

function buildRecurringComparison(currentRows, previousRows) {
  const recurringDefs = state.recurring.map(item => ({
    name: item.description || '',
    account_id: item.account_id || '',
    subject_id: item.subject_id || '',
    category_id: item.category_id || '',
    frequency: item.frequency || ''
  }));

  const keyFor = (item) => [
    normalizeTextKey(item.name || item.description),
    item.account_id || '',
    item.subject_id || '',
    item.category_id || ''
  ].join('|');

  const currentMap = new Map();
  const previousMap = new Map();
  const defMap = new Map(recurringDefs.map(item => [keyFor(item), item]));

  for (const row of currentRows) {
    const key = keyFor(row);
    if (!defMap.has(key)) continue;
    currentMap.set(key, Number(currentMap.get(key) || 0) + Number(row.amount || 0));
  }

  for (const row of previousRows) {
    const key = keyFor(row);
    if (!defMap.has(key)) continue;
    previousMap.set(key, Number(previousMap.get(key) || 0) + Number(row.amount || 0));
  }

  const trendLabel = {
    increase: 'In aumento',
    decrease: 'In diminuzione',
    stable: 'Stabile',
    missing: 'Assente nel periodo',
    new: 'Nuova nel periodo'
  };

  return [...defMap.entries()].map(([key, item]) => {
    const current = Number(currentMap.get(key) || 0);
    const previous = Number(previousMap.get(key) || 0);
    let trend = 'stable';

    if (current > 0 && previous === 0) trend = 'new';
    else if (current === 0 && previous > 0) trend = 'missing';
    else if (current > previous) trend = 'increase';
    else if (current < previous) trend = 'decrease';

    return {
      name: item.name,
      frequency: item.frequency,
      current,
      previous,
      difference: Number((current - previous).toFixed(2)),
      difference_pct: previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(2)) : null,
      trend,
      trend_label: trendLabel[trend]
    };
  })
    .filter(item => item.current > 0 || item.previous > 0)
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .slice(0, 8);
}

async function onPreviewAiReport() {
  if (!ENABLE_AI_TAB) {
    throw new Error('Tab AI disabilitato in configurazione.');
  }

  const from = $('ai_from').value || null;
  const to = $('ai_to').value || null;
  if (!from || !to) throw new Error('Seleziona il periodo da analizzare.');

  const monthsBack = Math.max(1, Number($('ai_compare_months').value || 1));
  const compareFrom = shiftYmdByMonths(from, monthsBack);
  const compareTo = shiftYmdByMonths(to, monthsBack);

  const currentFilters = {
    from,
    to,
    subject_id: $('ai_subject').value || null,
    account_id: $('ai_account').value || null,
    category_id: $('ai_category').value || null
  };

  const previousFilters = {
    ...currentFilters,
    from: compareFrom,
    to: compareTo
  };

  message('Generazione analisi AI in corso...', 'ok');

  const [currentRows, previousRows] = await Promise.all([
    expensesApi.list(currentFilters),
    expensesApi.list(previousFilters)
  ]);

  const recurringRows = buildRecurringComparison(currentRows, previousRows);
  const categoryGrowth = buildCategoryGrowth(currentRows, previousRows);
  const anomalies = buildAnomalies(currentRows, previousRows);

  const payload = {
    filters: {
      period_from: from,
      period_to: to,
      compare_from: compareFrom,
      compare_to: compareTo,
      compare_months_back: monthsBack,
      subject: getSelectedLabel('ai_subject', state.subjects) || 'tutti',
      account: getSelectedLabel('ai_account', state.accounts) || 'tutti',
      category: getSelectedLabel('ai_category', state.categories) || 'tutte'
    },
    summary: {
      current_total: Number(sumAmounts(currentRows).toFixed(2)),
      previous_total: Number(sumAmounts(previousRows).toFixed(2)),
      current_count: currentRows.length,
      previous_count: previousRows.length
    },
    anomalies,
    recurring: recurringRows,
    category_growth: categoryGrowth
  };

  const aiText = await generateAiAnalysis(payload);

  const html = buildAiReportHtml({
    filters: {
      from,
      to,
      subjectName: getSelectedLabel('ai_subject', state.subjects) || '',
      accountName: getSelectedLabel('ai_account', state.accounts) || '',
      categoryName: getSelectedLabel('ai_category', state.categories) || ''
    },
    expenses: currentRows,
    compareInfo: {
      from: compareFrom,
      to: compareTo,
      monthsBack
    },
    aiText,
    recurringRows
  });

  openPdfPreview(html);
  message('Report AI generato.');
}

function handleError(err) {
  console.error(err);
  message(err?.message || String(err), 'danger');
}