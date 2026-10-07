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
  deleteDoc,
  runTransaction,
  serverTimestamp,
  isConfigured
} from './firebase-config.js';
import { resolvePundiIcon } from './utils.js';

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
   * Create new Kantong (Starts at Rp0; name, icon, optional description)
   */
  async createPundi(userId, { name, description = '', color = '#10B981', icon = 'utensils' }) {
    if (!userId) throw new Error('User belum login');

    const payload = {
      name: name.trim(),
      description: (description || '').trim(),
      balance: 0,
      color: color || '#10B981',
      icon: resolvePundiIcon(icon),
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
    if ('balance' in updates) {
      updates.balance = Math.max(0, parseInt(updates.balance, 10) || 0);
    }
    if ('icon' in updates) {
      updates.icon = resolvePundiIcon(updates.icon);
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
   * Archive or unarchive Pundi
   */
  async setArchived(userId, pundiId, isArchived = true) {
    return this.updatePundi(userId, pundiId, { isArchived });
  },

  /**
   * Delete archived Pundi permanently
   * Note: Transactions remain the source of truth; deleting Pundi never deletes transaction records.
   */
  async deletePundi(userId, pundiId) {
    if (!userId || !pundiId) return;

    if (!isConfigured || !db) {
      const list = await this.getPundis(userId, true);
      const filtered = list.filter(p => p.id !== pundiId);
      localStorage.setItem(`dompetqu_pundis_${userId}`, JSON.stringify(filtered));
      return;
    }

    const docRef = doc(db, 'users', userId, 'pundi', pundiId);
    await deleteDoc(docRef);
  },

  /**
   * Return balance from Pundi back to Saldo Tersedia (Internal Transfer)
   * Decreases Pundi balance; Saldo Tersedia increases; Total Saldo remains constant.
   */
  async returnBalanceToAvailable(userId, pundiId, amount) {
    if (!userId || !pundiId) throw new Error('Parameter tidak valid.');
    const numAmount = Math.max(0, parseInt(amount, 10) || 0);
    if (numAmount <= 0) throw new Error('Nominal harus lebih dari Rp0.');

    if (!isConfigured || !db) {
      const list = await this.getPundis(userId, true);
      const pundi = list.find(p => p.id === pundiId);
      if (!pundi) throw new Error('Kantong tidak ditemukan.');
      const curBal = Number(pundi.balance || 0);
      if (curBal < numAmount) throw new Error('Saldo Kantong tidak mencukupi.');
      pundi.balance = curBal - numAmount;
      pundi.updatedAt = new Date().toISOString();
      localStorage.setItem(`dompetqu_pundis_${userId}`, JSON.stringify(list));
      return pundi;
    }

    const pundiRef = doc(db, 'users', userId, 'pundi', pundiId);
    await runTransaction(db, async (t) => {
      const snap = await t.get(pundiRef);
      if (!snap.exists()) throw new Error('Kantong tidak ditemukan.');
      const curBal = Number(snap.data().balance || 0);
      if (curBal < numAmount) throw new Error('Saldo Kantong tidak mencukupi.');
      t.update(pundiRef, {
        balance: curBal - numAmount,
        updatedAt: serverTimestamp()
      });
    });
  },

  /**
   * Allocate balance from Saldo Tersedia into Pundi (Internal Allocation)
   */
  async allocateFromAvailable(userId, pundiId, amount) {
    if (!userId || !pundiId) throw new Error('Parameter tidak valid.');
    const numAmount = Math.max(0, parseInt(amount, 10) || 0);
    if (numAmount <= 0) throw new Error('Nominal harus lebih dari Rp0.');

    if (!isConfigured || !db) {
      const list = await this.getPundis(userId, true);
      const pundi = list.find(p => p.id === pundiId);
      if (!pundi) throw new Error('Kantong tidak ditemukan.');
      pundi.balance = Number(pundi.balance || 0) + numAmount;
      pundi.updatedAt = new Date().toISOString();
      localStorage.setItem(`dompetqu_pundis_${userId}`, JSON.stringify(list));
      return pundi;
    }

    const pundiRef = doc(db, 'users', userId, 'pundi', pundiId);
    await runTransaction(db, async (t) => {
      const snap = await t.get(pundiRef);
      if (!snap.exists()) throw new Error('Kantong tidak ditemukan.');
      const curBal = Number(snap.data().balance || 0);
      t.update(pundiRef, {
        balance: curBal + numAmount,
        updatedAt: serverTimestamp()
      });
    });
  }
};

