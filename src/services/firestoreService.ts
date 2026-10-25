import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  runTransaction,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { RehearsalSession, Song, PartType } from '../types';
import { INITIAL_SESSIONS, KNOWN_MEMBERS } from '../constants/defaultData';
import { sortSessionsDescending } from '../utils/sheetUtils';

const SESSIONS_COLLECTION = 'rehearsal_sessions';
const SETTINGS_COLLECTION = 'settings';
const BAND_MEMBERS_DOC = 'band_members';

export const LOCAL_STORAGE_KEY = 'nubi_band_data';
const LEGACY_LOCAL_STORAGE_KEY = 'noobi_band_sessions_v1';
export const STORAGE_MEMBERS_KEY = 'nubi_band_members';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: true,
    },
    operationType,
    path,
  };
  console.warn('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// ==========================================
// Data Model Normalizers & Sanitizers
// ==========================================

export function toCleanStringArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    return [val.trim()];
  }
  return [];
}

/**
 * Normalizes any song object (supporting both flat part keys and nested parts object)
 */
export function normalizeSong(raw: any, fallbackId?: string): Song {
  if (!raw || typeof raw !== 'object') {
    return {
      id: fallbackId || `song-${Date.now()}`,
      title: '',
      artist: '',
      vocal: [],
      guitar1: [],
      guitar2: [],
      bass: [],
      drum: [],
      keyboard: [],
      notes: '',
    };
  }

  const parts = raw.parts || {};

  const vocal = toCleanStringArray(raw.vocal ?? parts.vocal);
  const guitar1 = toCleanStringArray(raw.guitar1 ?? parts.guitar1 ?? parts.leadGuitar);
  const guitar2 = toCleanStringArray(raw.guitar2 ?? parts.guitar2 ?? parts.rhythmGuitar);
  const bass = toCleanStringArray(raw.bass ?? parts.bass);
  const drum = toCleanStringArray(raw.drum ?? parts.drum);
  const keyboard = toCleanStringArray(raw.keyboard ?? parts.keyboard);
  const notes =
    typeof raw.notes === 'string'
      ? raw.notes
      : typeof raw.note === 'string'
      ? raw.note
      : '';

  const id = String(raw.id || fallbackId || `song-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const title = String(raw.title || '');
  const artist = String(raw.artist || '');

  return {
    id,
    title,
    artist,
    vocal,
    guitar1,
    guitar2,
    bass,
    drum,
    keyboard,
    notes,
    parts: {
      vocal,
      guitar1,
      guitar2,
      leadGuitar: guitar1,
      rhythmGuitar: guitar2,
      bass,
      drum,
      keyboard,
    },
  };
}

/**
 * Normalizes a rehearsal session to ensure all songs and metadata are intact
 */
export function normalizeSession(raw: any, fallbackId?: string): RehearsalSession {
  if (!raw || typeof raw !== 'object') {
    const id = fallbackId || `session-${Date.now()}`;
    return {
      id,
      dateStr: '날짜 미정',
      dateKey: new Date().toISOString().split('T')[0],
      date: '날짜 미정',
      sheetTitle: '누비 밴드 파트 배분',
      songs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  const id = String(raw.id || fallbackId || `session-${Date.now()}`);
  const dateStr = String(raw.dateStr || raw.date || '날짜 미정');
  const dateKey = String(
    raw.dateKey ||
      (dateStr.match(/\d{4}-\d{2}-\d{2}/)
        ? dateStr.match(/\d{4}-\d{2}-\d{2}/)![0]
        : new Date().toISOString().split('T')[0])
  );
  const sheetTitle = String(raw.sheetTitle || '누비 밴드 파트 배분');

  const rawSongs = Array.isArray(raw.songs) ? raw.songs : [];
  const songs = rawSongs.map((s: any, idx: number) => normalizeSong(s, `song-${id}-${idx}`));

  const createdAt = typeof raw.createdAt === 'number' && !isNaN(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = typeof raw.updatedAt === 'number' && !isNaN(raw.updatedAt) ? raw.updatedAt : createdAt;

  return {
    id,
    dateStr,
    dateKey,
    date: dateStr,
    sheetTitle,
    songs,
    extraMembers: raw.extraMembers || {},
    createdAt,
    updatedAt,
  };
}

/**
 * Sanitizes a song object for Firestore storage
 */
export function sanitizeSongForFirestore(s: Song) {
  const vocal = toCleanStringArray(s.vocal);
  const guitar1 = toCleanStringArray(s.guitar1);
  const guitar2 = toCleanStringArray(s.guitar2);
  const bass = toCleanStringArray(s.bass);
  const drum = toCleanStringArray(s.drum);
  const keyboard = toCleanStringArray(s.keyboard);
  const notes = typeof s.notes === 'string' ? s.notes : '';

  return {
    id: s.id,
    title: s.title || '',
    artist: s.artist || '',
    notes,
    vocal,
    guitar1,
    guitar2,
    bass,
    drum,
    keyboard,
    parts: {
      vocal,
      guitar1,
      guitar2,
      leadGuitar: guitar1,
      rhythmGuitar: guitar2,
      bass,
      drum,
      keyboard,
    },
  };
}

/**
 * Prepares a session document for Firestore (no undefined values, dual-compatible parts)
 */
export function sanitizeSessionForFirestore(session: RehearsalSession) {
  const norm = normalizeSession(session);
  return {
    id: norm.id,
    dateStr: norm.dateStr,
    dateKey: norm.dateKey,
    date: norm.dateStr,
    sheetTitle: norm.sheetTitle,
    createdAt: norm.createdAt || Date.now(),
    updatedAt: norm.updatedAt || Date.now(),
    songs: norm.songs.map((s) => sanitizeSongForFirestore(s)),
  };
}

// ==========================================
// Local Storage Cache Helpers (Passive Fallback)
// ==========================================

export function loadLocalSessions(): RehearsalSession[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY) || localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortSessionsDescending(parsed.map((s) => normalizeSession(s)));
      }
    }
  } catch (e) {
    console.warn('Failed to parse sessions from localStorage:', e);
  }

  // Fallback if no local cache exists
  const defaultSessions = INITIAL_SESSIONS.map((s) => normalizeSession(s));
  return sortSessionsDescending(defaultSessions);
}

export function saveAllLocalSessions(sessions: RehearsalSession[]): void {
  try {
    const normalized = sessions.map((s) => normalizeSession(s));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sortSessionsDescending(normalized)));
  } catch (e) {
    console.warn('Failed to save sessions to localStorage:', e);
  }
}

export function loadLocalMembers(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_MEMBERS_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
      }
    }
  } catch (err) {
    console.warn('Failed to load members from localStorage:', err);
  }
  return KNOWN_MEMBERS;
}

export function saveLocalMembers(members: string[]): void {
  try {
    localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(members));
  } catch (err) {
    console.warn('Failed to persist members to localStorage:', err);
  }
}

// ==========================================
// Real-time Subscriptions (Single Source of Truth)
// ==========================================

/**
 * Subscribes to real-time changes in Rehearsal Sessions.
 * Emits updated sessions immediately on change across all devices (PC, Mobile).
 * Firestore snapshot is the absolute Single Source of Truth; local storage never overwrites remote data.
 */
export function subscribeToRehearsalSessions(
  onUpdate: (sessions: RehearsalSession[]) => void,
  onError?: (err: Error) => void
): () => void {
  // 1. Initial immediate paint from local cache for fast loading
  try {
    const initialLocal = loadLocalSessions();
    if (initialLocal.length > 0) {
      onUpdate(initialLocal);
    }
  } catch {
    // ignore
  }

  // 2. Real-time Firestore sync
  if (isFirebaseConfigured && db) {
    try {
      const sessionsCol = collection(db, SESSIONS_COLLECTION);
      const q = query(sessionsCol);

      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          // If Firestore collection is completely empty, initialize it with the default session once
          if (snapshot.empty) {
            try {
              for (const s of INITIAL_SESSIONS) {
                const norm = normalizeSession(s);
                await setDoc(
                  doc(db!, SESSIONS_COLLECTION, norm.id),
                  sanitizeSessionForFirestore(norm)
                );
              }
            } catch (seedErr) {
              handleFirestoreError(seedErr, OperationType.WRITE, SESSIONS_COLLECTION);
            }
            return;
          }

          // Snapshot has documents: Firestore is the absolute truth!
          const remoteSessions: RehearsalSession[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            remoteSessions.push(normalizeSession(data, docSnap.id));
          });

          const sorted = sortSessionsDescending(remoteSessions);
          saveAllLocalSessions(sorted);
          onUpdate(sorted);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, SESSIONS_COLLECTION);
          onError?.(error);
          const fallback = loadLocalSessions();
          onUpdate(fallback);
        }
      );

      return unsubscribe;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, SESSIONS_COLLECTION);
    }
  }

  // Fallback for cross-tab storage changes if Firestore unavailable
  const handleStorageChange = (e: StorageEvent) => {
    if ((e.key === LOCAL_STORAGE_KEY || e.key === LEGACY_LOCAL_STORAGE_KEY) && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed) && parsed.length > 0) {
          onUpdate(sortSessionsDescending(parsed.map((s) => normalizeSession(s))));
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
 * Subscribes to real-time changes in Quick Select Band Members ('settings/band_members').
 */
export function subscribeToBandMembers(
  onUpdate: (members: string[]) => void,
  onError?: (err: Error) => void
): () => void {
  // 1. Initial paint from local cache
  const localMembers = loadLocalMembers();
  onUpdate(localMembers);

  // 2. Real-time Firestore sync
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, BAND_MEMBERS_DOC);

      const unsubscribe = onSnapshot(
        docRef,
        async (snap) => {
          if (!snap.exists()) {
            try {
              await setDoc(docRef, { members: KNOWN_MEMBERS });
            } catch (seedErr) {
              handleFirestoreError(seedErr, OperationType.WRITE, `${SETTINGS_COLLECTION}/${BAND_MEMBERS_DOC}`);
            }
            return;
          }

          const data = snap.data();
          if (data && Array.isArray(data.members)) {
            const memberList = data.members.filter(
              (m: unknown): m is string => typeof m === 'string' && m.trim().length > 0
            );
            saveLocalMembers(memberList);
            onUpdate(memberList);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `${SETTINGS_COLLECTION}/${BAND_MEMBERS_DOC}`);
          onError?.(error);
        }
      );

      return unsubscribe;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `${SETTINGS_COLLECTION}/${BAND_MEMBERS_DOC}`);
    }
  }

  // Cross-tab storage fallback
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_MEMBERS_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) {
          onUpdate(parsed);
        }
      } catch {
        // ignore
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}

// ==========================================
// Atomic Session Operations (Direct Firestore)
// ==========================================

/**
 * Creates or updates an entire session document in Firestore.
 */
export async function saveSession(session: RehearsalSession): Promise<void> {
  const norm = normalizeSession(session);
  norm.updatedAt = Date.now();

  if (isFirebaseConfigured && db) {
    try {
      const sessionRef = doc(db, SESSIONS_COLLECTION, norm.id);
      await setDoc(sessionRef, sanitizeSessionForFirestore(norm), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${SESSIONS_COLLECTION}/${norm.id}`);
    }
  }
}

