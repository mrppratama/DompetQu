/**
 * DompetQu - Utility Module
 * Formatters, Date helpers, Sanitizers, Budget math, & Debounce
 */

export const Currency = {
  formatter: new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }),

  /**
   * Format integer value into IDR string.
   * e.g. 5700000 -> "Rp 5.700.000" (or "Rp5.700.000")
   */
  format(val) {
    if (val === null || val === undefined || isNaN(val)) return 'Rp0';
    return this.formatter.format(Number(val)).replace(/\s+/g, '');
  },

  /**
   * Format signed amount
   */
  formatSigned(type, val) {
    const formatted = this.format(val);
    if (type === 'INCOME') return `+${formatted}`;
    if (type === 'EXPENSE') return `-${formatted}`;
    return formatted;
  },

  /**
   * Format integer value into thousands-separated string (e.g. 50000 -> "50.000")
   */
  formatNumber(val) {
    if (val === null || val === undefined || val === '') return '';
    const clean = String(val).replace(/[^0-9]/g, '');
    if (!clean) return '';
    const num = parseInt(clean, 10);
    return new Intl.NumberFormat('id-ID').format(num);
  },

  /**
   * Parse user input text into clean integer
   * e.g. "5.700.000" or "Rp 5.700.000" -> 5700000
   */
  parse(str) {
    if (typeof str === 'number') return Math.round(str);
    if (!str) return 0;
    const clean = String(str).replace(/[^0-9]/g, '');
    return clean ? parseInt(clean, 10) : 0;
  },

  /**
   * Attach live thousands separator formatting to an input element
   */
  attachFormatter(input) {
    if (!input || input._hasCurrencyFormatter) return;
    input._hasCurrencyFormatter = true;

    // Handle backspace when cursor is directly after a '.' separator
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        const cursor = input.selectionStart;
        if (cursor > 0 && input.selectionEnd === cursor) {
          const charBefore = input.value[cursor - 1];
          if (charBefore === '.' || charBefore === ',') {
            e.preventDefault();
            const val = input.value;
            input.value = val.slice(0, cursor - 2) + val.slice(cursor - 1);
            input.setSelectionRange(cursor - 2, cursor - 2);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }
    });

    input.addEventListener('input', () => {
      const rawVal = input.value;
      const cursor = input.selectionStart || 0;

      // Count how many digits exist before the cursor in rawVal
      const digitsBeforeCursor = (rawVal.slice(0, cursor).match(/\d/g) || []).length;

      // Extract raw digits
      const cleanDigits = rawVal.replace(/\D/g, '');
      if (!cleanDigits) {
        input.value = '';
        return;
      }

      // Convert to formatted integer with '.' separator
      const num = parseInt(cleanDigits, 10);
      const formatted = new Intl.NumberFormat('id-ID').format(num);
      input.value = formatted;

      // Restore cursor position matching digits count
      let newCursor = 0;
      let countedDigits = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) {
          countedDigits++;
        }
        if (countedDigits >= digitsBeforeCursor) {
          newCursor = i + 1;
          break;
        }
      }

      if (countedDigits < digitsBeforeCursor) {
        newCursor = formatted.length;
      }

      input.setSelectionRange(newCursor, newCursor);
    });
  },

  /**
   * Attach formatter to all matching currency input elements
   */
  attachAll(root = document) {
    const selectors = [
      '#tx-amount',
      '#return-pundi-amount',
      '#allocate-pundi-amount',
      '#goal-target',
      '#goal-current',
      '#saving-amount',
      '.input-amount',
      'input[data-currency-input]'
    ];
    root.querySelectorAll(selectors.join(', ')).forEach(input => {
      this.attachFormatter(input);
    });
  }
};

