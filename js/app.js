/**
 * DompetQu - Main Application Controller
 * SPA routing, Modals, CRUD event listeners, PWA support, & Quick Transaction modal.
 */

import { AuthService } from './auth.js';
import { PundiService } from './pundi.js';
import { TransactionService } from './transaction.js';
import { CategoryService } from './category.js';
import { GoalService } from './goals.js';
import { ReportService } from './reports.js';
import { DashboardManager } from './dashboard.js';
import { SettingsService } from './settings.js';
import { Validator } from './validation.js';
import { showToast, initNetworkStatus, formatFriendlyError } from './notifications.js';
import { Currency, DateUtil, BudgetUtil, debounce, escapeHtml, refreshIcons } from './utils.js';

let currentUser = null;
let currentView = 'dashboard';
let cachedPundis = [];
let cachedCategories = [];
let cachedTransactions = [];
let cachedGoals = [];

// DOM references
const dom = {
  bootScreen: document.getElementById('boot-screen'),
  appShell: document.getElementById('app-shell'),
  userDisplayNames: document.querySelectorAll('.user-display-name'),
  userEmails: document.querySelectorAll('.user-display-email'),
  topbarTitle: document.getElementById('topbar-title'),

  // Views
  views: {
    dashboard: document.getElementById('view-dashboard'),
    pundi: document.getElementById('view-pundi'),
    transactions: document.getElementById('view-transactions'),
    goals: document.getElementById('view-goals'),
    reports: document.getElementById('view-reports'),
    settings: document.getElementById('view-settings')
  },

  // Navigation Links
  navLinks: document.querySelectorAll('[data-view]'),

  // Dashboard elements
  dash: {
    totalBalanceEl: document.getElementById('dash-total-balance'),
    monthIncomeEl: document.getElementById('dash-month-income'),
    monthExpenseEl: document.getElementById('dash-month-expense'),
    netCashFlowEl: document.getElementById('dash-net-cash'),
    widgetIncome: document.getElementById('widget-income'),
    widgetExpense: document.getElementById('widget-expense'),
    widgetNet: document.getElementById('widget-net'),
    warningsContainer: document.getElementById('dash-budget-warnings'),
    pundiListContainer: document.getElementById('dash-pundi-list'),
    chartCanvas: document.getElementById('dash-expense-chart'),
    chartLegend: document.getElementById('dash-expense-legend'),
    recentTxContainer: document.getElementById('dash-recent-tx')
  },

  // Modals & Dialogs
  modalTx: document.getElementById('modal-tx'),
  formTx: document.getElementById('form-tx'),
  modalPundi: document.getElementById('modal-pundi'),
  formPundi: document.getElementById('form-pundi'),
  modalGoal: document.getElementById('modal-goal'),
  formGoal: document.getElementById('form-goal'),
  modalAddGoalSaving: document.getElementById('modal-goal-saving'),
  formGoalSaving: document.getElementById('form-goal-saving'),
  modalCategories: document.getElementById('modal-categories'),
  formCategory: document.getElementById('form-category'),
  btnOpenCatModal: document.getElementById('btn-open-cat-modal'),
  settingsCatChips: document.getElementById('settings-categories-chips'),
  modalProfile: document.getElementById('modal-profile'),
  btnTopbarProfile: document.getElementById('btn-topbar-profile'),
  topbarAvatarInitial: document.getElementById('topbar-avatar-initial'),
  profileModalAvatar: document.getElementById('profile-modal-avatar'),
  modalChangelog: document.getElementById('modal-changelog'),
  modalConfirm: document.getElementById('modal-confirm'),
  btnConfirmAction: document.getElementById('btn-confirm-action'),
  confirmMessage: document.getElementById('confirm-message'),
  confirmSub: document.getElementById('confirm-sub')
};

/* ==========================================================================
   CUSTOM SELECT DROPDOWN COMPONENT (Replaces Native Browser UI)
   ========================================================================== */

