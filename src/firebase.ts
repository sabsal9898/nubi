import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

// Your web app's Firebase configuration (supports env vars with fallback to project config)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAuHtv0bs1Fjnt1-DZlTM-DsQzzaJjmXLk',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'supple-glyph-sn50x.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'supple-glyph-sn50x',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'supple-glyph-sn50x.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '314705573955',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:314705573955:web:0cf428a2eb98ca83d83cf6',
};

// Validates whether Firebase is configured
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.startsWith('AIza') &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId === 'supple-glyph-sn50x'
);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
}

export { app, db, firebaseConfig };