/**
 * Deletes a rehearsal session document by ID from Firestore.
 */
export async function removeSession(sessionId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
      await deleteDoc(sessionRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${SESSIONS_COLLECTION}/${sessionId}`);
    }
  }
}

/**
 * Atomically adds a song to a session in Firestore using a transaction.
 */
export async function atomicAddSong(sessionId: string, newSong: Song): Promise<void> {
  const cleanSong = normalizeSong(newSong);

  if (isFirebaseConfigured && db) {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    try {
      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) return;
        const data = sessionSnap.data();
        const currentSongs = Array.isArray(data.songs) ? data.songs.map((s: any) => normalizeSong(s)) : [];
        const filtered = currentSongs.filter((song) => song.id !== cleanSong.id);
        const updatedSongs = [cleanSong, ...filtered];
        transaction.update(sessionRef, {
          songs: updatedSongs.map((s) => sanitizeSongForFirestore(s)),
          updatedAt: Date.now(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SESSIONS_COLLECTION}/${sessionId}`);
      // Fallback: direct setDoc if transaction conflicted
      try {
        const localSessions = loadLocalSessions();
        const cur = localSessions.find((s) => s.id === sessionId);
        if (cur) {
          const updated = {
            ...cur,
            songs: [cleanSong, ...cur.songs.filter((s) => s.id !== cleanSong.id)],
            updatedAt: Date.now(),
          };
          await setDoc(sessionRef, sanitizeSessionForFirestore(updated), { merge: true });
        }
      } catch (fallbackErr) {
        console.warn('Fallback setDoc error:', fallbackErr);
      }
    }
  }
}