const CustomSelect = {
  initialized: new Set(),

  init(selectId) {
    const select = document.getElementById(selectId);
    if (!select || this.initialized.has(selectId)) return;
    this.initialized.add(selectId);

    const wrapper = select.closest('.custom-select-wrapper');
    if (!wrapper) return;

    const trigger = wrapper.querySelector('.custom-select-trigger');
    if (!trigger) return;

    // Toggle menu on trigger click
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrapper.classList.contains('is-open');
      CustomSelect.closeAll();
      if (!isOpen) {
        wrapper.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    // Native select change event should update custom trigger
    select.addEventListener('change', () => {
      CustomSelect.updateTrigger(select);
    });
  },

  sync(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    if (!this.initialized.has(selectId)) {
      this.init(selectId);
    }

    const wrapper = select.closest('.custom-select-wrapper');
    if (!wrapper) return;

    const dropdown = wrapper.querySelector('.custom-select-dropdown');
    if (!dropdown) return;

    dropdown.innerHTML = '';
    const options = Array.from(select.options);

    options.forEach(opt => {
      if (!opt.value) return; // Skip empty placeholder

      let colorDot = '';
      let subText = '';
      let mainText = opt.text;

      // Extract balance if option text is "Nama Pundi (Rp 1.000.000)"
      const matchPundi = opt.text.match(/^(.*?)\s*(\(Rp\s*[\d\.\,]+\))$/);
      if (matchPundi) {
        mainText = matchPundi[1].trim();
        subText = matchPundi[2].trim();
      }

      const pundiMatch = cachedPundis.find(p => p.id === opt.value);
      if (pundiMatch) {
        colorDot = `<span class="legend-dot" style="--c: ${pundiMatch.color || '#10B981'}; width: 10px; height: 10px; flex-shrink: 0; margin:0;"></span>`;
        subText = Currency.format(pundiMatch.balance || 0);
      } else {
        const catMatch = cachedCategories.find(c => c.id === opt.value);
        if (catMatch) {
          colorDot = `<span class="legend-dot" style="--c: ${catMatch.color || '#10B981'}; width: 10px; height: 10px; flex-shrink: 0; margin:0;"></span>`;
        }
      }

      const isSelected = (opt.value === select.value);

      const item = document.createElement('div');
      item.className = `custom-select-option ${isSelected ? 'is-selected' : ''}`;
      item.setAttribute('role', 'option');
      item.setAttribute('data-value', opt.value);
      item.innerHTML = `
        <div class="custom-select-option-main">
          ${colorDot}
          <span class="custom-select-option-label">${escapeHtml(mainText)}</span>
        </div>
        ${subText ? `<span class="custom-select-option-sub">${escapeHtml(subText)}</span>` : ''}
        ${isSelected ? '<i data-lucide="check" class="custom-select-check"></i>' : ''}
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        select.value = opt.value;
        CustomSelect.updateTrigger(select);
        CustomSelect.closeAll();
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.dispatchEvent(new Event('input', { bubbles: true }));
      });

      dropdown.appendChild(item);
    });

    refreshIcons();
    CustomSelect.updateTrigger(select);
  },

  updateTrigger(select) {
    if (!select) return;
    const wrapper = select.closest('.custom-select-wrapper');
    if (!wrapper) return;

    const valEl = wrapper.querySelector('.custom-select-value');
    if (!valEl) return;

    const selectedOption = select.options[select.selectedIndex];
    if (!selectedOption || !selectedOption.value) {
      const placeholderText = select.options[0]?.text || 'Pilih...';
      valEl.innerHTML = `<span class="custom-select-placeholder">${escapeHtml(placeholderText)}</span>`;
      return;
    }

    let colorDot = '';
    let mainText = selectedOption.text;
    let subBadge = '';

    const matchPundi = selectedOption.text.match(/^(.*?)\s*(\(Rp\s*[\d\.\,]+\))$/);
    if (matchPundi) {
      mainText = matchPundi[1].trim();
    }

    const pundiMatch = cachedPundis.find(p => p.id === selectedOption.value);
    if (pundiMatch) {
      colorDot = `<span class="legend-dot" style="--c: ${pundiMatch.color || '#10B981'}; width: 10px; height: 10px; flex-shrink: 0; margin:0;"></span>`;
      subBadge = `<span class="badge" style="font-size: 11px; margin-left: auto;">${Currency.format(pundiMatch.balance || 0)}</span>`;
    } else {
      const catMatch = cachedCategories.find(c => c.id === selectedOption.value);
      if (catMatch) {
        colorDot = `<span class="legend-dot" style="--c: ${catMatch.color || '#10B981'}; width: 10px; height: 10px; flex-shrink: 0; margin:0;"></span>`;
      }
    }

    valEl.innerHTML = `
      ${colorDot}
      <span style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(mainText)}</span>
      ${subBadge}
    `;

    // Sync selected class in dropdown
    const dropdown = wrapper.querySelector('.custom-select-dropdown');
    if (dropdown) {
      dropdown.querySelectorAll('.custom-select-option').forEach(el => {
        const isMatch = el.getAttribute('data-value') === selectedOption.value;
        el.classList.toggle('is-selected', isMatch);
        const checkIcon = el.querySelector('.custom-select-check');
        if (isMatch && !checkIcon) {
          const check = document.createElement('i');
          check.setAttribute('data-lucide', 'check');
          check.className = 'custom-select-check';
          el.appendChild(check);
          refreshIcons();
        } else if (!isMatch && checkIcon) {
          checkIcon.remove();
        }
      });
    }
  },

  closeAll() {
    document.querySelectorAll('.custom-select-wrapper.is-open').forEach(w => {
      w.classList.remove('is-open');
      const trigger = w.querySelector('.custom-select-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  }
};

// Global click outside to dismiss custom dropdowns
document.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select-wrapper')) {
    CustomSelect.closeAll();
  }
});

/**
 * Open native HTML5 modal dialog
 */
function openModal(modalEl) {
  if (modalEl && typeof modalEl.showModal === 'function') {
    modalEl.showModal();
    refreshIcons();
  }
}

/**
 * Close modal
 */
function closeModal(modalEl) {
  if (modalEl && typeof modalEl.close === 'function') {
    modalEl.close();
  }
}

/**
 * Show confirmation dialog
 */
let pendingConfirmCallback = null;
function showConfirm({ title, message, subtext, actionLabel, isDanger = true, onConfirm }) {
  if (!dom.modalConfirm) return;
  document.getElementById('confirm-title').textContent = title || 'Konfirmasi';
  dom.confirmMessage.textContent = message || 'Apakah Anda yakin?';
  dom.confirmSub.textContent = subtext || '';
  dom.btnConfirmAction.textContent = actionLabel || 'Lanjutkan';
  dom.btnConfirmAction.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';

  pendingConfirmCallback = onConfirm;
  openModal(dom.modalConfirm);
}

if (dom.btnConfirmAction) {
  dom.btnConfirmAction.addEventListener('click', async () => {
    if (pendingConfirmCallback) {
      dom.btnConfirmAction.disabled = true;
      try {
        await pendingConfirmCallback();
      } finally {
        dom.btnConfirmAction.disabled = false;
        closeModal(dom.modalConfirm);
        pendingConfirmCallback = null;
      }
    } else {
      closeModal(dom.modalConfirm);
    }
  });
}

/**
 * Switch Active View in SPA
 */
export function navigateTo(viewName) {
  currentView = viewName;
  window.location.hash = viewName;

  // Toggle view visibility
  Object.keys(dom.views).forEach(key => {
    if (dom.views[key]) {
      dom.views[key].hidden = (key !== viewName);
    }
  });

  // Highlight active nav links in bottom bar and sidebar
  dom.navLinks.forEach(link => {
    const target = link.getAttribute('data-view');
    link.classList.toggle('is-active', target === viewName);
  });

  // Update Topbar title
  const titles = {
    dashboard: 'DompetQu',
    pundi: 'Pundi-Pundi',
    transactions: 'Transaksi',
    goals: 'Target Keuangan',
    reports: 'Laporan Keuangan',
    settings: 'Pengaturan'
  };
  if (dom.topbarTitle) {
    dom.topbarTitle.textContent = titles[viewName] || 'DompetQu';
  }

  // Refresh view contents
  loadCurrentViewData();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Load appropriate view data on switch
 */
async function loadCurrentViewData() {
  if (!currentUser) return;

  try {
    if (currentView === 'dashboard') {
      await DashboardManager.loadDashboard(currentUser.uid, dom.dash);
    } else if (currentView === 'pundi') {
      await loadPundiView();
    } else if (currentView === 'transactions') {
      await loadTransactionsView();
    } else if (currentView === 'goals') {
      await loadGoalsView();
    } else if (currentView === 'reports') {
      await loadReportsView();
    } else if (currentView === 'settings') {
      loadSettingsView();
    }
  } catch (err) {
    console.error(`Error loading view ${currentView}:`, err);
    showToast(formatFriendlyError(err), 'error');
  } finally {
    refreshIcons();
  }
}

/**
 * Preload user baseline caches
 */
async function refreshBaselineData() {
  if (!currentUser) return;
  const [pundis, categories] = await Promise.all([
    PundiService.getPundis(currentUser.uid, true),
    CategoryService.getCategories(currentUser.uid)
  ]);
  cachedPundis = pundis;
  cachedCategories = categories;
  populatePundiSelects();
  populateCategorySelects();
}

/**
 * Fill select dropdowns with available active Pundis and Categories
 */
function populatePundiSelects() {
  const activePundis = cachedPundis.filter(p => !p.isArchived);
  const selects = document.querySelectorAll('select[data-pundi-select]');

  selects.forEach(select => {
    const currentVal = select.value;
    select.innerHTML = '<option value="">Pilih Pundi...</option>' +
      activePundis.map(p => `
        <option value="${p.id}">${escapeHtml(p.name)} (${Currency.format(p.balance || 0)})</option>
      `).join('');
    if (currentVal) select.value = currentVal;
    if (select.id) CustomSelect.sync(select.id);
  });
}

function populateCategorySelects(selectedType = 'EXPENSE') {
  const selects = document.querySelectorAll('select[data-category-select]');
  const filtered = cachedCategories.filter(c => !c.isArchived && c.type === selectedType);

  selects.forEach(select => {
    const currentVal = select.value;
    select.innerHTML = '<option value="">Pilih Kategori...</option>' +
      filtered.map(c => `
        <option value="${c.id}">${escapeHtml(c.name)}</option>
      `).join('');
    if (currentVal) select.value = currentVal;
    if (select.id) CustomSelect.sync(select.id);
  });
}

/* ==========================================================================
   VIEW 1: PUNDI MANAGEMENT
   ========================================================================== */

async function loadPundiView() {
  const pundiContainer = document.getElementById('pundi-list-cards');
  const archivedContainer = document.getElementById('pundi-archived-list');
  if (!pundiContainer) return;

  cachedPundis = await PundiService.getPundis(currentUser.uid, true);

  const { start, end } = DateUtil.getCurrentMonthRange();
  const monthTx = await TransactionService.getTransactions(currentUser.uid, {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    type: 'EXPENSE'
  });

  const expenseMap = {};
  monthTx.forEach(t => {
    expenseMap[t.pundiId] = (expenseMap[t.pundiId] || 0) + Number(t.amount || 0);
  });

  const active = cachedPundis.filter(p => !p.isArchived);
  const archived = cachedPundis.filter(p => p.isArchived);

  if (active.length === 0) {
    pundiContainer.innerHTML = `
      <div class="card empty" style="grid-column: 1 / -1;">
        <div class="empty-icon"><i data-lucide="wallet" style="width:24px;height:24px;"></i></div>
        <p class="empty-title">Belum ada Pundi aktif</p>
        <p class="empty-text">Buat Pundi untuk membagi uang Anda ke pos-pos kebutuhan.</p>
        <button type="button" class="btn btn-primary btn-sm" id="btn-add-pundi-empty">Buat Pundi Pertama</button>
      </div>
    `;
    const btnEmpty = document.getElementById('btn-add-pundi-empty');
    if (btnEmpty) btnEmpty.addEventListener('click', () => openPundiModal());
  } else {
    pundiContainer.innerHTML = active.map(p => {
      const expense = expenseMap[p.id] || 0;
      const budget = Number(p.monthlyBudget || 0);
      const usage = BudgetUtil.calculateUsage(expense, budget);
      const status = BudgetUtil.getStatus(usage);
      const remainingBudget = Math.max(0, budget - expense);

      let alertHtml = '';
      if (usage >= 100) {
        alertHtml = `
          <div class="pundi-alert-badge alert-danger" style="margin-top: 8px;">
            <i data-lucide="alert-triangle" style="width:13px;height:13px;flex-shrink:0;"></i>
            <span>Over budget (${usage}%)</span>
          </div>
        `;
      } else if (usage >= 90) {
        alertHtml = `
          <div class="pundi-alert-badge alert-danger" style="margin-top: 8px;">
            <i data-lucide="alert-triangle" style="width:13px;height:13px;flex-shrink:0;"></i>
            <span>Budget hampir habis (${usage}%)</span>
          </div>
        `;
      } else if (usage >= 75) {
        alertHtml = `
          <div class="pundi-alert-badge alert-warning" style="margin-top: 8px;">
            <i data-lucide="alert-triangle" style="width:13px;height:13px;flex-shrink:0;"></i>
            <span>Budget terpakai ${usage}%</span>
          </div>
        `;
      }

      return `
        <div class="card pundi-card" data-pundi-id="${p.id}">
          <div class="card-head">
            <div class="avatar" style="background:${p.color || '#10B981'}25; color:${p.color || '#10B981'};">
              <i data-lucide="${escapeHtml(p.icon || 'wallet')}" style="width:20px;height:20px;"></i>
            </div>
            <div class="card-head-title">
              <h3>${escapeHtml(p.name)}</h3>
              <p>${escapeHtml(p.description || 'Tidak ada catatan')}</p>
            </div>
            <div class="row-actions">
              <button type="button" class="icon-btn icon-btn-sm btn-edit-pundi" data-pundi-id="${p.id}" aria-label="Edit Pundi">
                <i data-lucide="pencil" style="width:15px;height:15px;"></i>
              </button>
              <button type="button" class="icon-btn icon-btn-sm btn-archive-pundi" data-pundi-id="${p.id}" aria-label="Arsipkan Pundi">
                <i data-lucide="archive" style="width:15px;height:15px;"></i>
              </button>
            </div>
          </div>

          <div class="kv">
            <span class="kv-label">Saldo Saat Ini</span>
            <span class="kv-value">${Currency.format(p.balance || 0)}</span>
          </div>

          <div class="progress ${status.class}">
            <span style="width: ${Math.min(100, usage)}%;"></span>
          </div>

          <div class="meta-row">
            <span>Budget: <strong class="num">${Currency.format(budget)}</strong></span>
            <span>Terpakai: <strong class="num">${usage}%</strong> (${Currency.format(expense)})</span>
          </div>

          <div class="meta-row" style="margin-top:-4px;">
            <span>Sisa Budget: <strong class="num">${Currency.format(remainingBudget)}</strong></span>
            <span class="badge ${status.badgeClass}">${status.label}</span>
          </div>
          ${alertHtml}
        </div>
      `;
    }).join('');
  }

  // Render archived pundis
  if (archivedContainer) {
    const archSection = document.getElementById('archived-pundi-section');
    if (archived.length === 0) {
      if (archSection) archSection.hidden = true;
    } else {
      if (archSection) archSection.hidden = false;
      archivedContainer.innerHTML = archived.map(p => `
        <div class="card pundi-row is-archived">
          <div class="avatar avatar-sm" style="background:${p.color || '#737A83'}20; color:${p.color || '#737A83'};">
            <i data-lucide="${escapeHtml(p.icon || 'wallet')}" style="width:16px;height:16px;"></i>
          </div>
          <div class="pundi-main" style="min-width:0;">
            <div class="pundi-row-name">${escapeHtml(p.name)} <span class="badge">Diarsipkan</span></div>
            <div class="pundi-row-sub">Saldo: ${Currency.format(p.balance || 0)}</div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm btn-unarchive-pundi" data-pundi-id="${p.id}">Pulihkan</button>
        </div>
      `).join('');
    }
  }

  // Bind actions
  document.querySelectorAll('.btn-edit-pundi').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-pundi-id');
      const item = cachedPundis.find(p => p.id === id);
      if (item) openPundiModal(item);
    });
  });

  document.querySelectorAll('.btn-archive-pundi').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-pundi-id');
      const item = cachedPundis.find(p => p.id === id);
      if (!item) return;

      showConfirm({
        title: 'Arsipkan Pundi',
        message: `Arsipkan Pundi "${item.name}"?`,
        subtext: 'Pundi ini tidak akan muncul saat membuat transaksi baru, tetapi riwayat transaksi tetap tersimpan.',
        actionLabel: 'Arsipkan',
        isDanger: false,
        onConfirm: async () => {
          await PundiService.setArchived(currentUser.uid, id, true);
          showToast(`Pundi ${item.name} berhasil diarsipkan.`, 'info');
          await loadPundiView();
          await refreshBaselineData();
        }
      });
    });
  });

  document.querySelectorAll('.btn-unarchive-pundi').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-pundi-id');
      await PundiService.setArchived(currentUser.uid, id, false);
      showToast('Pundi berhasil dipulihkan.', 'success');
      await loadPundiView();
      await refreshBaselineData();
    });
  });
}

function openPundiModal(pundiToEdit = null) {
  if (!dom.formPundi) return;
  dom.formPundi.reset();

  const titleEl = document.getElementById('modal-pundi-title');
  const idInput = document.getElementById('pundi-id');
  const nameInput = document.getElementById('pundi-name');
  const descInput = document.getElementById('pundi-desc');
  const budgetInput = document.getElementById('pundi-budget');
  const balanceInput = document.getElementById('pundi-balance');
  const balanceField = document.getElementById('pundi-balance-field');

  if (pundiToEdit) {
    if (titleEl) titleEl.textContent = 'Edit Pundi';
    idInput.value = pundiToEdit.id;
    nameInput.value = pundiToEdit.name || '';
    descInput.value = pundiToEdit.description || '';
    budgetInput.value = Currency.formatNumber(pundiToEdit.monthlyBudget) || '0';
    if (balanceField) balanceField.hidden = true; // balance updated via transactions
  } else {
    if (titleEl) titleEl.textContent = 'Buat Pundi Baru';
    idInput.value = '';
    budgetInput.value = '';
    balanceInput.value = '';
    if (balanceField) balanceField.hidden = false;
  }

  openModal(dom.modalPundi);
}

// Pundi Form submit
if (dom.formPundi) {
  dom.formPundi.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = dom.formPundi.querySelector('button[type="submit"]');
    const id = document.getElementById('pundi-id').value;
    const name = document.getElementById('pundi-name').value;
    const desc = document.getElementById('pundi-desc').value;
    const budget = Currency.parse(document.getElementById('pundi-budget').value);
    const balance = Currency.parse(document.getElementById('pundi-balance').value);
    const icon = dom.formPundi.querySelector('input[name="pundi_icon"]:checked')?.value || 'wallet';
    const color = dom.formPundi.querySelector('input[name="pundi_color"]:checked')?.value || '#10B981';

    const val = Validator.validatePundi({ name, monthlyBudget: budget });
    if (!val.isValid) {
      showToast(val.firstError, 'error');
      return;
    }

    btnSubmit.disabled = true;
    try {
      if (id) {
        await PundiService.updatePundi(currentUser.uid, id, {
          name,
          description: desc,
          monthlyBudget: budget,
          icon,
          color
        });
        showToast('Pundi berhasil diperbarui.', 'success');
      } else {
        await PundiService.createPundi(currentUser.uid, {
          name,
          description: desc,
          monthlyBudget: budget,
          initialBalance: balance,
          icon,
          color
        });
        showToast('Pundi baru berhasil dibuat.', 'success');
      }
      closeModal(dom.modalPundi);
      await loadPundiView();
      await refreshBaselineData();
    } catch (err) {
      showToast(formatFriendlyError(err), 'error');
    } finally {
      btnSubmit.disabled = false;
    }
  });
}

/* ==========================================================================
   VIEW 2: TRANSACTIONS MANAGEMENT (Search, Filter, Edit, Delete)
   ========================================================================== */

let txFilterState = {
  period: 'month', // 'today', '7days', 'month', 'lastmonth', 'custom'
  type: '',        // '', 'EXPENSE', 'INCOME', 'TRANSFER'
  pundiId: '',
  categoryId: '',
  searchQuery: '',
  customStart: '',
  customEnd: ''
};

async function loadTransactionsView() {
  const container = document.getElementById('tx-list-container');
  const countEl = document.getElementById('tx-count');
  const totalAmtEl = document.getElementById('tx-total-filtered');
  if (!container) return;

  // Compute date range based on period filter
  let startDate = null;
  let endDate = null;

  if (txFilterState.period === 'today') {
    startDate = DateUtil.todayString();
    endDate = DateUtil.todayString();
  } else if (txFilterState.period === '7days') {
    const r = DateUtil.getLast7DaysRange();
    startDate = r.start.toISOString().split('T')[0];
    endDate = r.end.toISOString().split('T')[0];
  } else if (txFilterState.period === 'month') {
    const r = DateUtil.getCurrentMonthRange();
    startDate = r.start.toISOString().split('T')[0];
    endDate = r.end.toISOString().split('T')[0];
  } else if (txFilterState.period === 'lastmonth') {
    const r = DateUtil.getLastMonthRange();
    startDate = r.start.toISOString().split('T')[0];
    endDate = r.end.toISOString().split('T')[0];
  } else if (txFilterState.period === 'custom') {
    startDate = txFilterState.customStart || null;
    endDate = txFilterState.customEnd || null;
  }

  const transactions = await TransactionService.getTransactions(currentUser.uid, {
    startDate,
    endDate,
    type: txFilterState.type || null,
    pundiId: txFilterState.pundiId || null,
    categoryId: txFilterState.categoryId || null
  });

  // Client-side search query filtering
  let filtered = transactions;
  if (txFilterState.searchQuery) {
    const q = txFilterState.searchQuery.toLowerCase().trim();
    const catMap = {};
    cachedCategories.forEach(c => { catMap[c.id] = (c.name || '').toLowerCase(); });
    const pundiMap = {};
    cachedPundis.forEach(p => { pundiMap[p.id] = (p.name || '').toLowerCase(); });

    filtered = filtered.filter(t => {
      const note = (t.note || '').toLowerCase();
      const catName = catMap[t.categoryId] || '';
      const pundiName = pundiMap[t.pundiId] || '';
      const amtStr = String(t.amount || '');
      return note.includes(q) || catName.includes(q) || pundiName.includes(q) || amtStr.includes(q);
    });
  }

  cachedTransactions = filtered;

  if (countEl) countEl.textContent = `${filtered.length} transaksi`;
  if (totalAmtEl) {
    const sumExpense = filtered.filter(t => t.type === 'EXPENSE').reduce((a, b) => a + Number(b.amount || 0), 0);
    const sumIncome = filtered.filter(t => t.type === 'INCOME').reduce((a, b) => a + Number(b.amount || 0), 0);
    totalAmtEl.textContent = `Pemasukan: ${Currency.format(sumIncome)} | Pengeluaran: ${Currency.format(sumExpense)}`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card empty">
        <div class="empty-icon"><i data-lucide="search-x" style="width:24px;height:24px;"></i></div>
        <p class="empty-title">Tidak ada transaksi ditemukan</p>
        <p class="empty-text">Coba ubah filter atau kata kunci pencarian Anda.</p>
        <button type="button" class="btn btn-primary btn-sm" id="btn-quick-add-from-tx">Tambah Transaksi</button>
      </div>
    `;
    const btnAdd = document.getElementById('btn-quick-add-from-tx');
    if (btnAdd) btnAdd.addEventListener('click', () => openTxModal());
    return;
  }

  // Group transactions by date
  const groups = {};
  filtered.forEach(t => {
    const dKey = t.date || 'Lainnya';
    if (!groups[dKey]) groups[dKey] = [];
    groups[dKey].push(t);
  });

  const catMap = {};
  cachedCategories.forEach(c => { catMap[c.id] = c; });
  const pundiMap = {};
  cachedPundis.forEach(p => { pundiMap[p.id] = p; });

  const dateKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  container.innerHTML = dateKeys.map(dateKey => {
    const list = groups[dateKey];
    const formattedDate = dateKey !== 'Lainnya' ? DateUtil.formatDate(dateKey, true) : 'Tanpa Tanggal';

    return `
      <div class="tx-group">
        <div class="tx-group-head">
          <span>${formattedDate}</span>
          <span class="subtle">${list.length} item</span>
        </div>
        <div class="card card-flush">
          <ul class="list">
            ${list.map(t => {
              const cat = catMap[t.categoryId] || { name: 'Kategori', icon: 'tag' };
              const pundi = pundiMap[t.pundiId] || { name: 'Pundi' };
              const destPundi = t.destinationPundiId ? pundiMap[t.destinationPundiId] : null;

              let iconName = cat.icon || 'arrow-left-right';
              let subtitle = `${escapeHtml(pundi.name)}`;
              if (t.type === 'INCOME') {
                iconName = 'trending-up';
                subtitle = `Ke: ${escapeHtml(pundi.name)}`;
              } else if (t.type === 'TRANSFER') {
                iconName = 'arrow-right-left';
                subtitle = `${escapeHtml(pundi.name)} &rarr; ${destPundi ? escapeHtml(destPundi.name) : 'Tujuan'}`;
              } else {
                subtitle = `${escapeHtml(cat.name)} &bull; ${escapeHtml(pundi.name)}`;
              }

              return `
                <li>
                  <button type="button" class="tx-row btn-open-tx-detail" data-tx-id="${t.id}">
                    <div class="avatar avatar-sm tx-icon-${t.type}">
                      <i data-lucide="${iconName}" style="width:16px;height:16px;"></i>
                    </div>
                    <div class="tx-main">
                      <div class="tx-title">${escapeHtml(t.note || cat.name || 'Transaksi')}</div>
                      <div class="tx-meta">${subtitle}</div>
                    </div>
                    <div class="tx-amount amount-${t.type}">${Currency.formatSigned(t.type, t.amount)}</div>
                  </button>
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      </div>
    `;
  }).join('');

  // Bind click transaction row to open edit / delete options
  container.querySelectorAll('.btn-open-tx-detail').forEach(row => {
    row.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-tx-id');
      const item = cachedTransactions.find(t => t.id === id);
      if (item) openTxModal(item);
    });
  });
}

// Live search with debounce
const txSearchInput = document.getElementById('tx-search-input');
if (txSearchInput) {
  txSearchInput.addEventListener('input', debounce((e) => {
    txFilterState.searchQuery = e.target.value;
    loadTransactionsView();
  }, 250));
}

// Period chips
document.querySelectorAll('[data-tx-period]').forEach(chip => {
  chip.addEventListener('click', (e) => {
    document.querySelectorAll('[data-tx-period]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    const p = chip.getAttribute('data-tx-period');
    txFilterState.period = p;

    const customFields = document.getElementById('tx-custom-date-fields');
    if (customFields) customFields.hidden = (p !== 'custom');

    loadTransactionsView();
  });
});

// Type filter buttons
document.querySelectorAll('[data-tx-type]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('[data-tx-type]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    txFilterState.type = btn.getAttribute('data-tx-type') || '';
    loadTransactionsView();
  });
});

/* ==========================================================================
   QUICK TRANSACTION MODAL (Income, Expense, Transfer)
   ========================================================================== */

function openTxModal(txToEdit = null, defaultType = 'EXPENSE') {
  if (!dom.formTx) return;
  dom.formTx.reset();

  const titleEl = document.getElementById('modal-tx-title');
  const idInput = document.getElementById('tx-id');
  const typeInputs = dom.formTx.querySelectorAll('input[name="tx_type"]');
  const amountInput = document.getElementById('tx-amount');
  const pundiSelect = document.getElementById('tx-pundi');
  const destPundiSelect = document.getElementById('tx-dest-pundi');
  const catSelect = document.getElementById('tx-category');
  const dateInput = document.getElementById('tx-date');
  const noteInput = document.getElementById('tx-note');
  const btnDelete = document.getElementById('btn-delete-tx');

  populatePundiSelects();

  if (txToEdit) {
    if (titleEl) titleEl.textContent = 'Edit Transaksi';
    idInput.value = txToEdit.id;
    amountInput.value = Currency.formatNumber(txToEdit.amount) || '';
    pundiSelect.value = txToEdit.pundiId || '';
    dateInput.value = txToEdit.date || DateUtil.todayString();
    noteInput.value = txToEdit.note || '';

    typeInputs.forEach(r => {
      r.checked = (r.value === txToEdit.type);
    });

    handleTxTypeChange(txToEdit.type);

    if (txToEdit.type === 'TRANSFER') {
      destPundiSelect.value = txToEdit.destinationPundiId || '';
    } else {
      catSelect.value = txToEdit.categoryId || '';
    }

    if (btnDelete) btnDelete.hidden = false;
  } else {
    if (titleEl) titleEl.textContent = 'Tambah Transaksi';
    idInput.value = '';
    amountInput.value = '';
    dateInput.value = DateUtil.todayString();
    const activeType = ['INCOME', 'EXPENSE', 'TRANSFER'].includes(defaultType) ? defaultType : 'EXPENSE';
    typeInputs.forEach(r => {
      r.checked = (r.value === activeType);
    });
    handleTxTypeChange(activeType);

    // Pre-select first active pundi if none selected
    if (!pundiSelect.value && cachedPundis.length > 0) {
      const activePundi = cachedPundis.find(p => !p.isArchived);
      if (activePundi) pundiSelect.value = activePundi.id;
    }

    if (btnDelete) btnDelete.hidden = true;
  }

  CustomSelect.updateTrigger(pundiSelect);
  if (destPundiSelect) CustomSelect.updateTrigger(destPundiSelect);
  if (catSelect) CustomSelect.updateTrigger(catSelect);
  updateTxPundiHint();
  openModal(dom.modalTx);
}

function updateTxPundiHint() {
  const pundiSelect = document.getElementById('tx-pundi');
  const infoEl = document.getElementById('tx-pundi-info');
  const type = dom.formTx?.querySelector('input[name="tx_type"]:checked')?.value || 'EXPENSE';
  const amountVal = Currency.parse(document.getElementById('tx-amount')?.value || '0');
  if (!infoEl || !pundiSelect) return;

  const pundiId = pundiSelect.value;
  if (!pundiId) {
    infoEl.innerHTML = '';
    return;
  }

  const pundi = cachedPundis.find(p => p.id === pundiId);
  if (!pundi) {
    infoEl.innerHTML = '';
    return;
  }

  const bal = Number(pundi.balance || 0);

  if (type === 'INCOME') {
    infoEl.innerHTML = `<span style="color:var(--text-2); font-size:12px;">Saldo saat ini: <strong>${Currency.format(bal)}</strong> (akan bertambah setelah disimpan)</span>`;
    return;
  }

  // EXPENSE or TRANSFER
  if (bal <= 0) {
    infoEl.innerHTML = `<span style="color:var(--warning); font-size:12px; font-weight:500;">⚠️ Saldo Pundi saat ini Rp0. Catat Pemasukan terlebih dahulu atau atur Saldo Pundi.</span>`;
  } else if (amountVal > 0 && amountVal > bal) {
    infoEl.innerHTML = `<span style="color:var(--danger); font-size:12px; font-weight:500;">⚠️ Melebihi saldo! Tersedia: <strong>${Currency.format(bal)}</strong> (kurang ${Currency.format(amountVal - bal)}).</span>`;
  } else {
    infoEl.innerHTML = `<span style="color:var(--text-2); font-size:12px;">Saldo tersedia di Pundi ini: <strong>${Currency.format(bal)}</strong></span>`;
  }
}

function handleTxTypeChange(selectedType) {
  const catField = document.getElementById('tx-field-category');
  const destField = document.getElementById('tx-field-destination');
  const pundiLabel = document.getElementById('tx-pundi-label');

  populateCategorySelects(selectedType);

  if (selectedType === 'TRANSFER') {
    if (catField) catField.hidden = true;
    if (destField) destField.hidden = false;
    if (pundiLabel) pundiLabel.textContent = 'Pundi Sumber';
  } else if (selectedType === 'INCOME') {
    if (catField) catField.hidden = false;
    if (destField) destField.hidden = true;
    if (pundiLabel) pundiLabel.textContent = 'Masuk ke Pundi';
  } else {
    // EXPENSE
    if (catField) catField.hidden = false;
    if (destField) destField.hidden = true;
    if (pundiLabel) pundiLabel.textContent = 'Bayar dari Pundi';
  }

  updateTxPundiHint();
  CustomSelect.updateTrigger(document.getElementById('tx-pundi'));
  CustomSelect.updateTrigger(document.getElementById('tx-dest-pundi'));
  CustomSelect.updateTrigger(document.getElementById('tx-category'));
}

// Listen to segmented radio change for tx type & inputs
if (dom.formTx) {
  dom.formTx.querySelectorAll('input[name="tx_type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      handleTxTypeChange(e.target.value);
    });
  });

  const txPundiSelect = document.getElementById('tx-pundi');
  if (txPundiSelect) {
    txPundiSelect.addEventListener('change', updateTxPundiHint);
  }

  const txAmountInput = document.getElementById('tx-amount');
  if (txAmountInput) {
    txAmountInput.addEventListener('input', updateTxPundiHint);
  }

  // Transaction form submit
  dom.formTx.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = dom.formTx.querySelector('button[type="submit"]');
    const id = document.getElementById('tx-id').value;
    const type = dom.formTx.querySelector('input[name="tx_type"]:checked')?.value || 'EXPENSE';
    const amount = Currency.parse(document.getElementById('tx-amount').value);
    const pundiId = document.getElementById('tx-pundi').value;
    const destinationPundiId = document.getElementById('tx-dest-pundi')?.value || null;
    const categoryId = document.getElementById('tx-category')?.value || null;
    const date = document.getElementById('tx-date').value;
    const note = document.getElementById('tx-note').value;

    const sourcePundi = cachedPundis.find(p => p.id === pundiId);
    const sourceBalance = sourcePundi ? Number(sourcePundi.balance || 0) : 0;

    // Validation
    const val = Validator.validateTransaction({
      type,
      amount,
      pundiId,
      destinationPundiId,
      categoryId,
      date,
      sourcePundiBalance: id ? undefined : sourceBalance // check strict balance on new transactions
    });

    if (!val.isValid) {
      if (val.firstError === 'Saldo Pundi tidak mencukupi.' || val.firstError === 'Saldo Pundi tidak mencukupi untuk transfer.') {
        showToast(`Saldo Pundi "${sourcePundi?.name || 'terpilih'}" tidak mencukupi (${Currency.format(sourceBalance)}). Tambahkan Pemasukan terlebih dahulu ke Pundi ini atau atur Saldo Pundi.`, 'error');
      } else {
        showToast(val.firstError, 'error');
      }
      return;
    }

    btnSubmit.disabled = true;
    try {
      if (id) {
        await TransactionService.updateTransaction(currentUser.uid, id, {
          type,
          amount,
          pundiId,
          destinationPundiId,
          categoryId,
          date,
          note
        });
        showToast('Transaksi berhasil diperbarui.', 'success');
      } else {
        await TransactionService.createTransaction(currentUser.uid, {
          type,
          amount,
          pundiId,
          destinationPundiId,
          categoryId,
          date,
          note
        });
        showToast('Transaksi berhasil disimpan.', 'success');
      }

      closeModal(dom.modalTx);
      await refreshBaselineData();
      await loadCurrentViewData();
    } catch (err) {
      showToast(formatFriendlyError(err), 'error');
    } finally {
      btnSubmit.disabled = false;
    }
  });

  // Delete transaction button inside modal
  const btnDelete = document.getElementById('btn-delete-tx');
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      const id = document.getElementById('tx-id').value;
      const amount = Currency.parse(document.getElementById('tx-amount').value);
      if (!id) return;

      showConfirm({
        title: 'Hapus Transaksi?',
        message: `Transaksi senilai ${Currency.format(amount)} akan dihapus.`,
        subtext: 'Saldo Pundi Anda akan disesuaikan kembali ke kondisi semula.',
        actionLabel: 'Hapus',
        isDanger: true,
        onConfirm: async () => {
          await TransactionService.deleteTransaction(currentUser.uid, id);
          closeModal(dom.modalTx);
          showToast('Transaksi berhasil dihapus dan saldo dipulihkan.', 'info');
          await refreshBaselineData();
          await loadCurrentViewData();
        }
      });
    });
  }
}

/* ==========================================================================
   VIEW 3: GOALS (Target Keuangan)
   ========================================================================== */

async function loadGoalsView() {
  const container = document.getElementById('goals-grid');
  if (!container) return;

  cachedGoals = await GoalService.getGoals(currentUser.uid);

  if (cachedGoals.length === 0) {
    container.innerHTML = `
      <div class="card empty" style="grid-column: 1 / -1;">
        <div class="empty-icon"><i data-lucide="target" style="width:24px;height:24px;"></i></div>
        <p class="empty-title">Belum ada target keuangan</p>
        <p class="empty-text">Tentukan tujuan tabungan seperti dana darurat, liburan, atau kendaraan.</p>
        <button type="button" class="btn btn-primary btn-sm" id="btn-add-goal-empty">Buat Target</button>
      </div>
    `;
    const btnEmpty = document.getElementById('btn-add-goal-empty');
    if (btnEmpty) btnEmpty.addEventListener('click', () => openGoalModal());
    return;
  }

  container.innerHTML = cachedGoals.map(g => {
    const target = Number(g.targetAmount || 0);
    const current = Number(g.currentAmount || 0);
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    const remaining = Math.max(0, target - current);

    return `
      <div class="card goal-card" data-goal-id="${g.id}">
        <div class="card-head">
          <div class="avatar avatar-round"><i data-lucide="target" style="width:18px;height:18px;"></i></div>
          <div class="card-head-title">
            <h3>${escapeHtml(g.name)}</h3>
            <p>${g.deadline ? `Tenggat: ${DateUtil.formatDate(g.deadline)}` : 'Tanpa tenggat waktu'}</p>
          </div>
          <div class="row-actions">
            <button type="button" class="icon-btn icon-btn-sm btn-edit-goal" data-goal-id="${g.id}" aria-label="Edit Target">
              <i data-lucide="pencil" style="width:15px;height:15px;"></i>
            </button>
            <button type="button" class="icon-btn icon-btn-sm btn-delete-goal" data-goal-id="${g.id}" aria-label="Hapus Target">
              <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
            </button>
          </div>
        </div>

        <div class="kv">
          <span class="kv-label">Terkumpul</span>
          <span class="kv-value text-income">${Currency.format(current)}</span>
        </div>

        <div class="progress is-info">
          <span style="width: ${pct}%;"></span>
        </div>

        <div class="meta-row">
          <span>Target: <strong class="num">${Currency.format(target)}</strong></span>
          <span>Progress: <strong class="num">${pct}%</strong></span>
        </div>

        <div class="meta-row" style="margin-top:-4px;">
          <span>Kurang: <strong class="num">${Currency.format(remaining)}</strong></span>
          <button type="button" class="btn btn-secondary btn-sm btn-add-saving" data-goal-id="${g.id}">
            + Tabung
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Bind actions
  container.querySelectorAll('.btn-edit-goal').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-goal-id');
      const g = cachedGoals.find(item => item.id === id);
      if (g) openGoalModal(g);
    });
  });

  container.querySelectorAll('.btn-delete-goal').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-goal-id');
      const g = cachedGoals.find(item => item.id === id);
      if (!g) return;

      showConfirm({
        title: 'Hapus Target Keuangan?',
        message: `Hapus target "${g.name}"?`,
        subtext: 'Data target akan dihapus.',
        actionLabel: 'Hapus Target',
        isDanger: true,
        onConfirm: async () => {
          await GoalService.deleteGoal(currentUser.uid, id);
          showToast('Target keuangan berhasil dihapus.', 'info');
          await loadGoalsView();
        }
      });
    });
  });

  container.querySelectorAll('.btn-add-saving').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-goal-id');
      const g = cachedGoals.find(item => item.id === id);
      if (g) openGoalSavingModal(g);
    });
  });
}

