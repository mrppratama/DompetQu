/**
 * DompetQu - Categories Management
 * Handles default initial categories, custom user categories, and archiving.
 */

import {
  db,
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  isConfigured
} from './firebase-config.js';

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Makanan', type: 'EXPENSE', icon: 'utensils', color: '#5FBF8F' },
  { name: 'Transportasi', type: 'EXPENSE', icon: 'car', color: '#6E9FD6' },
  { name: 'Tagihan', type: 'EXPENSE', icon: 'receipt', color: '#D6A85F' },
  { name: 'Belanja', type: 'EXPENSE', icon: 'shopping-bag', color: '#B57EDC' },
  { name: 'Hiburan', type: 'EXPENSE', icon: 'gamepad-2', color: '#E58A9D' },
  { name: 'Kesehatan', type: 'EXPENSE', icon: 'heart-pulse', color: '#D97878' },
  { name: 'Pendidikan', type: 'EXPENSE', icon: 'graduation-cap', color: '#5FB8BF' },
  { name: 'Kebutuhan Rumah', type: 'EXPENSE', icon: 'home', color: '#A0A6AD' },
  { name: 'Lainnya', type: 'EXPENSE', icon: 'more-horizontal', color: '#737A83' }
];

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Gaji', type: 'INCOME', icon: 'banknote', color: '#5FBF8F' },
  { name: 'Bonus', type: 'INCOME', icon: 'sparkles', color: '#D6A85F' },
  { name: 'Freelance', type: 'INCOME', icon: 'briefcase', color: '#6E9FD6' },
  { name: 'Bisnis', type: 'INCOME', icon: 'trending-up', color: '#5FB8BF' },
  { name: 'Hadiah', type: 'INCOME', icon: 'gift', color: '#E58A9D' },
  { name: 'Lainnya', type: 'INCOME', icon: 'plus-circle', color: '#737A83' }
];

export const CategoryService = {
  /**
   * Seed default categories into user's subcollection on first registration
   */
  async initDefaultCategories(userId) {
    if (!userId) return;

    if (!isConfigured || !db) {
      // Demo / offline fallback memory
      const list = [
        ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({ id: `exp_${i}`, ...c, isArchived: false })),
        ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({ id: `inc_${i}`, ...c, isArchived: false }))
      ];
      localStorage.setItem(`dompetqu_categories_${userId}`, JSON.stringify(list));
      return list;
    }

    try {
      const colRef = collection(db, 'users', userId, 'categories');
      const snap = await getDocs(colRef);
      if (!snap.empty) return; // already initialized

      const all = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];
      for (const item of all) {
        await addDoc(colRef, {
          name: item.name,
          type: item.type,
          icon: item.icon,
          color: item.color,
          isArchived: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error('[DompetQu] Failed to init default categories:', err);
    }
  },

  /**
   * Fetch all user categories
   */
  async getCategories(userId) {
    if (!userId) return [];

    if (!isConfigured || !db) {
      const stored = localStorage.getItem(`dompetqu_categories_${userId}`);
      if (stored) {
        try { return JSON.parse(stored); } catch (e) {}
      }
      return [
        ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({ id: `exp_${i}`, ...c, isArchived: false })),
        ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({ id: `inc_${i}`, ...c, isArchived: false }))
      ];
    }

    try {
      const colRef = collection(db, 'users', userId, 'categories');
      const snap = await getDocs(colRef);
      const list = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort alphabetically
      list.sort((a, b) => a.name.localeCompare(b.name));
      return list;
    } catch (err) {
      console.error('[DompetQu] Error fetching categories:', err);
      return [];
    }
  },

  async addCategory(userId, { name, type, icon, color }) {
    if (!userId) throw new Error('User belum login');

    if (!isConfigured || !db) {
      const list = await this.getCategories(userId);
      const newCat = {
        id: `cat_${Date.now()}`,
        name: name.trim(),
        type,
        icon: icon || 'tag',
        color: color || '#5FBF8F',
        isArchived: false,
        createdAt: new Date().toISOString()
      };
      list.push(newCat);
      localStorage.setItem(`dompetqu_categories_${userId}`, JSON.stringify(list));
      return newCat;
    }

    const colRef = collection(db, 'users', userId, 'categories');
    const docRef = await addDoc(colRef, {
      name: name.trim(),
      type,
      icon: icon || 'tag',
      color: color || '#5FBF8F',
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, name, type, icon, color, isArchived: false };
  },

  async updateCategory(userId, categoryId, data) {
    if (!userId || !categoryId) return;

    if (!isConfigured || !db) {
      const list = await this.getCategories(userId);
      const idx = list.findIndex(c => c.id === categoryId);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
        localStorage.setItem(`dompetqu_categories_${userId}`, JSON.stringify(list));
      }
      return;
    }

    const docRef = doc(db, 'users', userId, 'categories', categoryId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  async toggleArchiveCategory(userId, categoryId, isArchived) {
    return this.updateCategory(userId, categoryId, { isArchived });
  }
};
