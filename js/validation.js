/**
 * DompetQu - Form Validation Logic
 * Strict checking for business rules (non-negative balance, budget, valid targets)
 */

export const Validator = {
  /**
   * Render custom inline validation error under field according to DompetQu design system
   */
  showFieldError(targetEl, message) {
    if (!targetEl) return;
    const field = targetEl.closest('.field') || targetEl.closest('.input-prefix') || targetEl.parentElement;
    if (!field) return;

    field.classList.add('has-error');
    let errorEl = field.querySelector('.field-error-msg');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'field-error-msg';
      field.appendChild(errorEl);
    }
    errorEl.innerHTML = `<i data-lucide="alert-circle" style="width:13px;height:13px;flex-shrink:0;"></i><span>${message}</span>`;
    if (window.lucide) window.lucide.createIcons();

    // Clear error as soon as user inputs or changes
    const clearHandler = () => {
      this.clearFieldError(targetEl);
      targetEl.removeEventListener('input', clearHandler);
      targetEl.removeEventListener('change', clearHandler);
    };
    targetEl.addEventListener('input', clearHandler);
    targetEl.addEventListener('change', clearHandler);

    try {
      if (typeof targetEl.focus === 'function') targetEl.focus();
    } catch (e) {}
  },

  clearFieldError(targetEl) {
    if (!targetEl) return;
    const field = targetEl.closest('.field') || targetEl.closest('.input-prefix') || targetEl.parentElement;
    if (!field) return;
    field.classList.remove('has-error');
    const errorEl = field.querySelector('.field-error-msg');
    if (errorEl) errorEl.remove();
  },

  clearFormErrors(formEl) {
    if (!formEl) return;
    formEl.querySelectorAll('.field.has-error').forEach(f => f.classList.remove('has-error'));
    formEl.querySelectorAll('.field-error-msg').forEach(msg => msg.remove());
  },
  validateTransaction({ type, amount, pundiId, destinationPundiId, categoryId, date, sourcePundiBalance }) {
    const errors = [];

    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      errors.push('Nominal harus lebih dari Rp0.');
    }

    if (!date) {
      errors.push('Tanggal transaksi wajib diisi.');
    }

    if (!pundiId) {
      errors.push('Pundi wajib dipilih.');
    }

    if (type === 'EXPENSE') {
      if (!categoryId) {
        errors.push('Kategori pengeluaran wajib dipilih.');
      }
      // Check balance non-negative rule
      if (typeof sourcePundiBalance === 'number' && numAmount > sourcePundiBalance) {
        errors.push('Saldo Pundi tidak mencukupi.');
      }
    }

    if (type === 'TRANSFER') {
      if (!destinationPundiId) {
        errors.push('Pundi tujuan transfer wajib dipilih.');
      } else if (pundiId === destinationPundiId) {
        errors.push('Pundi sumber dan tujuan tidak boleh sama.');
      }

      if (typeof sourcePundiBalance === 'number' && numAmount > sourcePundiBalance) {
        errors.push('Saldo Pundi tidak mencukupi untuk transfer.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      firstError: errors[0] || null
    };
  },

  validatePundi({ name, monthlyBudget }) {
    const errors = [];
    if (!name || !name.trim()) {
      errors.push('Nama Pundi wajib diisi.');
    }
    const numBudget = Number(monthlyBudget);
    if (isNaN(numBudget) || numBudget < 0) {
      errors.push('Anggaran bulanan tidak valid.');
    }
    return {
      isValid: errors.length === 0,
      errors,
      firstError: errors[0] || null
    };
  },

  validateGoal({ name, targetAmount, deadline }) {
    const errors = [];
    if (!name || !name.trim()) {
      errors.push('Nama target keuangan wajib diisi.');
    }
    const numTarget = Number(targetAmount);
    if (!numTarget || isNaN(numTarget) || numTarget <= 0) {
      errors.push('Target nominal harus lebih dari Rp0.');
    }
    return {
      isValid: errors.length === 0,
      errors,
      firstError: errors[0] || null
    };
  },

  validateCategory({ name, type }) {
    const errors = [];
    if (!name || !name.trim()) {
      errors.push('Nama kategori wajib diisi.');
    }
    if (!type || !['INCOME', 'EXPENSE'].includes(type)) {
      errors.push('Jenis kategori tidak valid.');
    }
    return {
      isValid: errors.length === 0,
      errors,
      firstError: errors[0] || null
    };
  }
};