function openGoalModal(goalToEdit = null) {
  if (!dom.formGoal) return;
  dom.formGoal.reset();

  const titleEl = document.getElementById('modal-goal-title');
  const idInput = document.getElementById('goal-id');
  const nameInput = document.getElementById('goal-name');
  const targetInput = document.getElementById('goal-target');
  const currentInput = document.getElementById('goal-current');
  const deadlineInput = document.getElementById('goal-deadline');
  const noteInput = document.getElementById('goal-note');

  if (goalToEdit) {
    if (titleEl) titleEl.textContent = 'Edit Target Keuangan';
    idInput.value = goalToEdit.id;
    nameInput.value = goalToEdit.name || '';
    targetInput.value = Currency.formatNumber(goalToEdit.targetAmount) || '0';
    currentInput.value = Currency.formatNumber(goalToEdit.currentAmount) || '0';
    deadlineInput.value = goalToEdit.deadline || '';
    noteInput.value = goalToEdit.note || '';
  } else {
    if (titleEl) titleEl.textContent = 'Buat Target Baru';
    idInput.value = '';
    targetInput.value = '';
    currentInput.value = '';
  }

  openModal(dom.modalGoal);
}

if (dom.formGoal) {
  dom.formGoal.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = dom.formGoal.querySelector('button[type="submit"]');
    const id = document.getElementById('goal-id').value;
    const name = document.getElementById('goal-name').value;
    const target = Currency.parse(document.getElementById('goal-target').value);
    const current = Currency.parse(document.getElementById('goal-current').value);
    const deadline = document.getElementById('goal-deadline').value;
    const note = document.getElementById('goal-note').value;

    const val = Validator.validateGoal({ name, targetAmount: target, deadline });
    if (!val.isValid) {
      showToast(val.firstError, 'error');
      return;
    }

    btnSubmit.disabled = true;
    try {
      if (id) {
        await GoalService.updateGoal(currentUser.uid, id, {
          name,
          targetAmount: target,
          currentAmount: current,
          deadline,
          note
        });
        showToast('Target berhasil diperbarui.', 'success');
      } else {
        await GoalService.createGoal(currentUser.uid, {
          name,
          targetAmount: target,
          currentAmount: current,
          deadline,
          note
        });
        showToast('Target berhasil dibuat.', 'success');
      }
      closeModal(dom.modalGoal);
      await loadGoalsView();
    } catch (err) {
      showToast(formatFriendlyError(err), 'error');
    } finally {
      btnSubmit.disabled = false;
    }
  });
}

