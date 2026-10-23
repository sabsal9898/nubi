import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

// Explicit Firebase client configuration for supple-glyph-sn50x
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAuHtv0bs1Fjnt1-DZlTM-DsQzzaJjmXLk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "supple-glyph-sn50x.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "supple-glyph-sn50x",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "supple-glyph-sn50x.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "314705573955",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:314705573955:web:0cf428a2eb98ca83d83cf6",
};

// Initialize Firebase App
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Explicit Named Database ID for this application
export const FIRESTORE_DATABASE_ID = 'ai-studio-nubiband-af82b33c-6acd-4568-ac73-9f9ff6b594be';

// Initialize Firestore directly with the Named Database ID
export const db: Firestore = getFirestore(app, FIRESTORE_DATABASE_ID);

// Validates whether Firebase is configured
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

export { app, firebaseConfig };

