/**
 * DompetQu - Financial Goals Service
 * Manages savings targets, target progress, and deadlines.
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
  serverTimestamp,
  isConfigured
} from './firebase-config.js';

export const GoalService = {
  async getGoals(userId) {
    if (!userId) return [];

    if (!isConfigured || !db) {
      const stored = localStorage.getItem(`dompetqu_goals_${userId}`);
      return stored ? JSON.parse(stored) : [];
    }

    try {
      const colRef = collection(db, 'users', userId, 'goals');
      const snap = await getDocs(colRef);
      const list = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
      return list;
    } catch (err) {
      console.error('[DompetQu] Error fetching goals:', err);
      return [];
    }
  },

  async createGoal(userId, { name, targetAmount, currentAmount = 0, deadline = '', note = '' }) {
    if (!userId) throw new Error('User belum login');

    const targetInt = Math.max(0, parseInt(targetAmount, 10) || 0);
    const currentInt = Math.max(0, parseInt(currentAmount, 10) || 0);

    const payload = {
      name: name.trim(),
      targetAmount: targetInt,
      currentAmount: currentInt,
      deadline: deadline || '',
      note: (note || '').trim()
    };

    if (!isConfigured || !db) {
      const list = await this.getGoals(userId);
      const newGoal = {
        id: `goal_${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      list.push(newGoal);
      localStorage.setItem(`dompetqu_goals_${userId}`, JSON.stringify(list));
      return newGoal;
    }

    const colRef = collection(db, 'users', userId, 'goals');
    const docRef = await addDoc(colRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return { id: docRef.id, ...payload };
  },

  async updateGoal(userId, goalId, data) {
    if (!userId || !goalId) return;

    const updates = { ...data };
    if ('targetAmount' in updates) {
      updates.targetAmount = Math.max(0, parseInt(updates.targetAmount, 10) || 0);
    }
    if ('currentAmount' in updates) {
      updates.currentAmount = Math.max(0, parseInt(updates.currentAmount, 10) || 0);
    }

    if (!isConfigured || !db) {
      const list = await this.getGoals(userId);
      const idx = list.findIndex(g => g.id === goalId);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
        localStorage.setItem(`dompetqu_goals_${userId}`, JSON.stringify(list));
      }
      return;
    }

    const docRef = doc(db, 'users', userId, 'goals', goalId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  },

  async deleteGoal(userId, goalId) {
    if (!userId || !goalId) return;

    if (!isConfigured || !db) {
      const list = await this.getGoals(userId);
      const filtered = list.filter(g => g.id !== goalId);
      localStorage.setItem(`dompetqu_goals_${userId}`, JSON.stringify(filtered));
      return;
    }

    const docRef = doc(db, 'users', userId, 'goals', goalId);
    await deleteDoc(docRef);
  }
};
