import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  getDocs,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { RehearsalSession } from '../types';
import { INITIAL_SESSIONS } from '../constants/defaultData';
import { sortSessionsDescending } from '../utils/sheetUtils';

const COLLECTION_NAME = 'rehearsal_sessions';
const LOCAL_STORAGE_KEY = 'noobi_band_sessions_v1';

/**
 * Subscribes to real-time changes in Rehearsal Sessions.
 * Falls back to localStorage if Firebase is not yet configured.
 */
export function subscribeToRehearsalSessions(
  onUpdate: (sessions: RehearsalSession[]) => void,
  onError?: (err: Error) => void
): () => void {
  // 1. If Firebase Firestore is configured, use real-time onSnapshot
  if (isFirebaseConfigured && db) {
    const sessionsCol = collection(db, COLLECTION_NAME);
    const q = query(sessionsCol);

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        // If Firestore is completely empty on first connection, seed initial sessions
        if (snapshot.empty) {
          try {
            for (const s of INITIAL_SESSIONS) {
              await setDoc(doc(db!, COLLECTION_NAME, s.id), s);
            }
          } catch (seedErr) {
            console.error('Failed to seed initial sessions to Firestore:', seedErr);
          }
          return;
        }

        const sessions: RehearsalSession[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as RehearsalSession;
          sessions.push({ ...data, id: docSnap.id });
        });

        const sorted = sortSessionsDescending(sessions);
        // Cache to localStorage for offline access
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sorted));
        } catch {
          // ignore
        }

        onUpdate(sorted);
      },
      (error) => {
        console.error('Firestore onSnapshot error:', error);
        onError?.(error);
        // Fallback to localStorage on error
        const local = loadLocalSessions();
        onUpdate(local);
      }
    );

    return unsubscribe;
  }

  // 2. Fallback to localStorage for local development / before Firebase keys are set
  const initialData = loadLocalSessions();
  onUpdate(initialData);

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) {
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
 * Saves or updates a rehearsal session in Firestore (and localStorage cache).
 */
export async function saveSession(session: RehearsalSession): Promise<void> {
  // Always update local cache
  updateLocalSession(session);

  if (isFirebaseConfigured && db) {
    try {
      const sessionRef = doc(db, COLLECTION_NAME, session.id);
      await setDoc(sessionRef, session, { merge: true });
    } catch (error) {
      console.error('Failed to save session to Firestore:', error);
      throw error;
    }
  }
}

/**
 * Deletes a rehearsal session from Firestore (and localStorage cache).
 */
export async function removeSession(sessionId: string): Promise<void> {
  deleteLocalSession(sessionId);

  if (isFirebaseConfigured && db) {
    try {
      const sessionRef = doc(db, COLLECTION_NAME, sessionId);
      await deleteDoc(sessionRef);
    } catch (error) {
      console.error('Failed to delete session from Firestore:', error);
      throw error;
    }
  }
}

// Helper: load from localStorage
function loadLocalSessions(): RehearsalSession[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortSessionsDescending(parsed);
      }
    }
  } catch {
    // ignore
  }
  return sortSessionsDescending(INITIAL_SESSIONS);
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
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sortSessionsDescending(updated)));
  } catch {
    // ignore
  }
}

// Helper: delete session in localStorage
function deleteLocalSession(sessionId: string) {
  try {
    const list = loadLocalSessions();
    const filtered = list.filter((s) => s.id !== sessionId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}