function openGoalSavingModal(goal) {
  if (!dom.formGoalSaving) return;
  dom.formGoalSaving.reset();

  document.getElementById('saving-goal-id').value = goal.id;
  document.getElementById('saving-goal-name').textContent = goal.name;
  openModal(dom.modalAddGoalSaving);
}

if (dom.formGoalSaving) {
  dom.formGoalSaving.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = dom.formGoalSaving.querySelector('button[type="submit"]');
    const id = document.getElementById('saving-goal-id').value;
    const addAmt = Currency.parse(document.getElementById('saving-amount').value);

    if (addAmt <= 0) {
      showToast('Nominal tabungan harus lebih dari Rp0.', 'error');
      return;
    }

    const g = cachedGoals.find(item => item.id === id);
    if (!g) return;

    btnSubmit.disabled = true;
    try {
      const newTotal = Number(g.currentAmount || 0) + addAmt;
      await GoalService.updateGoal(currentUser.uid, id, { currentAmount: newTotal });
      closeModal(dom.modalAddGoalSaving);
      showToast(`Berhasil menambah ${Currency.format(addAmt)} ke target!`, 'success');
      await loadGoalsView();
    } catch (err) {
      showToast(formatFriendlyError(err), 'error');
    } finally {
      btnSubmit.disabled = false;
    }
  });
}

