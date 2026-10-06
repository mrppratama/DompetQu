/**
 * DompetQu - Firebase Configuration & Initialization
 * Uses Firebase Web SDK (ES Module version).
 * Replace placeholder credentials with your Firebase Project config.
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
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
  limit,
  runTransaction,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Default / fallback Firebase config template.
// Values can also be loaded from localStorage for custom testing without rebuilding.
const customStoredConfig = (() => {
  try {
    const raw = localStorage.getItem('dompetqu_firebase_config');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
})();

export const firebaseConfig = customStoredConfig || {
  apiKey: "AIzaSyCiy6nwb4ASZOB1Wq4vLSW90oOQMdkUEog",
  authDomain: "dompetqu-28a6b.firebaseapp.com",
  projectId: "dompetqu-28a6b",
  storageBucket: "dompetqu-28a6b.firebasestorage.app",
  messagingSenderId: "723032764667",
  appId: "1:723032764667:web:d6f13ac56eecdb38b006e"
};

// Check if credentials are placeholders
export const isConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'dompetqu-app'
);

let app = null;
let auth = null;
let db = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.warn('[DompetQu] Firebase initialization notice:', err.message);
}

export {
  app,
  auth,
  db,
  // Auth methods
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  // Firestore methods
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
  limit,
  runTransaction,
  writeBatch,
  serverTimestamp,
  Timestamp
};