/**
 * Atomically deletes a song from a session in Firestore using a transaction.
 */
export async function atomicDeleteSong(sessionId: string, songId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    try {
      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) return;
        const data = sessionSnap.data();
        const currentSongs = Array.isArray(data.songs) ? data.songs.map((s: any) => normalizeSong(s)) : [];
        const updatedSongs = currentSongs.filter((s) => s.id !== songId);
        transaction.update(sessionRef, {
          songs: updatedSongs.map((s) => sanitizeSongForFirestore(s)),
          updatedAt: Date.now(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SESSIONS_COLLECTION}/${sessionId}`);
    }
  }
}

/**
 * Atomically updates title, artist, or notes for a specific song in Firestore.
 */
export async function atomicUpdateSongInfo(
  sessionId: string,
  songId: string,
  updates: { title?: string; artist?: string; notes?: string }
): Promise<void> {
  if (isFirebaseConfigured && db) {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    try {
      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) return;
        const data = sessionSnap.data();
        const currentSongs = Array.isArray(data.songs) ? data.songs.map((s: any) => normalizeSong(s)) : [];
        const updatedSongs = currentSongs.map((song) =>
          song.id === songId ? normalizeSong({ ...song, ...updates }) : song
        );
        transaction.update(sessionRef, {
          songs: updatedSongs.map((s) => sanitizeSongForFirestore(s)),
          updatedAt: Date.now(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SESSIONS_COLLECTION}/${sessionId}`);
    }
  }
}

