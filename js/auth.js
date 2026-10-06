/**
 * DompetQu - Authentication Module
 * Firebase Auth integration with profile creation, onboarding, & route guarding.
 */

import {
  auth,
  db,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  isConfigured
} from './firebase-config.js';

import { CategoryService } from './category.js';
import { PundiService } from './pundi.js';
import { formatFriendlyError } from './notifications.js';

const DEMO_USER_KEY = 'dompetqu_demo_user';

export const AuthService = {
  /**
   * Listen to auth state change
   */
  onAuthState(callback) {
    if (!isConfigured || !auth) {
      // Offline / Demo fallback user
      const stored = localStorage.getItem(DEMO_USER_KEY);
      if (stored) {
        callback(JSON.parse(stored));
      } else {
        // If not logged in demo mode
        callback(null);
      }
      return () => {};
    }

    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Attach profile details if available
        let profile = { displayName: user.displayName || 'Pengguna', email: user.email };
        try {
          const profileDoc = await getDoc(doc(db, 'users', user.uid, 'profile', 'info'));
          if (profileDoc.exists()) {
            profile = { ...profile, ...profileDoc.data() };
          }
        } catch (e) {
          console.warn('[DompetQu] Could not fetch profile subdoc:', e);
        }
        callback({ uid: user.uid, email: user.email, ...profile });
      } else {
        callback(null);
      }
    });
  },

  /**
   * Register new account
   */
  async register(email, password, displayName) {
    if (!email || !password) throw new Error('Email dan kata sandi wajib diisi.');
    if (password.length < 6) throw new Error('Kata sandi minimal 6 karakter.');

    if (!isConfigured || !auth) {
      const demoUser = {
        uid: 'demo_user_1',
        email,
        displayName: displayName || email.split('@')[0],
        isDemo: true
      };
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
      await CategoryService.initDefaultCategories(demoUser.uid);
      // Create initial first Pundi for onboarding
      await PundiService.createPundi(demoUser.uid, {
        name: 'Pundi Utama',
        monthlyBudget: 2000000,
        initialBalance: 0,
        color: '#10B981',
        icon: 'wallet'
      });
      return demoUser;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;

      if (displayName) {
        await updateProfile(user, { displayName });
      }

      // Initialize user profile in Firestore
      const profileRef = doc(db, 'users', user.uid, 'profile', 'info');
      await setDoc(profileRef, {
        displayName: displayName || email.split('@')[0],
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Seed default categories
      await CategoryService.initDefaultCategories(user.uid);

      // Create initial onboarding Pundi
      await PundiService.createPundi(user.uid, {
        name: 'Pundi Utama',
        monthlyBudget: 2000000,
        initialBalance: 0,
        color: '#10B981',
        icon: 'wallet'
      });

      return user;
    } catch (err) {
      throw new Error(formatFriendlyError(err));
    }
  },

  /**
   * Login with email and password
   */
  async login(email, password) {
    if (!email || !password) throw new Error('Email dan kata sandi wajib diisi.');

    if (!isConfigured || !auth) {
      const demoUser = {
        uid: 'demo_user_1',
        email,
        displayName: email.split('@')[0],
        isDemo: true
      };
      localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
      // Ensure defaults exist
      await CategoryService.initDefaultCategories(demoUser.uid);
      const pundis = await PundiService.getPundis(demoUser.uid);
      if (pundis.length === 0) {
        await PundiService.createPundi(demoUser.uid, {
          name: 'Pundi Utama',
          monthlyBudget: 2000000,
          initialBalance: 0,
          color: '#10B981',
          icon: 'wallet'
        });
      }
      return demoUser;
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred.user;
    } catch (err) {
      throw new Error(formatFriendlyError(err));
    }
  },

  /**
   * Logout user
   */
  async logout() {
    localStorage.removeItem(DEMO_USER_KEY);
    if (auth) {
      await signOut(auth);
    }
  },

  /**
   * Forgot password reset email
   */
  async resetPassword(email) {
    if (!email) throw new Error('Email wajib diisi.');

    if (!isConfigured || !auth) {
      return true; // Mock success in offline demo
    }

    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err) {
      throw new Error(formatFriendlyError(err));
    }
  },

  /**
   * Route guard utility
   */
  requireAuth(onAuthenticated, redirectUrl = 'login.html') {
    return this.onAuthState((user) => {
      if (!user) {
        window.location.replace(redirectUrl);
      } else {
        if (typeof onAuthenticated === 'function') {
          onAuthenticated(user);
        }
      }
    });
  },

  redirectIfAuth(redirectUrl = 'index.html') {
    return this.onAuthState((user) => {
      if (user) {
        window.location.replace(redirectUrl);
      }
    });
  }
};
