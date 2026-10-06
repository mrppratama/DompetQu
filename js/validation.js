/**
 * DompetQu - Form Validation Logic
 * Strict checking for business rules (non-negative balance, budget, valid targets)
 */

export const Validator = {
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
