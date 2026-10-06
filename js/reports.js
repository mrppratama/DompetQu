/**
 * DompetQu - Reports Generation & Summary
 * Aggregates cash flow, categories, pundis, and builds a copy-ready textual summary.
 */

import { Currency, DateUtil } from './utils.js';

export const ReportService = {
  /**
   * Aggregate transactions into structured financial report
   */
  generateReport(transactions, pundis, categories, periodName) {
    let totalIncome = 0;
    let totalExpense = 0;

    const categoryMap = {};
    categories.forEach(c => { categoryMap[c.id] = c; });

    const pundiMap = {};
    pundis.forEach(p => { pundiMap[p.id] = p; });

    const expenseByCategory = {};
    const expenseByPundi = {};

    transactions.forEach(t => {
      const amt = Number(t.amount || 0);

      if (t.type === 'INCOME') {
        totalIncome += amt;
      } else if (t.type === 'EXPENSE') {
        totalExpense += amt;

        // By Category
        const cat = categoryMap[t.categoryId] || { name: 'Lainnya', color: '#737A83', icon: 'tag' };
        if (!expenseByCategory[cat.name]) {
          expenseByCategory[cat.name] = { name: cat.name, color: cat.color, icon: cat.icon, total: 0 };
        }
        expenseByCategory[cat.name].total += amt;

        // By Pundi
        const pundi = pundiMap[t.pundiId] || { name: 'Pundi Lain', color: '#5FBF8F' };
        if (!expenseByPundi[pundi.name]) {
          expenseByPundi[pundi.name] = { name: pundi.name, color: pundi.color, total: 0 };
        }
        expenseByPundi[pundi.name].total += amt;
      }
    });

    const netCashFlow = totalIncome - totalExpense;

    const categoryList = Object.values(expenseByCategory).sort((a, b) => b.total - a.total);
    const pundiList = Object.values(expenseByPundi).sort((a, b) => b.total - a.total);

    return {
      periodName: periodName || 'Semua Periode',
      totalIncome,
      totalExpense,
      netCashFlow,
      categoryList,
      pundiList,
      txCount: transactions.length
    };
  },

  /**
   * Generate clean formatted plain text report ready for clipboard copy
   */
  buildCopyableText(reportData) {
    const lines = [
      `📊 LAPORAN KEUANGAN DOMPETQU`,
      `Periode: ${reportData.periodName}`,
      `Tanggal: ${DateUtil.formatDate(new Date())}`,
      `--------------------------------`,
      `Pemasukan    : ${Currency.format(reportData.totalIncome)}`,
      `Pengeluaran  : ${Currency.format(reportData.totalExpense)}`,
      `Saldo Bersih : ${Currency.format(reportData.netCashFlow)}`,
      `--------------------------------`,
      `PENGELUARAN PER KATEGORI:`
    ];

    if (reportData.categoryList.length === 0) {
      lines.push(`(Belum ada pengeluaran)`);
    } else {
      reportData.categoryList.forEach(c => {
        const pct = reportData.totalExpense > 0 ? Math.round((c.total / reportData.totalExpense) * 100) : 0;
        lines.push(`• ${c.name.padEnd(16, ' ')}: ${Currency.format(c.total)} (${pct}%)`);
      });
    }

    lines.push(`--------------------------------`);
    lines.push(`PENGELUARAN PER PUNDI:`);

    if (reportData.pundiList.length === 0) {
      lines.push(`(Belum ada pengeluaran)`);
    } else {
      reportData.pundiList.forEach(p => {
        lines.push(`• ${p.name.padEnd(16, ' ')}: ${Currency.format(p.total)}`);
      });
    }

    lines.push(`--------------------------------`);
    lines.push(`Dibuat otomatis dengan DompetQu (PWA)`);

    return lines.join('\n');
  }
};