/**
 * Atomically assigns a member to a part in a song in Firestore.
 */
export async function atomicAssignMember(
  sessionId: string,
  songId: string,
  part: PartType,
  memberName: string
): Promise<void> {
  if (part === 'notes') {
    await atomicUpdateSongInfo(sessionId, songId, { notes: memberName });
    return;
  }

  const trimmed = memberName.trim();
  if (!trimmed) return;

  if (isFirebaseConfigured && db) {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    try {
      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) return;
        const data = sessionSnap.data();
        const currentSongs = Array.isArray(data.songs) ? data.songs.map((s: any) => normalizeSong(s)) : [];
        const updatedSongs = currentSongs.map((song) => {
          if (song.id === songId) {
            const list = song[part] || [];
            if (!list.includes(trimmed)) {
              return normalizeSong({ ...song, [part]: [...list, trimmed] });
            }
          }
          return song;
        });
        transaction.update(sessionRef, {
          songs: updatedSongs.map((s) => sanitizeSongForFirestore(s)),
          updatedAt: Date.now(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SESSIONS_COLLECTION}/${sessionId}`);
    }
  }
}

/**
 * Atomically removes a member from a part in a song in Firestore.
 */
export async function atomicRemoveMember(
  sessionId: string,
  songId: string,
  part: PartType,
  memberName: string
): Promise<void> {
  if (part === 'notes') return;

  const trimmed = memberName.trim();

  if (isFirebaseConfigured && db) {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    try {
      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) return;
        const data = sessionSnap.data();
        const currentSongs = Array.isArray(data.songs) ? data.songs.map((s: any) => normalizeSong(s)) : [];
        const updatedSongs = currentSongs.map((song) => {
          if (song.id === songId) {
            return normalizeSong({
              ...song,
              [part]: (song[part] || []).filter((m: string) => m !== trimmed),
            });
          }
          return song;
        });
        transaction.update(sessionRef, {
          songs: updatedSongs.map((s) => sanitizeSongForFirestore(s)),
          updatedAt: Date.now(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SESSIONS_COLLECTION}/${sessionId}`);
    }
  }
}

/**
 * Atomically replaces all members for a part in a song in Firestore.
 */
export async function atomicUpdateSongPartMembers(
  sessionId: string,
  songId: string,
  part: PartType,
  members: string[]
): Promise<void> {
  if (part === 'notes') return;

  const cleanMembers = toCleanStringArray(members);

  if (isFirebaseConfigured && db) {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    try {
      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) return;
        const data = sessionSnap.data();
        const currentSongs = Array.isArray(data.songs) ? data.songs.map((s: any) => normalizeSong(s)) : [];
        const updatedSongs = currentSongs.map((song) => {
          if (song.id === songId) {
            return normalizeSong({ ...song, [part]: cleanMembers });
          }
          return song;
        });
        transaction.update(sessionRef, {
          songs: updatedSongs.map((s) => sanitizeSongForFirestore(s)),
          updatedAt: Date.now(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SESSIONS_COLLECTION}/${sessionId}`);
    }
  }
}

// ==========================================
// Band Members Atomic Operations (arrayUnion / arrayRemove)
// ==========================================

export async function atomicAddBandMember(memberName: string): Promise<void> {
  const trimmed = memberName.trim();
  if (!trimmed) return;

  const current = loadLocalMembers();
  if (!current.includes(trimmed)) {
    saveLocalMembers([...current, trimmed]);
  }

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, BAND_MEMBERS_DOC);
      await setDoc(docRef, { members: arrayUnion(trimmed) }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SETTINGS_COLLECTION}/${BAND_MEMBERS_DOC}`);
    }
  }
}

export async function atomicRemoveBandMember(memberName: string): Promise<void> {
  const trimmed = memberName.trim();
  if (!trimmed) return;

  const current = loadLocalMembers();
  saveLocalMembers(current.filter((m) => m !== trimmed));

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, BAND_MEMBERS_DOC);
      await updateDoc(docRef, { members: arrayRemove(trimmed) });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SETTINGS_COLLECTION}/${BAND_MEMBERS_DOC}`);
    }
  }
}

/**
 * Atomically reorders songs for a rehearsal session in Firestore.
 */
export async function atomicReorderSongs(
  sessionId: string,
  newSongs: Song[]
): Promise<void> {
  if (isFirebaseConfigured && db) {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    try {
      await updateDoc(sessionRef, {
        songs: newSongs.map((s) => sanitizeSongForFirestore(s)),
        updatedAt: Date.now(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SESSIONS_COLLECTION}/${sessionId}`);
    }
  }
}
