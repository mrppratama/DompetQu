/**
 * DompetQu - Notifications & Toast System
 * Budget warning alerts, network status, & user-friendly error formatting.
 */

import { refreshIcons } from './utils.js';

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.querySelector('.toast-root');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-root';
      toastContainer.setAttribute('role', 'region');
      toastContainer.setAttribute('aria-label', 'Pemberitahuan');
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

const ICONS = {
  success: 'check-circle-2',
  warning: 'alert-triangle',
  error: 'alert-circle',
  info: 'info'
};

/**
 * Display toast notification
 * @param {string} message
 * @param {'success'|'warning'|'error'|'info'} type
 * @param {number} durationMs
 */
export function showToast(message, type = 'info', durationMs = 3800) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');

  const iconName = ICONS[type] || 'info';
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="icon" style="width:18px;height:18px;"></i>
    <div style="flex:1;min-width:0;">${message}</div>
  `;

  container.appendChild(toast);
  refreshIcons();

  const remove = () => {
    toast.classList.add('is-leaving');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  };

  const timer = setTimeout(remove, durationMs);
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

/**
 * Map Firebase and client errors to user-friendly Indonesian messages
 */
export function formatFriendlyError(error) {
  if (!error) return 'Terjadi kesalahan. Silakan coba lagi.';
  const msg = String(error.message || error);

  if (msg.includes('auth/invalid-email')) return 'Format email tidak valid.';
  if (msg.includes('auth/user-not-found') || msg.includes('auth/wrong-password') || msg.includes('auth/invalid-credential')) {
    return 'Email atau kata sandi tidak cocok.';
  }
  if (msg.includes('auth/email-already-in-use')) return 'Email ini sudah terdaftar. Silakan login.';
  if (msg.includes('auth/weak-password')) return 'Kata sandi terlalu singkat. Minimal 6 karakter.';
  if (msg.includes('auth/network-request-failed')) return 'Koneksi internet bermasalah. Periksa jaringan Anda.';
  if (msg.includes('auth/too-many-requests')) return 'Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat.';
  if (msg.includes('PERMISSION_DENIED') || msg.includes('permission-denied')) {
    return 'Akses ditolak atau sesi login telah berakhir. Silakan login kembali.';
  }
  if (msg.includes('unavailable')) return 'Layanan database sedang tidak dapat dijangkau. Periksa internet Anda.';

  return msg.length > 90 ? 'Data gagal diproses. Periksa koneksi dan coba lagi.' : msg;
}

/**
 * Network status manager
 */
export function initNetworkStatus() {
  const updateStatus = () => {
    const isOnline = navigator.onLine;
    const badges = document.querySelectorAll('.offline-badge');
    const banners = document.querySelectorAll('.offline-banner');

    badges.forEach(b => {
      b.hidden = isOnline;
    });
    banners.forEach(b => {
      b.hidden = isOnline;
    });

    if (!isOnline) {
      showToast('Koneksi internet terputus. Mode offline aktif.', 'warning', 4500);
    }
  };

  window.addEventListener('online', () => {
    updateStatus();
    showToast('Koneksi internet kembali normal.', 'success', 3000);
  });
  window.addEventListener('offline', updateStatus);

  updateStatus();
}

/**
 * Generate budget warning list for pundi items
 * Evaluates 75%, 90%, 100% thresholds
 */
export function evaluateBudgetWarnings(pundiList, expenseByPundiMap) {
  const warnings = [];

  for (const pundi of pundiList) {
    if (pundi.isArchived) continue;
    const budget = Number(pundi.monthlyBudget || 0);
    if (budget <= 0) continue;

    const expense = Number(expenseByPundiMap[pundi.id] || 0);
    const usage = Math.round((expense / budget) * 100);

    if (usage >= 100) {
      warnings.push({
        pundiId: pundi.id,
        pundiName: pundi.name,
        usage,
        type: 'exceeded',
        level: 'danger',
        message: `Budget Kantong ${pundi.name} sudah mencapai batas (${usage}%).`
      });
    } else if (usage >= 90) {
      warnings.push({
        pundiId: pundi.id,
        pundiName: pundi.name,
        usage,
        type: 'critical',
        level: 'danger-soft',
        message: `Budget Kantong ${pundi.name} hampir habis (${usage}%).`
      });
    } else if (usage >= 75) {
      warnings.push({
        pundiId: pundi.id,
        pundiName: pundi.name,
        usage,
        type: 'warning',
        level: 'warning',
        message: `Penggunaan budget Kantong ${pundi.name} sudah mencapai ${usage}%.`
      });
    }
  }

  return warnings;
}
