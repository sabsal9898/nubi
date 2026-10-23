import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
} from 'firebase/firestore';

// Your web app's Firebase configuration
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

// Initialize Firestore with persistent offline cache and multi-tab support
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  // If initializeFirestore fails (e.g. already initialized or unsupported environment), fallback to getFirestore
  dbInstance = getFirestore(app);
}

export const db: Firestore = dbInstance;

// Validates whether Firebase is configured
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId === 'supple-glyph-sn50x'
);

export { app, firebaseConfig };

// Validate connection
if (isFirebaseConfigured && typeof window !== 'undefined') {
  getDocFromServer(doc(db, 'test', 'connection')).catch((error) => {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, working with local cache.');
    }
  });
}