export const DateUtil = {
  /**
   * Convert Date object to local YYYY-MM-DD string
   */
  toLocalDateString(dateInput) {
    if (!dateInput) return '';
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Today in YYYY-MM-DD using local time
   */
  todayString() {
    return this.toLocalDateString(new Date());
  },

  /**
   * Format date into readable Indonesian string
   * e.g. "06 Okt 2026" or "06 Okt"
   */
  formatDate(dateInput, includeYear = true) {
    if (!dateInput) return '-';
    // If string like "2026-10-07", parse with local parts to avoid UTC shift
    let d;
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [y, m, day] = dateInput.split('-').map(Number);
      d = new Date(y, m - 1, day);
    } else {
      d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    }
    if (isNaN(d.getTime())) return '-';

    const opts = {
      day: 'numeric',
      month: 'short',
      ...(includeYear ? { year: 'numeric' } : {})
    };
    return d.toLocaleDateString('id-ID', opts);
  },

  formatFull(dateInput) {
    if (!dateInput) return '-';
    let d;
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [y, m, day] = dateInput.split('-').map(Number);
      d = new Date(y, m - 1, day);
    } else {
      d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    }
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  },

  getMonthRange(year, monthIndex) {
    const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    return { start, end };
  },

  getCurrentMonthRange() {
    const now = new Date();
    return this.getMonthRange(now.getFullYear(), now.getMonth());
  },

  getLastMonthRange() {
    const now = new Date();
    return this.getMonthRange(now.getFullYear(), now.getMonth() - 1);
  },

  getLast7DaysRange() {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  },

  /**
   * Unified Period Range Calculator conforming to DompetQu Global Rules:
   * 1. Hari Ini: 00:00 - 23:59:59 hari berjalan
   * 2. 7 Hari: 7 hari terakhir termasuk hari ini (e.g. 1 Okt - 7 Okt)
   * 3. Bulan Ini: tanggal 1 bulan berjalan sampai hari berjalan
   * 4. Bulan Lalu: tanggal 1 sampai hari terakhir bulan sebelumnya
   * 5. Custom: customStart s.d. customEnd
   */
  getPeriodRange(periodKey = 'today', customStart = null, customEnd = null) {
    const now = new Date();
    const todayStr = this.toLocalDateString(now);

    if (periodKey === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return {
        period: 'today',
        startDate: todayStr,
        endDate: todayStr,
        startObj: start,
        endObj: end,
        label: `Hari Ini (${this.formatDate(todayStr)})`,
        shortLabel: 'Hari Ini',
        displayRange: this.formatDate(todayStr)
      };
    }

    if (periodKey === '7days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);

      const startStr = this.toLocalDateString(start);
      const endStr = this.toLocalDateString(end);
      return {
        period: '7days',
        startDate: startStr,
        endDate: endStr,
        startObj: start,
        endObj: end,
        label: `7 Hari (${this.formatDate(startStr, false)} - ${this.formatDate(endStr)})`,
        shortLabel: '7 Hari',
        displayRange: `${this.formatDate(startStr, false)} - ${this.formatDate(endStr)}`
      };
    }

    if (periodKey === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);

      const startStr = this.toLocalDateString(start);
      const endStr = this.toLocalDateString(end);
      return {
        period: 'month',
        startDate: startStr,
        endDate: endStr,
        startObj: start,
        endObj: end,
        label: `Bulan Ini (${this.formatDate(startStr, false)} - ${this.formatDate(endStr)})`,
        shortLabel: 'Bulan Ini',
        displayRange: `${this.formatDate(startStr, false)} - ${this.formatDate(endStr)}`
      };
    }

    if (periodKey === 'lastmonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      const startStr = this.toLocalDateString(start);
      const endStr = this.toLocalDateString(end);
      return {
        period: 'lastmonth',
        startDate: startStr,
        endDate: endStr,
        startObj: start,
        endObj: end,
        label: `Bulan Lalu (${this.formatDate(startStr, false)} - ${this.formatDate(endStr)})`,
        shortLabel: 'Bulan Lalu',
        displayRange: `${this.formatDate(startStr, false)} - ${this.formatDate(endStr)}`
      };
    }

    if (periodKey === 'custom') {
      const s = customStart || todayStr;
      const e = customEnd || todayStr;
      return {
        period: 'custom',
        startDate: s,
        endDate: e,
        startObj: new Date(s + 'T00:00:00'),
        endObj: new Date(e + 'T23:59:59'),
        label: `Custom (${this.formatDate(s, false)} - ${this.formatDate(e)})`,
        shortLabel: `${this.formatDate(s, false)} - ${this.formatDate(e)}`,
        displayRange: `${this.formatDate(s, false)} - ${this.formatDate(e)}`
      };
    }

    // Default fallback: 'today'
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return {
      period: 'today',
      startDate: todayStr,
      endDate: todayStr,
      startObj: start,
      endObj: end,
      label: `Hari Ini (${this.formatDate(todayStr)})`,
      shortLabel: 'Hari Ini',
      displayRange: this.formatDate(todayStr)
    };
  },

  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }
};

/**
 * Budget usage calculator & status badge
 */
export const BudgetUtil = {
  calculateUsage(expense, budget) {
    if (!budget || budget <= 0) return 0;
    return Math.round((expense / budget) * 100);
  },

  getStatus(usage) {
    if (usage >= 100) return { key: 'exceeded', label: 'Batas Terlampaui', class: 'is-exceeded', badgeClass: 'badge-exceeded' };
    if (usage >= 90) return { key: 'critical', label: 'Hampir Habis', class: 'is-critical', badgeClass: 'badge-critical' };
    if (usage >= 75) return { key: 'warning', label: 'Peringatan', class: 'is-warning', badgeClass: 'badge-warning' };
    return { key: 'normal', label: 'Aman', class: 'is-normal', badgeClass: 'badge-normal' };
  }
};

/**
 * Safe HTML string escape
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Debounce helper
 */
export function debounce(fn, delay = 250) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Trigger lucide icons refresh if available globally
 * Guarantees icon rendering without requiring browser refresh
 */
export function refreshIcons() {
  if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
    try {
      window.lucide.createIcons();
    } catch (e) {}

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        try {
          if (window.lucide) window.lucide.createIcons();
        } catch (e) {}
      });
    }
  }
}

/**
 * Generate lightweight unique ID for client objects
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Standard list of persistent Lucide icons for Kantong Uang
 */
export const AVAILABLE_PUNDI_ICONS = [
  { id: 'wallet-cards', label: 'Kantong Uang' },
  { id: 'wallet', label: 'Dompet' },
  { id: 'utensils', label: 'Makanan & Kuliner' },
  { id: 'coffee', label: 'Makan & Kafe' },
  { id: 'vault', label: 'Brankas' },
  { id: 'shopping-bag', label: 'Belanja' },
  { id: 'home', label: 'Rumah & Tempat Tinggal' },
  { id: 'car', label: 'Transportasi' },
  { id: 'heart-pulse', label: 'Kesehatan' },
  { id: 'gift', label: 'Hadiah' },
  { id: 'graduation-cap', label: 'Pendidikan' },
  { id: 'zap', label: 'Tagihan & Listrik' },
  { id: 'shield', label: 'Darurat' },
  { id: 'smile', label: 'Hiburan' }
];

/**
 * Safely resolve a Kantong icon ID with guaranteed fallback to wallet-cards
 */
export function resolvePundiIcon(iconName) {
  if (!iconName || typeof iconName !== 'string') return 'wallet-cards';
  const clean = iconName.trim().toLowerCase();
  if (clean === 'piggy-bank' || clean === 'pig') return 'wallet-cards';
  const exists = AVAILABLE_PUNDI_ICONS.some(item => item.id === clean);
  return exists ? clean : 'wallet-cards';
}
