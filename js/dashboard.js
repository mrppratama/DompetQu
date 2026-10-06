/**
 * DompetQu - Dashboard Module
 * Central aggregation: Total balance, monthly stats, pundi envelopes, budget warnings, & charts.
 */

import { Currency, DateUtil, BudgetUtil, escapeHtml, refreshIcons } from './utils.js';
import { PundiService } from './pundi.js';
import { TransactionService } from './transaction.js';
import { CategoryService } from './category.js';
import { evaluateBudgetWarnings } from './notifications.js';
import { ChartManager } from './charts.js';
import { SettingsService } from './settings.js';

export const DashboardManager = {
  async loadDashboard(userId, elements) {
    if (!userId || !elements) return;

    // 1. Fetch current month range
    const { start, end } = DateUtil.getCurrentMonthRange();
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    // 2. Fetch Pundis, Categories, and Transactions (efficient single-fetch)
    const [pundis, categories, monthTransactions, allRecentTransactions] = await Promise.all([
      PundiService.getPundis(userId, false), // active pundis only
      CategoryService.getCategories(userId),
      TransactionService.getTransactions(userId, { startDate: startStr, endDate: endStr }),
      TransactionService.getTransactions(userId) // all recent for transaction list
    ]);

    const settings = SettingsService.getSettings();
    const activeWidgets = settings.widgets || {};

    // 3. Compute Total Balance across all active Pundis
    const totalBalance = pundis.reduce((sum, p) => sum + Number(p.balance || 0), 0);

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

    const netCashFlow = monthIncome - monthExpense;

    // --- Render Balance & Stat Row ---
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
      elements.netCashFlowEl.textContent = Currency.format(netCashFlow);
      elements.netCashFlowEl.className = netCashFlow >= 0 ? 'text-income' : 'text-expense';
    }

    // Toggle widgets visibility based on user preferences
    if (elements.widgetIncome) elements.widgetIncome.hidden = !activeWidgets.income;
    if (elements.widgetExpense) elements.widgetExpense.hidden = !activeWidgets.expense;
    if (elements.widgetNet) elements.widgetNet.hidden = !activeWidgets.netCashFlow;

    // --- Render Budget Warnings ---
    if (elements.warningsContainer && activeWidgets.budgetWarning) {
      const warnings = evaluateBudgetWarnings(pundis, expenseByPundiMap);
      if (warnings.length === 0) {
        elements.warningsContainer.innerHTML = '';
        elements.warningsContainer.closest('.section').hidden = true;
      } else {
        elements.warningsContainer.closest('.section').hidden = false;
        elements.warningsContainer.innerHTML = warnings.map(w => `
          <div class="alert alert-${w.level}">
            <i data-lucide="alert-triangle" class="icon" style="width:18px;height:18px;"></i>
            <div>${escapeHtml(w.message)}</div>
          </div>
        `).join('');
      }
    } else if (elements.warningsContainer) {
      elements.warningsContainer.closest('.section').hidden = true;
    }

    // --- Render Pundi-Pundi Mini Cards ---
    if (elements.pundiListContainer && activeWidgets.pundiList) {
      elements.pundiListContainer.closest('.section').hidden = false;
      if (pundis.length === 0) {
        elements.pundiListContainer.innerHTML = `
          <div class="card empty">
            <div class="empty-icon"><i data-lucide="wallet" style="width:24px;height:24px;"></i></div>
            <p class="empty-title">Belum ada Pundi</p>
            <p class="empty-text">Buat Pundi untuk membagi uang Anda dengan metode envelope budgeting.</p>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-create-first-pundi">Buat Pundi</button>
          </div>
        `;
      } else {
        elements.pundiListContainer.innerHTML = pundis.map(p => {
          const expense = expenseByPundiMap[p.id] || 0;
          const budget = Number(p.monthlyBudget || 0);
          const usage = BudgetUtil.calculateUsage(expense, budget);
          const status = BudgetUtil.getStatus(usage);

          return `
            <div class="card pundi-row" data-pundi-id="${p.id}">
              <div class="avatar avatar-sm" style="background:${p.color || '#10B981'}20; color:${p.color || '#10B981'};">
                <i data-lucide="${escapeHtml(p.icon || 'wallet')}" style="width:18px;height:18px;"></i>
              </div>
              <div class="pundi-main" style="min-width:0;">
                <div class="pundi-row-name">${escapeHtml(p.name)}</div>
                <div class="pundi-row-sub">${Currency.format(p.balance || 0)} saldo &bull; ${usage}% digunakan</div>
              </div>
              <div class="badge ${status.badgeClass}">${status.label}</div>
              <div class="progress ${status.class}" style="grid-column: 1 / -1; margin-top: 6px;">
                <span style="width: ${Math.min(100, usage)}%;"></span>
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
            <button type="button" class="btn btn-primary btn-sm" id="btn-create-first-tx">Tambah Transaksi</button>
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
                const pundi = pundiMap[t.pundiId] || { name: 'Pundi' };
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