/* ==========================================================================
   VIEW 4: REPORTS (Laporan & Copy-ready Text Export)
   ========================================================================== */

let reportPeriod = 'month'; // 'month', 'lastmonth', '7days', 'today'

async function loadReportsView() {
  let startDate = null;
  let endDate = null;
  let periodLabel = 'Bulan Ini';

  if (reportPeriod === 'month') {
    const r = DateUtil.getCurrentMonthRange();
    startDate = r.start.toISOString().split('T')[0];
    endDate = r.end.toISOString().split('T')[0];
    periodLabel = 'Bulan Ini (' + DateUtil.formatDate(r.start, false) + ' - ' + DateUtil.formatDate(r.end) + ')';
  } else if (reportPeriod === 'lastmonth') {
    const r = DateUtil.getLastMonthRange();
    startDate = r.start.toISOString().split('T')[0];
    endDate = r.end.toISOString().split('T')[0];
    periodLabel = 'Bulan Lalu (' + DateUtil.formatDate(r.start, false) + ' - ' + DateUtil.formatDate(r.end) + ')';
  } else if (reportPeriod === '7days') {
    const r = DateUtil.getLast7DaysRange();
    startDate = r.start.toISOString().split('T')[0];
    endDate = r.end.toISOString().split('T')[0];
    periodLabel = '7 Hari Terakhir';
  } else if (reportPeriod === 'today') {
    startDate = DateUtil.todayString();
    endDate = DateUtil.todayString();
    periodLabel = 'Hari Ini (' + DateUtil.formatDate(new Date()) + ')';
  }

  const transactions = await TransactionService.getTransactions(currentUser.uid, { startDate, endDate });
  const reportData = ReportService.generateReport(transactions, cachedPundis, cachedCategories, periodLabel);

  // Bind summary stats
  const repIncome = document.getElementById('rep-income');
  const repExpense = document.getElementById('rep-expense');
  const repNet = document.getElementById('rep-net');
  const repPeriodTitle = document.getElementById('rep-period-title');

  if (repIncome) repIncome.textContent = Currency.format(reportData.totalIncome);
  if (repExpense) repExpense.textContent = Currency.format(reportData.totalExpense);
  if (repNet) {
    repNet.textContent = Currency.format(reportData.netCashFlow);
    repNet.className = reportData.netCashFlow >= 0 ? 'text-income' : 'text-expense';
  }
  if (repPeriodTitle) repPeriodTitle.textContent = periodLabel;

  // Breakdown Category
  const catListContainer = document.getElementById('rep-cat-list');
  if (catListContainer) {
    if (reportData.categoryList.length === 0) {
      catListContainer.innerHTML = '<p class="subtle small">Belum ada pengeluaran pada periode ini.</p>';
    } else {
      catListContainer.innerHTML = reportData.categoryList.map(c => {
        const pct = reportData.totalExpense > 0 ? Math.round((c.total / reportData.totalExpense) * 100) : 0;
        return `
          <div class="breakdown-item">
            <div class="breakdown-name">
              <span class="legend-dot" style="--c: ${c.color || '#10B981'};"></span>
              <span>${escapeHtml(c.name)}</span>
            </div>
            <div class="num"><strong>${Currency.format(c.total)}</strong> <span class="subtle">(${pct}%)</span></div>
            <div class="progress">
              <span style="width: ${pct}%; background: ${c.color || 'var(--primary)'};"></span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Breakdown Pundi
  const pundiListContainer = document.getElementById('rep-pundi-list');
  if (pundiListContainer) {
    if (reportData.pundiList.length === 0) {
      pundiListContainer.innerHTML = '<p class="subtle small">Belum ada pengeluaran pada periode ini.</p>';
    } else {
      pundiListContainer.innerHTML = reportData.pundiList.map(p => {
        const pct = reportData.totalExpense > 0 ? Math.round((p.total / reportData.totalExpense) * 100) : 0;
        return `
          <div class="breakdown-item">
            <div class="breakdown-name">
              <i data-lucide="wallet" class="icon" style="width:14px;height:14px;color:${p.color || '#10B981'};"></i>
              <span>${escapeHtml(p.name)}</span>
            </div>
            <div class="num"><strong>${Currency.format(p.total)}</strong> <span class="subtle">(${pct}%)</span></div>
            <div class="progress">
              <span style="width: ${pct}%; background: ${p.color || 'var(--primary)'};"></span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Text report preview & copy button
  const copyableText = ReportService.buildCopyableText(reportData);
  const textPreview = document.getElementById('rep-text-preview');
  if (textPreview) textPreview.textContent = copyableText;

  const btnCopy = document.getElementById('btn-copy-report');
  if (btnCopy) {
    btnCopy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(copyableText);
        showToast('Laporan berhasil disalin ke clipboard!', 'success');
      } catch (err) {
        showToast('Gagal menyalin teks laporan.', 'error');
      }
    };
  }
}

// Reports Period switcher
document.querySelectorAll('[data-rep-period]').forEach(chip => {
  chip.addEventListener('click', (e) => {
    document.querySelectorAll('[data-rep-period]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    reportPeriod = chip.getAttribute('data-rep-period');
    loadReportsView();
  });
});

/* ==========================================================================
   VIEW 5: SETTINGS & PREFERENCES & CATEGORIES
   ========================================================================== */

let activeCatModalType = 'EXPENSE';

function renderSettingsCategoryChips() {
  const container = dom.settingsCatChips || document.getElementById('settings-categories-chips');
  if (!container) return;

  const activeExpense = cachedCategories.filter(c => !c.isArchived && c.type === 'EXPENSE');
  const activeIncome = cachedCategories.filter(c => !c.isArchived && c.type === 'INCOME');

  container.innerHTML = `
    <div style="width:100%; margin-bottom:6px;"><span class="subtle small" style="font-weight:600;">Pengeluaran (${activeExpense.length} kategori):</span></div>
    <div class="chips" style="flex-wrap: wrap; margin-bottom: 14px; gap:6px;">
      ${activeExpense.length ? activeExpense.map(c => `
        <span class="chip" style="font-size:12px; border-color:${c.color || 'var(--border)'}; display:inline-flex; align-items:center; gap:6px;">
          <span class="legend-dot" style="--c:${c.color || '#10B981'}; width:8px; height:8px; margin:0;"></span>
          ${escapeHtml(c.name)}
        </span>
      `).join('') : '<span class="subtle small">Belum ada kategori pengeluaran aktif.</span>'}
    </div>
    <div style="width:100%; margin-bottom:6px;"><span class="subtle small" style="font-weight:600;">Pemasukan (${activeIncome.length} kategori):</span></div>
    <div class="chips" style="flex-wrap: wrap; gap:6px;">
      ${activeIncome.length ? activeIncome.map(c => `
        <span class="chip" style="font-size:12px; border-color:${c.color || 'var(--border)'}; display:inline-flex; align-items:center; gap:6px;">
          <span class="legend-dot" style="--c:${c.color || '#10B981'}; width:8px; height:8px; margin:0;"></span>
          ${escapeHtml(c.name)}
        </span>
      `).join('') : '<span class="subtle small">Belum ada kategori pemasukan aktif.</span>'}
    </div>
  `;
}

function renderCategoryModalList(type = activeCatModalType) {
  activeCatModalType = type;
  const listEl = document.getElementById('modal-cat-list');
  const countEl = document.getElementById('modal-cat-count');
  const hiddenTypeInput = document.getElementById('new-cat-type');
  const nameInput = document.getElementById('new-cat-name');
  const btnExpense = document.getElementById('btn-cat-type-expense');
  const btnIncome = document.getElementById('btn-cat-type-income');

  if (hiddenTypeInput) hiddenTypeInput.value = type;

  if (btnExpense && btnIncome) {
    if (type === 'EXPENSE') {
      btnExpense.classList.add('is-active');
      btnIncome.classList.remove('is-active');
      if (nameInput) nameInput.placeholder = 'Contoh: Makanan, Belanja, Skincare';
    } else {
      btnExpense.classList.remove('is-active');
      btnIncome.classList.add('is-active');
      if (nameInput) nameInput.placeholder = 'Contoh: Gaji, Freelance, Dividen';
    }
  }

  if (!listEl) return;

  const cats = cachedCategories.filter(c => c.type === type);
  if (countEl) countEl.textContent = `${cats.length} Kategori`;

  if (cats.length === 0) {
    listEl.innerHTML = '<p class="subtle small" style="padding:12px 0;">Belum ada kategori untuk jenis ini.</p>';
    return;
  }

  listEl.innerHTML = cats.map(cat => `
    <div class="card" style="padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
        <span class="legend-dot" style="--c: ${cat.color || '#10B981'}; width: 10px; height: 10px; flex-shrink: 0;"></span>
        <span style="font-weight: 500; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(cat.name)}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        <span class="badge ${cat.isArchived ? '' : 'badge-good'}" style="font-size: 11px;">
          ${cat.isArchived ? 'Diarsipkan' : 'Aktif'}
        </span>
        <button type="button" class="icon-btn icon-btn-sm btn-toggle-cat-archive" data-cat-id="${cat.id}" data-archived="${cat.isArchived ? 'true' : 'false'}" title="${cat.isArchived ? 'Aktifkan Kategori' : 'Arsipkan Kategori'}">
          <i data-lucide="${cat.isArchived ? 'archive-restore' : 'archive'}" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
    </div>
  `).join('');

  refreshIcons();

  listEl.querySelectorAll('.btn-toggle-cat-archive').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const catId = e.currentTarget.getAttribute('data-cat-id');
      const isArchived = e.currentTarget.getAttribute('data-archived') === 'true';
      try {
        await CategoryService.toggleArchiveCategory(currentUser.uid, catId, !isArchived);
        cachedCategories = await CategoryService.getCategories(currentUser.uid);
        renderCategoryModalList(activeCatModalType);
        renderSettingsCategoryChips();
        populateCategorySelects();
        showToast(isArchived ? 'Kategori diaktifkan kembali.' : 'Kategori berhasil diarsipkan.', 'info');
      } catch (err) {
        showToast(formatFriendlyError(err), 'error');
      }
    });
  });
}

