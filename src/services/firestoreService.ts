import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { RehearsalSession } from '../types';
import { INITIAL_SESSIONS } from '../constants/defaultData';
import { sortSessionsDescending } from '../utils/sheetUtils';

const COLLECTION_NAME = 'rehearsal_sessions';
export const LOCAL_STORAGE_KEY = 'nubi_band_data';
const LEGACY_LOCAL_STORAGE_KEY = 'noobi_band_sessions_v1';

/**
 * Loads sessions from localStorage with fallback to legacy key and INITIAL_SESSIONS
 */
export function loadLocalSessions(): RehearsalSession[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY) || localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure data is also written under canonical key
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
        return sortSessionsDescending(parsed);
      }
    }
  } catch (e) {
    console.warn('Failed to parse sessions from localStorage:', e);
  }
  return sortSessionsDescending(INITIAL_SESSIONS);
}

/**
 * Persists all sessions to localStorage
 */
export function saveAllLocalSessions(sessions: RehearsalSession[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sortSessionsDescending(sessions)));
  } catch (e) {
    console.warn('Failed to save sessions to localStorage:', e);
  }
}

/**
 * Subscribes to real-time changes in Rehearsal Sessions.
 * Primary source of truth is local storage; Firestore acts as an optional cloud sync.
 */
export function subscribeToRehearsalSessions(
  onUpdate: (sessions: RehearsalSession[]) => void,
  onError?: (err: Error) => void
): () => void {
  // 1. Immediately provide locally saved data
  const initialLocal = loadLocalSessions();
  onUpdate(initialLocal);

  // 2. If Firebase Firestore is configured, listen in background without blocking local edits
  if (isFirebaseConfigured && db) {
    try {
      const sessionsCol = collection(db, COLLECTION_NAME);
      const q = query(sessionsCol);

      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          // If Firestore is empty, seed it with the current local sessions
          if (snapshot.empty) {
            try {
              const currentLocal = loadLocalSessions();
              for (const s of currentLocal) {
                await setDoc(doc(db!, COLLECTION_NAME, s.id), s);
              }
            } catch (seedErr) {
              console.warn('Firebase seeding skipped (local storage active):', seedErr);
            }
            return;
          }

          const remoteSessions: RehearsalSession[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as RehearsalSession;
            remoteSessions.push({ ...data, id: docSnap.id });
          });

          if (remoteSessions.length > 0) {
            const sorted = sortSessionsDescending(remoteSessions);
            saveAllLocalSessions(sorted);
            onUpdate(sorted);
          }
        },
        (error) => {
          console.warn('Firestore onSnapshot error (isolated, using local storage):', error);
          onError?.(error);
          // Keep local storage safe
          const local = loadLocalSessions();
          onUpdate(local);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('Firebase subscription initialization failed (using local storage):', err);
    }
  }

  // 3. Fallback: Listen for cross-tab storage events
  const handleStorageChange = (e: StorageEvent) => {
    if ((e.key === LOCAL_STORAGE_KEY || e.key === LEGACY_LOCAL_STORAGE_KEY) && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          onUpdate(sortSessionsDescending(parsed));
        }
      } catch {
        // ignore
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}

/**
 * Saves or updates a rehearsal session in localStorage and attempts Firebase sync.
 * Never throws an error so local state operations remain completely uninterrupted.
 */
export async function saveSession(session: RehearsalSession): Promise<void> {
  // Always update local cache immediately
  updateLocalSession(session);

  if (isFirebaseConfigured && db) {
    try {
      const sessionRef = doc(db, COLLECTION_NAME, session.id);
      await setDoc(sessionRef, session, { merge: true });
    } catch (error) {
      console.warn('Firebase saveSession skipped (saved in localStorage):', error);
    }
  }
}

/**
 * Deletes a rehearsal session from localStorage and attempts Firebase sync.
 * Never throws an error so local state operations remain completely uninterrupted.
 */
export async function removeSession(sessionId: string): Promise<void> {
  deleteLocalSession(sessionId);

  if (isFirebaseConfigured && db) {
    try {
      const sessionRef = doc(db, COLLECTION_NAME, sessionId);
      await deleteDoc(sessionRef);
    } catch (error) {
      console.warn('Firebase removeSession skipped (removed from localStorage):', error);
    }
  }
}

// Helper: update single session in localStorage
function updateLocalSession(session: RehearsalSession) {
  try {
    const list = loadLocalSessions();
    const existingIdx = list.findIndex((s) => s.id === session.id);
    let updated: RehearsalSession[];
    if (existingIdx >= 0) {
      updated = list.map((s) => (s.id === session.id ? session : s));
    } else {
      updated = [session, ...list];
    }
    saveAllLocalSessions(updated);
  } catch (e) {
    console.warn('Failed to update local session:', e);
  }
}

// Helper: delete session in localStorage
function deleteLocalSession(sessionId: string) {
  try {
    const list = loadLocalSessions();
    const filtered = list.filter((s) => s.id !== sessionId);
    saveAllLocalSessions(filtered);
  } catch (e) {
    console.warn('Failed to delete local session:', e);
  }
}
