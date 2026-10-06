/**
 * DompetQu - Financial Charts (Chart.js Integration)
 * Calm Dark Doughnut & Line chart with clean tooltips and legend.
 */

import { Currency } from './utils.js';

let expenseDonutInstance = null;
let expenseTrendInstance = null;

const THEME = {
  bg: '#1D2125',
  border: '#30363D',
  text: '#E6E8EB',
  textMuted: '#A0A6AD',
  gridColor: 'rgba(255, 255, 255, 0.05)',
  colors: [
    '#5FBF8F', // primary mint
    '#6E9FD6', // info blue
    '#D6A85F', // warning amber
    '#B57EDC', // soft violet
    '#E58A9D', // soft rose
    '#5FB8BF', // teal
    '#D97878', // muted red
    '#A0A6AD', // silver
    '#737A83'  // slate
  ]
};

export const ChartManager = {
  /**
   * Render Doughnut Chart for Expense distribution
   */
  renderExpenseDistribution(canvasEl, categoryExpenses) {
    if (!canvasEl) return;
    if (typeof window.Chart === 'undefined') {
      console.warn('[DompetQu] Chart.js is not loaded yet');
      return;
    }

    if (expenseDonutInstance) {
      expenseDonutInstance.destroy();
      expenseDonutInstance = null;
    }

    const labels = categoryExpenses.map(item => item.name);
    const data = categoryExpenses.map(item => item.total);
    const backgroundColors = categoryExpenses.map((item, idx) => item.color || THEME.colors[idx % THEME.colors.length]);

    if (data.length === 0 || data.reduce((a, b) => a + b, 0) === 0) {
      // Empty state
      const ctx = canvasEl.getContext('2d');
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      return;
    }

    expenseDonutInstance = new window.Chart(canvasEl, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: backgroundColors,
          borderWidth: 2,
          borderColor: '#1D2125',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            display: false // We render our own crisp, accessible HTML legend
          },
          tooltip: {
            backgroundColor: '#24292E',
            titleColor: '#E6E8EB',
            bodyColor: '#A0A6AD',
            borderColor: '#30363D',
            borderWidth: 1,
            padding: 10,
            displayColors: true,
            boxPadding: 4,
            callbacks: {
              label: function (context) {
                const val = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${Currency.format(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  },

  /**
   * Render Line Chart for daily expense trend
   */
  renderExpenseTrend(canvasEl, dailyData) {
    if (!canvasEl) return;
    if (typeof window.Chart === 'undefined') return;

    if (expenseTrendInstance) {
      expenseTrendInstance.destroy();
      expenseTrendInstance = null;
    }

    const labels = dailyData.map(d => d.label);
    const data = dailyData.map(d => d.amount);

    expenseTrendInstance = new window.Chart(canvasEl, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#5FBF8F',
          backgroundColor: 'rgba(95, 191, 143, 0.08)',
          borderWidth: 2.2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#5FBF8F',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#24292E',
            titleColor: '#E6E8EB',
            bodyColor: '#A0A6AD',
            borderColor: '#30363D',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function (context) {
                return ` Pengeluaran: ${Currency.format(context.raw || 0)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: THEME.gridColor,
              tickColor: 'transparent'
            },
            ticks: {
              color: THEME.textMuted,
              font: { size: 11 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 7
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: THEME.gridColor,
              tickColor: 'transparent'
            },
            ticks: {
              color: THEME.textMuted,
              font: { size: 11 },
              callback: function (val) {
                if (val >= 1000000) return `${(val / 1000000).toFixed(1)}jt`;
                if (val >= 1000) return `${(val / 1000).toFixed(0)}rb`;
                return val;
              }
            }
          }
        }
      }
    });
  }
};