function initCategoryListeners() {
  if (dom.btnOpenCatModal) {
    dom.btnOpenCatModal.addEventListener('click', () => {
      renderCategoryModalList('EXPENSE');
      openModal(dom.modalCategories);
    });
  }

  const btnExpense = document.getElementById('btn-cat-type-expense');
  const btnIncome = document.getElementById('btn-cat-type-income');
  if (btnExpense) {
    btnExpense.addEventListener('click', () => renderCategoryModalList('EXPENSE'));
  }
  if (btnIncome) {
    btnIncome.addEventListener('click', () => renderCategoryModalList('INCOME'));
  }

  if (dom.formCategory) {
    dom.formCategory.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('new-cat-name');
      const name = nameInput ? nameInput.value.trim() : '';
      const type = document.getElementById('new-cat-type')?.value || activeCatModalType;

      if (!name) return;

      const btnSubmit = dom.formCategory.querySelector('button[type="submit"]');
      if (btnSubmit) btnSubmit.disabled = true;

      try {
        await CategoryService.addCategory(currentUser.uid, {
          name,
          type,
          icon: 'tag',
          color: '#10B981'
        });
        if (nameInput) nameInput.value = '';
        cachedCategories = await CategoryService.getCategories(currentUser.uid);
        renderCategoryModalList(type);
        renderSettingsCategoryChips();
        populateCategorySelects();
        showToast(`Kategori "${name}" berhasil ditambahkan.`, 'success');
      } catch (err) {
        showToast(formatFriendlyError(err), 'error');
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
      }
    });
  }
}

