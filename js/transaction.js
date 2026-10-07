/**
 * DompetQu - Transaction Service
 * Handles Income, Expense, Transfer with atomic balance updates & consistency.
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
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
  isConfigured
} from './firebase-config.js';

export const TransactionService = {
  /**
   * Fetch user transactions with optional filtering
   */
  async getTransactions(userId, { startDate, endDate, type, pundiId, categoryId } = {}) {
    if (!userId) return [];

    if (!isConfigured || !db) {
      const stored = localStorage.getItem(`dompetqu_transactions_${userId}`);
      let list = stored ? JSON.parse(stored) : [];

      if (startDate) list = list.filter(t => t.date >= startDate);
      if (endDate) list = list.filter(t => t.date <= endDate);
      if (type) list = list.filter(t => t.type === type);
      if (pundiId) list = list.filter(t => t.pundiId === pundiId || t.destinationPundiId === pundiId);
      if (categoryId) list = list.filter(t => t.categoryId === categoryId);

      // Sort by date descending
      list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
      return list;
    }

    try {
      const colRef = collection(db, 'users', userId, 'transactions');
      let q = query(colRef, orderBy('date', 'desc'));

      // If specific date range
      if (startDate && endDate) {
        q = query(colRef, where('date', '>=', startDate), where('date', '<=', endDate), orderBy('date', 'desc'));
      }

      const snap = await getDocs(q);
      let list = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Filter in-memory for compound conditions without requiring complex composite indexes
      if (type) list = list.filter(t => t.type === type);
      if (pundiId) list = list.filter(t => t.pundiId === pundiId || t.destinationPundiId === pundiId);
      if (categoryId) list = list.filter(t => t.categoryId === categoryId);

      return list;
    } catch (err) {
      console.error('[DompetQu] Error fetching transactions:', err);
      return [];
    }
  },

  /**
   * Create Transaction with atomic balance verification
   */
  async createTransaction(userId, { type, amount, categoryId = null, pundiId, destinationPundiId = null, date, note = '' }) {
    if (!userId) throw new Error('User belum login');

    const numAmount = Math.max(0, parseInt(amount, 10) || 0);
    if (numAmount <= 0) throw new Error('Nominal harus lebih dari Rp0.');

    // Local / Offline fallback logic
    if (!isConfigured || !db) {
      const pundiList = JSON.parse(localStorage.getItem(`dompetqu_pundis_${userId}`) || '[]');
      const sourcePundi = pundiList.find(p => p.id === pundiId);
      if (!sourcePundi) throw new Error('Pundi sumber tidak ditemukan.');

      if (type === 'EXPENSE') {
        if ((sourcePundi.balance || 0) < numAmount) {
          throw new Error('Saldo Pundi tidak mencukupi.');
        }
        sourcePundi.balance = (sourcePundi.balance || 0) - numAmount;
      } else if (type === 'INCOME') {
        sourcePundi.balance = (sourcePundi.balance || 0) + numAmount;
      } else if (type === 'TRANSFER') {
        if (!destinationPundiId || destinationPundiId === pundiId) {
          throw new Error('Pundi tujuan transfer tidak valid.');
        }
        const destPundi = pundiList.find(p => p.id === destinationPundiId);
        if (!destPundi) throw new Error('Pundi tujuan tidak ditemukan.');
        if ((sourcePundi.balance || 0) < numAmount) {
          throw new Error('Saldo Pundi tidak mencukupi untuk transfer.');
        }
        sourcePundi.balance = (sourcePundi.balance || 0) - numAmount;
        destPundi.balance = (destPundi.balance || 0) + numAmount;
      }

      localStorage.setItem(`dompetqu_pundis_${userId}`, JSON.stringify(pundiList));

      const txList = JSON.parse(localStorage.getItem(`dompetqu_transactions_${userId}`) || '[]');
      const newTx = {
        id: `tx_${Date.now()}`,
        type,
        amount: numAmount,
        categoryId: categoryId || null,
        pundiId,
        destinationPundiId: destinationPundiId || null,
        date,
        note: (note || '').trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      txList.unshift(newTx);
      localStorage.setItem(`dompetqu_transactions_${userId}`, JSON.stringify(txList));
      return newTx;
    }

    // Firestore Transaction execution
    const txColRef = collection(db, 'users', userId, 'transactions');
    const newTxDocRef = doc(txColRef);
    const sourcePundiRef = doc(db, 'users', userId, 'pundi', pundiId);
    const destPundiRef = destinationPundiId ? doc(db, 'users', userId, 'pundi', destinationPundiId) : null;

    await runTransaction(db, async (t) => {
      const sourceSnap = await t.get(sourcePundiRef);
      if (!sourceSnap.exists()) {
        throw new Error('Pundi sumber tidak ditemukan.');
      }
      const sourceData = sourceSnap.data();
      const currentSourceBalance = Number(sourceData.balance || 0);

      if (type === 'EXPENSE') {
        if (currentSourceBalance < numAmount) {
          throw new Error('Saldo Pundi tidak mencukupi.');
        }
        t.update(sourcePundiRef, {
          balance: currentSourceBalance - numAmount,
          updatedAt: serverTimestamp()
        });
      } else if (type === 'INCOME') {
        t.update(sourcePundiRef, {
          balance: currentSourceBalance + numAmount,
          updatedAt: serverTimestamp()
        });
      } else if (type === 'TRANSFER') {
        if (!destPundiRef || pundiId === destinationPundiId) {
          throw new Error('Pundi tujuan transfer tidak valid.');
        }
        const destSnap = await t.get(destPundiRef);
        if (!destSnap.exists()) {
          throw new Error('Pundi tujuan tidak ditemukan.');
        }
        const destData = destSnap.data();
        const currentDestBalance = Number(destData.balance || 0);

        if (currentSourceBalance < numAmount) {
          throw new Error('Saldo Pundi tidak mencukupi untuk transfer.');
        }

        t.update(sourcePundiRef, {
          balance: currentSourceBalance - numAmount,
          updatedAt: serverTimestamp()
        });
        t.update(destPundiRef, {
          balance: currentDestBalance + numAmount,
          updatedAt: serverTimestamp()
        });
      }

      t.set(newTxDocRef, {
        type,
        amount: numAmount,
        categoryId: categoryId || null,
        pundiId,
        destinationPundiId: destinationPundiId || null,
        date,
        note: (note || '').trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    return { id: newTxDocRef.id, type, amount: numAmount, pundiId, destinationPundiId, categoryId, date, note };
  },

  /**
   * Delete transaction and safely revert balances
   */
  async deleteTransaction(userId, transactionId) {
    if (!userId || !transactionId) return;

    if (!isConfigured || !db) {
      const txList = JSON.parse(localStorage.getItem(`dompetqu_transactions_${userId}`) || '[]');
      const txIdx = txList.findIndex(t => t.id === transactionId);
      if (txIdx === -1) return;
      const tx = txList[txIdx];

      const pundiList = JSON.parse(localStorage.getItem(`dompetqu_pundis_${userId}`) || '[]');
      const sourcePundi = pundiList.find(p => p.id === tx.pundiId);

      if (tx.type === 'EXPENSE' && sourcePundi) {
        sourcePundi.balance = (sourcePundi.balance || 0) + tx.amount;
      } else if (tx.type === 'INCOME' && sourcePundi) {
        sourcePundi.balance = Math.max(0, (sourcePundi.balance || 0) - tx.amount);
      } else if (tx.type === 'TRANSFER') {
        const destPundi = pundiList.find(p => p.id === tx.destinationPundiId);
        if (sourcePundi) sourcePundi.balance = (sourcePundi.balance || 0) + tx.amount;
        if (destPundi) destPundi.balance = Math.max(0, (destPundi.balance || 0) - tx.amount);
      }

      txList.splice(txIdx, 1);
      localStorage.setItem(`dompetqu_pundis_${userId}`, JSON.stringify(pundiList));
      localStorage.setItem(`dompetqu_transactions_${userId}`, JSON.stringify(txList));
      return;
    }

    const txDocRef = doc(db, 'users', userId, 'transactions', transactionId);

    await runTransaction(db, async (t) => {
      const txSnap = await t.get(txDocRef);
      if (!txSnap.exists()) return;
      const tx = txSnap.data();

      // ALL READS MUST PRECEDE ALL WRITES in Firestore transactions
      let sourceRef = null;
      let sourceSnap = null;
      if (tx.pundiId) {
        sourceRef = doc(db, 'users', userId, 'pundi', tx.pundiId);
        sourceSnap = await t.get(sourceRef);
      }

      let destRef = null;
      let destSnap = null;
      if (tx.type === 'TRANSFER' && tx.destinationPundiId) {
        destRef = doc(db, 'users', userId, 'pundi', tx.destinationPundiId);
        destSnap = await t.get(destRef);
      }

      // EXECUTE ALL WRITES AFTER ALL READS ARE COMPLETE
      if (sourceRef && sourceSnap && sourceSnap.exists()) {
        const curSource = Number(sourceSnap.data().balance || 0);
        if (tx.type === 'EXPENSE') {
          t.update(sourceRef, { balance: curSource + tx.amount, updatedAt: serverTimestamp() });
        } else if (tx.type === 'INCOME') {
          t.update(sourceRef, { balance: Math.max(0, curSource - tx.amount), updatedAt: serverTimestamp() });
        } else if (tx.type === 'TRANSFER') {
          t.update(sourceRef, { balance: curSource + tx.amount, updatedAt: serverTimestamp() });
        }
      }

      if (destRef && destSnap && destSnap.exists()) {
        const curDest = Number(destSnap.data().balance || 0);
        t.update(destRef, { balance: Math.max(0, curDest - tx.amount), updatedAt: serverTimestamp() });
      }

      t.delete(txDocRef);
    });
  },

  /**
   * Edit existing transaction with accurate differential balance adjustments
   */
  async updateTransaction(userId, transactionId, newProps) {
    if (!userId || !transactionId) return;

    // We can delete old and re-create atomically or rollback old impact and apply new impact
    // First fetch old transaction:
    let oldTx = null;
    if (!isConfigured || !db) {
      const txList = JSON.parse(localStorage.getItem(`dompetqu_transactions_${userId}`) || '[]');
      oldTx = txList.find(t => t.id === transactionId);
    } else {
      const snap = await getDoc(doc(db, 'users', userId, 'transactions', transactionId));
      if (snap.exists()) oldTx = { id: snap.id, ...snap.data() };
    }

    if (!oldTx) throw new Error('Transaksi tidak ditemukan.');

    // Rollback old transaction balance first
    await this.deleteTransaction(userId, transactionId);

    // Apply new transaction with new properties
    return this.createTransaction(userId, {
      type: newProps.type || oldTx.type,
      amount: newProps.amount !== undefined ? newProps.amount : oldTx.amount,
      categoryId: newProps.categoryId !== undefined ? newProps.categoryId : oldTx.categoryId,
      pundiId: newProps.pundiId || oldTx.pundiId,
      destinationPundiId: newProps.destinationPundiId !== undefined ? newProps.destinationPundiId : oldTx.destinationPundiId,
      date: newProps.date || oldTx.date,
      note: newProps.note !== undefined ? newProps.note : oldTx.note
    });
  }
};
