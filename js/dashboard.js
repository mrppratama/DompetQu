/**
 * DompetQu - Dashboard Module
 * Central aggregation: Total balance, monthly stats, pundi envelopes, budget warnings, & charts.
 */

import { Currency, DateUtil, BudgetUtil, escapeHtml, refreshIcons, resolvePundiIcon } from './utils.js';
import { PundiService } from './pundi.js';
import { TransactionService } from './transaction.js';
import { CategoryService } from './category.js';
import { evaluateBudgetWarnings } from './notifications.js';
import { ChartManager } from './charts.js';
import { SettingsService } from './settings.js';

export const DashboardManager = {
  async loadDashboard(userId, elements) {
    if (!userId || !elements) return;

    // 1. Fetch current month range using local date conversion
    const { start, end } = DateUtil.getCurrentMonthRange();
    const startStr = DateUtil.toLocalDateString(start);
    const endStr = DateUtil.toLocalDateString(end);

    // 2. Fetch Pundis, Categories, and All Transactions in parallel (single query)
    const [pundis, categories, allRecentTransactions] = await Promise.all([
      PundiService.getPundis(userId, false), // active pundis only
      CategoryService.getCategories(userId),
      TransactionService.getTransactions(userId)
    ]);

    // Fast in-memory filter for month transactions to eliminate duplicate network queries
    const monthTransactions = allRecentTransactions.filter(t => {
      const d = t.date;
      return d && d >= startStr && d <= endStr;
    });

    const settings = SettingsService.getSettings();
    const activeWidgets = settings.widgets || {};

    // 3. Compute Total Balance: Total Saldo Dompet = Saldo Awal + Total Pemasukan - Total Pengeluaran
    let allIncome = 0;
    let allExpense = 0;
    allRecentTransactions.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.type === 'INCOME') allIncome += amt;
      else if (t.type === 'EXPENSE') allExpense += amt;
    });

    const initialBalance = Number(settings.initialBalance || 0);
    const totalPundiBalance = pundis.reduce((sum, p) => sum + Number(p.balance || 0), 0);
    // Strict E-Wallet balance formula: Saldo Awal + Total Pemasukan - Total Pengeluaran
    const totalBalance = initialBalance + allIncome - allExpense;

    // 4. Compute Month Incomes and Expenses
    let monthIncome = 0;
    let monthExpense = 0;
    const expenseByPundiMap = {};
    const expenseByCategoryMap = {};

    monthTransactions.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.type === 'INCOME') {
        monthIncome += amt;
      } else if (t.type === 'EXPENSE') {
        monthExpense += amt;
        expenseByPundiMap[t.pundiId] = (expenseByPundiMap[t.pundiId] || 0) + amt;

        const catId = t.categoryId || 'other';
        expenseByCategoryMap[catId] = (expenseByCategoryMap[catId] || 0) + amt;
      }
    });

    // --- Render Balance & Stat Row (Total Saldo, Pemasukan, Pengeluaran) ---
    if (elements.totalBalanceEl) {
      elements.totalBalanceEl.textContent = Currency.format(totalBalance);
    }
    if (elements.monthIncomeEl) {
      elements.monthIncomeEl.textContent = Currency.format(monthIncome);
    }
    if (elements.monthExpenseEl) {
      elements.monthExpenseEl.textContent = Currency.format(monthExpense);
    }
    if (elements.netCashFlowEl) {
      elements.netCashFlowEl.textContent = '';
    }

    // Toggle widgets visibility based on user preferences
    if (elements.widgetIncome) elements.widgetIncome.hidden = !activeWidgets.income;
    if (elements.widgetExpense) elements.widgetExpense.hidden = !activeWidgets.expense;
    if (elements.widgetNet) elements.widgetNet.hidden = true;

    // --- Hide standalone warnings container ---
    if (elements.warningsContainer) {
      elements.warningsContainer.innerHTML = '';
      if (elements.warningsContainer.closest('.section')) {
        elements.warningsContainer.closest('.section').hidden = true;
      }
    }

    // --- Render Kantong Uang Mini Cards (Pure Envelope concept: No budget, no progress bar) ---
    if (elements.pundiListContainer && activeWidgets.pundiList) {
      elements.pundiListContainer.closest('.section').hidden = false;
      if (pundis.length === 0) {
        elements.pundiListContainer.innerHTML = `
          <div class="card empty">
            <div class="empty-icon"><i data-lucide="wallet-cards" style="width:24px;height:24px;"></i></div>
            <p class="empty-title">Belum ada Kantong</p>
            <p class="empty-text">Buat Kantong untuk membagi uang Anda ke pos-pos kebutuhan.</p>
            <button type="button" class="btn btn-secondary btn-sm btn-open-pundi-modal" id="btn-create-first-pundi">Buat Kantong</button>
          </div>
        `;
      } else {
        elements.pundiListContainer.innerHTML = pundis.map(p => {
          return `
            <div class="card pundi-row" data-pundi-id="${p.id}" data-view="pundi" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px;">
              <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                <div class="avatar avatar-sm" style="background:${p.color || '#10B981'}20; color:${p.color || '#10B981'}; flex-shrink: 0;">
                  <i data-lucide="${escapeHtml(resolvePundiIcon(p.icon))}" style="width:18px;height:18px;"></i>
                </div>
                <div class="pundi-main" style="min-width:0;">
                  <div class="pundi-row-name" style="font-weight: 600; font-size: 14px;">${escapeHtml(p.name)}</div>
                  <div class="pundi-row-sub" style="font-size: 12px; color: var(--text-2);">${escapeHtml(p.description || 'Kantong Uang')}</div>
                </div>
              </div>
              <div class="pundi-row-amount" style="font-weight: 700; font-size: 14px; color: var(--text-1); flex-shrink: 0;">
                ${Currency.format(p.balance || 0)}
              </div>
            </div>
          `;
        }).join('');
      }
    } else if (elements.pundiListContainer) {
      elements.pundiListContainer.closest('.section').hidden = true;
    }


    // --- Render Expense Doughnut Chart & Legend ---
    if (elements.chartCanvas && activeWidgets.expenseChart) {
      elements.chartCanvas.closest('.section').hidden = false;
      const catMap = {};
      categories.forEach(c => { catMap[c.id] = c; });

      const catChartData = Object.keys(expenseByCategoryMap).map(catId => {
        const cat = catMap[catId] || { name: 'Lainnya', color: '#737A83' };
        return {
          name: cat.name,
          color: cat.color,
          total: expenseByCategoryMap[catId]
        };
      }).sort((a, b) => b.total - a.total);

      ChartManager.renderExpenseDistribution(elements.chartCanvas, catChartData);

      if (elements.chartLegend) {
        if (catChartData.length === 0 || monthExpense === 0) {
          elements.chartLegend.innerHTML = '<li class="subtle small">Belum ada pengeluaran bulan ini.</li>';
        } else {
          elements.chartLegend.innerHTML = catChartData.slice(0, 5).map(item => {
            const pct = Math.round((item.total / monthExpense) * 100);
            return `
              <li>
                <span class="legend-dot" style="--c: ${item.color || '#10B981'};"></span>
                <span class="legend-name">${escapeHtml(item.name)}</span>
                <span class="num">${Currency.format(item.total)}</span>
                <span class="legend-pct">${pct}%</span>
              </li>
            `;
          }).join('');
        }
      }
    } else if (elements.chartCanvas) {
      elements.chartCanvas.closest('.section').hidden = true;
    }

    // --- Render Recent Transactions (Latest 5) ---
    if (elements.recentTxContainer && activeWidgets.recentTransactions) {
      elements.recentTxContainer.closest('.section').hidden = false;
      const recent = allRecentTransactions.slice(0, 5);

      if (recent.length === 0) {
        elements.recentTxContainer.innerHTML = `
          <div class="card empty">
            <div class="empty-icon"><i data-lucide="arrow-left-right" style="width:24px;height:24px;"></i></div>
            <p class="empty-title">Belum ada transaksi</p>
            <p class="empty-text">Catat pengeluaran dan pemasukan pertama Anda.</p>
            <button type="button" class="btn btn-primary btn-sm btn-open-tx-modal" id="btn-create-first-tx">Tambah Transaksi</button>
          </div>
        `;
      } else {
        const catMap = {};
        categories.forEach(c => { catMap[c.id] = c; });
        const pundiMap = {};
        pundis.forEach(p => { pundiMap[p.id] = p; });

        elements.recentTxContainer.innerHTML = `
          <div class="card card-flush">
            <ul class="list">
              ${recent.map(t => {
                const cat = catMap[t.categoryId] || { name: 'Kategori', icon: 'tag' };
                const pundi = t.pundiId === 'MAIN_WALLET' ? { name: 'Saldo Tersedia' } : (pundiMap[t.pundiId] || { name: 'Kantong' });
                const signed = Currency.formatSigned(t.type, t.amount);

                let iconName = cat.icon || 'arrow-left-right';
                if (t.type === 'INCOME') iconName = 'trending-up';
                if (t.type === 'TRANSFER') iconName = 'arrow-right-left';

                return `
                  <li>
                    <button type="button" class="tx-row" data-tx-id="${t.id}">
                      <div class="avatar avatar-sm tx-icon-${t.type}">
                        <i data-lucide="${iconName}" style="width:16px;height:16px;"></i>
                      </div>
                      <div class="tx-main">
                        <div class="tx-title">${escapeHtml(t.note || cat.name)}</div>
                        <div class="tx-meta">${DateUtil.formatDate(t.date, false)} &bull; ${escapeHtml(pundi.name)}</div>
                      </div>
                      <div class="tx-amount amount-${t.type}">${signed}</div>
                    </button>
                  </li>
                `;
              }).join('')}
            </ul>
          </div>
        `;
      }
    } else if (elements.recentTxContainer) {
      elements.recentTxContainer.closest('.section').hidden = true;
    }

    refreshIcons();
  }
};