function loadSettingsView() {
  const settings = SettingsService.getSettings();
  const widgets = settings.widgets || {};

  renderSettingsCategoryChips();

  // Setup widget switch toggles
  const widgetToggles = [
    { id: 'toggle-w-income', key: 'income' },
    { id: 'toggle-w-expense', key: 'expense' },
    { id: 'toggle-w-net', key: 'netCashFlow' },
    { id: 'toggle-w-pundi', key: 'pundiList' },
    { id: 'toggle-w-chart', key: 'expenseChart' },
    { id: 'toggle-w-recent', key: 'recentTransactions' },
    { id: 'toggle-w-warning', key: 'budgetWarning' }
  ];

  widgetToggles.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (el) {
      el.checked = Boolean(widgets[key]);
      el.onchange = (e) => {
        SettingsService.setWidgetVisible(key, e.target.checked);
        showToast('Preferensi dashboard diperbarui.', 'info');
      };
    }
  });

  // User details
  const profileName = document.getElementById('settings-profile-name');
  const profileEmail = document.getElementById('settings-profile-email');
  if (profileName) profileName.textContent = currentUser.displayName || 'Pengguna DompetQu';
  if (profileEmail) profileEmail.textContent = currentUser.email || '-';

  // Logout button
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.onclick = () => {
      showConfirm({
        title: 'Keluar Akun?',
        message: 'Apakah Anda yakin ingin keluar dari DompetQu?',
        actionLabel: 'Keluar',
        isDanger: true,
        onConfirm: async () => {
          await AuthService.logout();
          window.location.replace('login.html');
        }
      });
    };
  }
}

/* ==========================================================================
   PROFILE MENU, PWA INSTALL, & CHANGELOG
   ========================================================================== */

let deferredInstallPrompt = null;

function updateProfileAvatar(name = '') {
  const initial = (name || currentUser?.displayName || currentUser?.email || 'P')
    .trim().charAt(0).toUpperCase();

  const topbarInitial = document.getElementById('topbar-avatar-initial');
  const modalAvatar = document.getElementById('profile-modal-avatar');
  const sidebarInitial = document.getElementById('sidebar-avatar-initial');
  if (topbarInitial) topbarInitial.textContent = initial;
  if (modalAvatar) modalAvatar.textContent = initial;
  if (sidebarInitial) sidebarInitial.textContent = initial;
}

function updateInstallUi() {
  const btnInstall = document.getElementById('btn-install-app');
  const badgeInstalled = document.getElementById('badge-app-installed');
  const descEl = document.getElementById('profile-install-desc');
  const rowInstall = document.getElementById('profile-install-row');

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;

  if (isStandalone) {
    if (btnInstall) btnInstall.hidden = true;
    if (badgeInstalled) badgeInstalled.hidden = false;
    if (descEl) descEl.textContent = 'Aplikasi sudah terpasang (PWA)';
    if (rowInstall) rowInstall.style.cursor = 'default';
  } else {
    if (btnInstall) btnInstall.hidden = false;
    if (badgeInstalled) badgeInstalled.hidden = true;
    if (descEl) descEl.textContent = 'Pasang di perangkat untuk akses instan & offline';
    if (rowInstall) rowInstall.style.cursor = 'pointer';
  }
}
window.updateInstallUi = updateInstallUi;

