/**
 * DompetQu - Pundi-Pundi (Envelope Budgeting) Service
 * Manages allocation, balance, monthly budgets, and archiving.
 */

import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  isConfigured
} from './firebase-config.js';

export const PundiService = {
  /**
   * Fetch all Pundis for the user
   */
  async getPundis(userId, includeArchived = true) {
    if (!userId) return [];

    if (!isConfigured || !db) {
      const stored = localStorage.getItem(`dompetqu_pundis_${userId}`);
      if (stored) {
        try {
          const list = JSON.parse(stored);
          return includeArchived ? list : list.filter(p => !p.isArchived);
        } catch (e) {}
      }
      return [];
    }

    try {
      const colRef = collection(db, 'users', userId, 'pundi');
      const snap = await getDocs(colRef);
      const list = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Sort by creation time or name
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return includeArchived ? list : list.filter(p => !p.isArchived);
    } catch (err) {
      console.error('[DompetQu] Error fetching pundis:', err);
      return [];
    }
  },

  /**
   * Get single Pundi by ID
   */
  async getPundi(userId, pundiId) {
    if (!userId || !pundiId) return null;

    if (!isConfigured || !db) {
      const list = await this.getPundis(userId, true);
      return list.find(p => p.id === pundiId) || null;
    }

    try {
      const docRef = doc(db, 'users', userId, 'pundi', pundiId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() };
    } catch (err) {
      console.error('[DompetQu] Error getting pundi:', err);
      return null;
    }
  },

  /**
   * Create new Pundi
   */
  async createPundi(userId, { name, description = '', monthlyBudget = 0, initialBalance = 0, color = '#10B981', icon = 'wallet' }) {
    if (!userId) throw new Error('User belum login');

    const budgetInt = Math.max(0, parseInt(monthlyBudget, 10) || 0);
    const balanceInt = Math.max(0, parseInt(initialBalance, 10) || 0);

    const payload = {
      name: name.trim(),
      description: (description || '').trim(),
      monthlyBudget: budgetInt,
      balance: balanceInt,
      color: color || '#10B981',
      icon: icon || 'wallet',
      warning75: true,
      warning90: true,
      warning100: true,
      isArchived: false
    };

    if (!isConfigured || !db) {
      const list = await this.getPundis(userId, true);
      const newPundi = {
        id: `pundi_${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      list.push(newPundi);
      localStorage.setItem(`dompetqu_pundis_${userId}`, JSON.stringify(list));
      return newPundi;
    }

    const colRef = collection(db, 'users', userId, 'pundi');
    const docRef = await addDoc(colRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return { id: docRef.id, ...payload };
  },

  /**
   * Update existing Pundi details
   */
  async updatePundi(userId, pundiId, data) {
    if (!userId || !pundiId) return;

    const updates = { ...data };
    if ('monthlyBudget' in updates) {
      updates.monthlyBudget = Math.max(0, parseInt(updates.monthlyBudget, 10) || 0);
    }
    if ('balance' in updates) {
      updates.balance = Math.max(0, parseInt(updates.balance, 10) || 0);
    }

    if (!isConfigured || !db) {
      const list = await this.getPundis(userId, true);
      const idx = list.findIndex(p => p.id === pundiId);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
        localStorage.setItem(`dompetqu_pundis_${userId}`, JSON.stringify(list));
      }
      return;
    }

    const docRef = doc(db, 'users', userId, 'pundi', pundiId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  },

  /**
   * Archive or unarchive Pundi (Pundis with history are archived, not deleted)
   */
  async setArchived(userId, pundiId, isArchived = true) {
    return this.updatePundi(userId, pundiId, { isArchived });
  }
};
