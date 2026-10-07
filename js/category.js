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
  deleteDoc,
  writeBatch,
  serverTimestamp,
  isConfigured
} from './firebase-config.js';

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Makanan', type: 'EXPENSE', icon: 'utensils', color: '#10B981' },
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
  { name: 'Gaji', type: 'INCOME', icon: 'banknote', color: '#10B981' },
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

      const batch = writeBatch(db);
      const all = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];
      for (const item of all) {
        const newDocRef = doc(colRef);
        batch.set(newDocRef, {
          name: item.name,
          type: item.type,
          icon: item.icon,
          color: item.color,
          isArchived: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
    } catch (err) {
      console.error('[DompetQu] Failed to init default categories:', err);
    }
  },

  /**
   * Fetch all user categories (with auto-seed & foolproof defaults)
   */
  /**
   * Fetch all user categories (with auto-seed & automatic deduplication)
   */
  async getCategories(userId) {
    if (!userId) return [];

    let rawList = [];
    if (!isConfigured || !db) {
      const stored = localStorage.getItem(`dompetqu_categories_${userId}`);
      if (stored) {
        try { rawList = JSON.parse(stored); } catch (e) {}
      } else {
        rawList = [
          ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({ id: `exp_${i}`, ...c, isArchived: false })),
          ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({ id: `inc_${i}`, ...c, isArchived: false }))
        ];
      }
    } else {
      try {
        const colRef = collection(db, 'users', userId, 'categories');
        const snap = await getDocs(colRef);

        if (snap.empty) {
          await this.initDefaultCategories(userId);
          const retrySnap = await getDocs(colRef);
          retrySnap.forEach(docSnap => {
            rawList.push({ id: docSnap.id, ...docSnap.data() });
          });
        } else {
          snap.forEach(docSnap => {
            rawList.push({ id: docSnap.id, ...docSnap.data() });
          });
        }
      } catch (err) {
        console.error('[DompetQu] Error fetching categories:', err);
      }
    }

    if (!rawList || rawList.length === 0) {
      rawList = [
        ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({ id: `exp_${i}`, ...c, isArchived: false })),
        ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({ id: `inc_${i}`, ...c, isArchived: false }))
      ];
    }

    // Automatic de-duplication: Keep 1 unique item per type + lowerCase(name)
    const seen = new Set();
    const unique = [];
    for (const cat of rawList) {
      const normName = (cat.name || '').trim().toLowerCase();
      if (!normName) continue;
      const key = `${cat.type || 'EXPENSE'}_${normName}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(cat);
      }
    }

    unique.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return unique;
  },

  /**
   * Add a new category with strict duplicate checking
   */
  async addCategory(userId, { name, type, icon, color }) {
    if (!userId) throw new Error('User belum login');

    const cleanName = (name || '').trim();
    if (!cleanName) throw new Error('Nama kategori wajib diisi.');

    // Prevent duplicate tag/category for the same type
    const existing = await this.getCategories(userId);
    const isDup = existing.some(c => c.type === type && (c.name || '').trim().toLowerCase() === cleanName.toLowerCase());
    if (isDup) {
      throw new Error(`Kategori "${cleanName}" sudah ada.`);
    }

    const payload = {
      name: cleanName,
      type: type || 'EXPENSE',
      icon: icon || 'tag',
      color: color || '#10B981',
      isArchived: false
    };

    if (!isConfigured || !db) {
      const list = await this.getCategories(userId);
      const newCat = {
        id: `cat_${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString()
      };
      list.push(newCat);
      localStorage.setItem(`dompetqu_categories_${userId}`, JSON.stringify(list));
      return newCat;
    }

    const colRef = collection(db, 'users', userId, 'categories');
    const docRef = await addDoc(colRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, ...payload };
  },

  /**
   * Update existing category (Edit nama, warna, dsb)
   */
  async updateCategory(userId, categoryId, data) {
    if (!userId || !categoryId) return;

    const updates = { ...data };
    if (updates.name) updates.name = updates.name.trim();

    if (!isConfigured || !db) {
      const list = await this.getCategories(userId);
      const idx = list.findIndex(c => c.id === categoryId);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
        localStorage.setItem(`dompetqu_categories_${userId}`, JSON.stringify(list));
      }
      return;
    }

    const docRef = doc(db, 'users', userId, 'categories', categoryId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  },

  /**
   * Delete category permanently
   */
  async deleteCategory(userId, categoryId) {
    if (!userId || !categoryId) return;

    if (!isConfigured || !db) {
      const list = await this.getCategories(userId);
      const filtered = list.filter(c => c.id !== categoryId);
      localStorage.setItem(`dompetqu_categories_${userId}`, JSON.stringify(filtered));
      return;
    }

    const docRef = doc(db, 'users', userId, 'categories', categoryId);
    await deleteDoc(docRef);
  },

  async toggleArchiveCategory(userId, categoryId, isArchived) {
    return this.updateCategory(userId, categoryId, { isArchived });
  }
};
