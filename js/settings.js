/**
 * DompetQu - User Settings & Dashboard Customization
 * Manages preferences (widgets visibility), user profile, and custom Firebase credentials.
 */

const SETTINGS_KEY = 'dompetqu_user_settings';

export const DEFAULT_SETTINGS = {
  widgets: {
    totalBalance: true,
    income: true,
    expense: true,
    netCashFlow: true,
    pundiList: true,
    expenseChart: true,
    recentTransactions: true,
    budgetWarning: true,
    goals: true
  },
  currency: 'IDR',
  budgetWarningThreshold: 75
};

export const SettingsService = {
  getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
  },

  saveSettings(newSettings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...newSettings };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Failed to save settings', e);
      return DEFAULT_SETTINGS;
    }
  },

  setWidgetVisible(widgetKey, isVisible) {
    const current = this.getSettings();
    current.widgets[widgetKey] = Boolean(isVisible);
    return this.saveSettings(current);
  }
};