function initProfileAndChangelog() {
  // Listen for PWA beforeinstallprompt if fired later
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredInstallPrompt = e;
    deferredInstallPrompt = e;
    updateInstallUi();
  });

  window.addEventListener('appinstalled', () => {
    window.deferredInstallPrompt = null;
    deferredInstallPrompt = null;
    updateInstallUi();
    showToast('DompetQu berhasil terpasang di perangkat Anda!', 'success');
  });

  updateInstallUi();

  // Topbar profile button opens profile modal
  const btnTopbarProfile = document.getElementById('btn-topbar-profile');
  if (btnTopbarProfile) {
    btnTopbarProfile.addEventListener('click', () => {
      updateProfileAvatar();
      updateInstallUi();
      openModal(dom.modalProfile || document.getElementById('modal-profile'));
    });
  }

  // Desktop sidebar user card opens profile modal
  const btnSidebarProfile = document.getElementById('btn-sidebar-profile');
  if (btnSidebarProfile) {
    btnSidebarProfile.addEventListener('click', () => {
      updateProfileAvatar();
      updateInstallUi();
      openModal(dom.modalProfile || document.getElementById('modal-profile'));
    });
  }

  // Back button in Settings view
  document.querySelectorAll('.btn-back-settings').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo('dashboard');
    });
  });

  // Categories shortcut in Profile modal
  const btnProfileCategories = document.getElementById('profile-btn-categories');
  if (btnProfileCategories) {
    btnProfileCategories.addEventListener('click', () => {
      closeModal(dom.modalProfile || document.getElementById('modal-profile'));
      renderCategoryModalList('EXPENSE');
      openModal(dom.modalCategories || document.getElementById('modal-categories'));
    });
  }

  // Settings shortcut in Profile modal
  const btnProfileSettings = document.getElementById('profile-btn-settings');
  if (btnProfileSettings) {
    btnProfileSettings.addEventListener('click', () => {
      closeModal(dom.modalProfile || document.getElementById('modal-profile'));
      navigateTo('settings');
    });
  }

  // Pundi shortcut in Profile modal (Mobile optimization)
  const btnProfilePundi = document.getElementById('profile-btn-pundi');
  if (btnProfilePundi) {
    btnProfilePundi.addEventListener('click', () => {
      closeModal(dom.modalProfile || document.getElementById('modal-profile'));
      navigateTo('pundi');
    });
  }

  // Changelog shortcut in Profile modal
  const btnProfileChangelog = document.getElementById('profile-btn-changelog');
  if (btnProfileChangelog) {
    btnProfileChangelog.addEventListener('click', () => {
      closeModal(dom.modalProfile || document.getElementById('modal-profile'));
      openModal(dom.modalChangelog || document.getElementById('modal-changelog'));
    });
  }

  // Theme Switcher (Dark / Light Mode)
  const savedTheme = localStorage.getItem('dompetqu_theme') || 'dark';
  applyThemeUI(savedTheme, false);

  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const selected = btn.getAttribute('data-theme-val');
      applyThemeUI(selected, true);
      showToast(`Mode ${selected === 'light' ? 'Terang' : 'Gelap'} diaktifkan.`, 'info', 1800);
    });
  });

  // Install App Action (both button and card click)
  async function triggerInstallFlow(e) {
    if (e) e.stopPropagation();
    
    // 1. If already standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone === true;
    if (isStandalone) {
      showToast('Aplikasi DompetQu sudah terpasang dan sedang dibuka!', 'success');
      return;
    }

    // 2. If browser exposes getInstalledRelatedApps, check if already installed
    if ('getInstalledRelatedApps' in navigator) {
      try {
        const related = await navigator.getInstalledRelatedApps();
        if (related && related.length > 0) {
          showToast('DompetQu sudah terpasang di HP Anda! Anda dapat langsung membukanya dari layar utama.', 'info', 5000);
          return;
        }
      } catch (err) {}
    }

    // 3. If deferred prompt is captured, trigger native install prompt dialog
    const promptEvt = window.deferredInstallPrompt || deferredInstallPrompt;
    if (promptEvt) {
      try {
        promptEvt.prompt();
        const choice = await promptEvt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          showToast('Menginstal DompetQu ke perangkat...', 'info');
        }
        window.deferredInstallPrompt = null;
        deferredInstallPrompt = null;
        updateInstallUi();
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
      return;
    }

    // 4. If prompt is not available, open visual guide modal
    closeModal(dom.modalProfile || document.getElementById('modal-profile'));
    const guideModal = document.getElementById('modal-install-guide');
    if (guideModal) {
      openModal(guideModal);
    } else {
      showToast('Buka menu browser (titik 3 di kanan atas Chrome), lalu pilih "Install aplikasi".', 'info', 4500);
    }
  }

  const btnInstall = document.getElementById('btn-install-app');
  if (btnInstall) {
    btnInstall.addEventListener('click', triggerInstallFlow);
  }
  const rowInstall = document.getElementById('profile-install-row');
  if (rowInstall) {
    rowInstall.addEventListener('click', (e) => {
      if (e.target.closest('#btn-install-app')) return;
      triggerInstallFlow(e);
    });
  }

  // Logout button inside Profile modal
  const btnProfileLogout = document.getElementById('profile-btn-logout');
  if (btnProfileLogout) {
    btnProfileLogout.addEventListener('click', () => {
      closeModal(dom.modalProfile || document.getElementById('modal-profile'));
      showConfirm({
        title: 'Keluar Akun?',
        message: 'Apakah Anda yakin ingin keluar dari DompetQu?',
        actionLabel: 'Keluar',
        isDanger: true,
        onConfirm: async () => {
          await AuthService.logout();
          window.location.replace('login.html');
        }
      });
    });
  }
}

function applyThemeUI(theme, save = false) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }

  if (save) {
    try {
      localStorage.setItem('dompetqu_theme', theme);
    } catch (e) {}
  }

  // Update theme toggle buttons in modal
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.getAttribute('data-theme-val') === theme);
  });

  // Update text and icon in profile menu
  const desc = document.getElementById('profile-theme-desc');
  const icon = document.getElementById('theme-lucide-icon');
  const iconWrap = document.getElementById('profile-theme-icon');
  if (desc) {
    desc.textContent = theme === 'light' ? 'Mode Terang aktif' : 'Mode Gelap aktif';
  }
  if (iconWrap && icon) {
    if (theme === 'light') {
      iconWrap.style.background = 'rgba(245, 158, 11, 0.15)';
      iconWrap.style.color = '#F59E0B';
      icon.setAttribute('data-lucide', 'sun');
    } else {
      iconWrap.style.background = 'rgba(110, 159, 214, 0.15)';
      iconWrap.style.color = '#6E9FD6';
      icon.setAttribute('data-lucide', 'moon');
    }
  }

  // Update in settings view if present
  const stLabel = document.getElementById('settings-theme-label');
  const stBadge = document.getElementById('settings-theme-badge');
  if (stLabel) {
    stLabel.textContent = theme === 'light' ? 'Calm Light Finance (Emerald Clean)' : 'Calm Dark Finance (Emerald Vibrant)';
  }
  if (stBadge) {
    stBadge.textContent = theme === 'light' ? 'Terang' : 'Gelap';
  }

  refreshIcons();
}

/* ==========================================================================
   PWA & APP INITIALIZATION
   ========================================================================== */

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    const doRegister = () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          console.log('[DompetQu] Service Worker registered with scope:', reg.scope);
        })
        .catch(err => {
          console.warn('[DompetQu] Service Worker registration failed:', err);
        });
    };
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      doRegister();
    } else {
      window.addEventListener('load', doRegister);
    }
  }
}

// Global modal close triggers (buttons with data-close-modal or clicking backdrop)
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const dialog = e.target.closest('dialog');
    if (dialog) closeModal(dialog);
  });
});

document.querySelectorAll('dialog.modal').forEach(dialog => {
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      closeModal(dialog);
    }
  });
});

// App Startup
AuthService.requireAuth(async (user) => {
  currentUser = user;

  // Bind display names
  dom.userDisplayNames.forEach(el => { el.textContent = user.displayName || 'Pengguna'; });
  dom.userEmails.forEach(el => { el.textContent = user.email || ''; });
  updateProfileAvatar(user.displayName || user.email);

  // Init network listeners
  initNetworkStatus();

  // Register PWA service worker
  registerServiceWorker();

  // Preload baseline data
  await refreshBaselineData();

  // Init category management listeners
  initCategoryListeners();

  // Init profile and changelog handlers
  initProfileAndChangelog();

  // Init custom select controls
  CustomSelect.init('tx-pundi');
  CustomSelect.init('tx-dest-pundi');
  CustomSelect.init('tx-category');

  // Bind navigation links (global delegation + direct links)
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-view]');
    if (trigger) {
      e.preventDefault();
      const target = trigger.getAttribute('data-view');
      if (target) navigateTo(target);
    }
  });

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    if (dom.views[hash] && currentView !== hash) {
      navigateTo(hash);
    }
  });

  // Attach live thousands separator (.) formatting to all amount inputs
  Currency.attachAll(document);

  // Back button on Pundi view to return to dashboard
  document.querySelectorAll('.btn-back-dashboard').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('dashboard');
    });
  });

  // FAB / Add Transaction buttons (including center bottom nav button)
  document.querySelectorAll('.btn-open-tx-modal').forEach(btn => {
    btn.addEventListener('click', () => openTxModal());
  });

  document.querySelectorAll('.btn-open-pundi-modal').forEach(btn => {
    btn.addEventListener('click', () => openPundiModal());
  });

  document.querySelectorAll('.btn-open-goal-modal').forEach(btn => {
    btn.addEventListener('click', () => openGoalModal());
  });

  // Handle URL hash on initial load
  const initialHash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(dom.views[initialHash] ? initialHash : 'dashboard');

  // Dismiss boot screen
  if (dom.bootScreen) {
    dom.bootScreen.hidden = true;
  }
  if (dom.appShell) {
    dom.appShell.hidden = false;
  }
});
