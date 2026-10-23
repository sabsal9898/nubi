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
const DELETED_SESSIONS_KEY = 'nubi_band_deleted_session_ids';

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

function toCleanStringArray(val: unknown): string[] {
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
    createdAt: norm.createdAt,
    updatedAt: norm.updatedAt || Date.now(),
    songs: norm.songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      vocal: s.vocal,
      guitar1: s.guitar1,
      guitar2: s.guitar2,
      bass: s.bass,
      drum: s.drum,
      keyboard: s.keyboard,
      notes: s.notes,
      parts: {
        vocal: s.vocal,
        guitar1: s.guitar1,
        guitar2: s.guitar2,
        leadGuitar: s.guitar1,
        rhythmGuitar: s.guitar2,
        bass: s.bass,
        drum: s.drum,
        keyboard: s.keyboard,
      },
    })),
  };
}

// ==========================================
// Local Storage Helpers
// ==========================================

export function loadLocalSessions(): RehearsalSession[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY) || localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map((s) => normalizeSession(s));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
        return sortSessionsDescending(normalized);
      }
    }
  } catch (e) {
    console.warn('Failed to parse sessions from localStorage:', e);
  }

  // Fallback only when localStorage is completely empty
  const defaultSessions = INITIAL_SESSIONS.map((s) => normalizeSession(s));
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaultSessions));
  } catch {
    // ignore
  }
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

function getDeletedSessionIds(): Set<string> {
  try {
    const saved = localStorage.getItem(DELETED_SESSIONS_KEY);
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function recordDeletedSessionId(id: string) {
  try {
    const set = getDeletedSessionIds();
    set.add(id);
    localStorage.setItem(DELETED_SESSIONS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function removeDeletedSessionId(id: string) {
  try {
    const set = getDeletedSessionIds();
    set.delete(id);
    localStorage.setItem(DELETED_SESSIONS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function updateSingleLocalSession(session: RehearsalSession): RehearsalSession {
  const norm = normalizeSession(session);
  norm.updatedAt = Date.now();
  try {
    const list = loadLocalSessions();
    const existingIdx = list.findIndex((s) => s.id === norm.id);
    let updated: RehearsalSession[];
    if (existingIdx >= 0) {
      updated = list.map((s) => (s.id === norm.id ? norm : s));
    } else {
      updated = [norm, ...list];
    }
    saveAllLocalSessions(updated);
  } catch (e) {
    console.warn('Failed to update single local session:', e);
  }
  return norm;
}

function mutateLocalSession(
  sessionId: string,
  mutator: (s: RehearsalSession) => RehearsalSession
): RehearsalSession | null {
  try {
    const list = loadLocalSessions();
    const target = list.find((s) => s.id === sessionId);
    if (target) {
      const updatedTarget = normalizeSession({
        ...mutator(target),
        updatedAt: Date.now(),
      });
      const updatedList = list.map((s) => (s.id === sessionId ? updatedTarget : s));
      saveAllLocalSessions(updatedList);
      return updatedTarget;
    }
  } catch (e) {
    console.warn('Failed to mutate local session:', e);
  }
  return null;
}

function deleteLocalSession(sessionId: string) {
  try {
    const list = loadLocalSessions();
    const filtered = list.filter((s) => s.id !== sessionId);
    saveAllLocalSessions(filtered);
  } catch (e) {
    console.warn('Failed to delete local session:', e);
  }
}

// ==========================================
// Real-time Subscriptions (onSnapshot with Protection Guard)
// ==========================================

/**
 * Subscribes to real-time changes in Rehearsal Sessions.
 * Emits updated sessions immediately on change across all devices.
 * Safeguards against overwriting user's local songs with empty/outdated Firestore data.
 */
export function subscribeToRehearsalSessions(
  onUpdate: (sessions: RehearsalSession[]) => void,
  onError?: (err: Error) => void
): () => void {
  // 1. Immediately provide locally cached sessions (fastest first-paint)
  const initialLocal = loadLocalSessions();
  onUpdate(initialLocal);

  // 2. Real-time Firestore sync
  if (isFirebaseConfigured && db) {
    try {
      const sessionsCol = collection(db, SESSIONS_COLLECTION);
      const q = query(sessionsCol);

      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          const deletedIds = getDeletedSessionIds();
          const currentLocal = loadLocalSessions();

          // If Firestore collection is empty, seed it with the current local sessions
          if (snapshot.empty) {
            try {
              for (const s of currentLocal) {
                if (!deletedIds.has(s.id)) {
                  await setDoc(
                    doc(db!, SESSIONS_COLLECTION, s.id),
                    sanitizeSessionForFirestore(s),
                    { merge: true }
                  );
                }
              }
            } catch (seedErr) {
              handleFirestoreError(seedErr, OperationType.WRITE, SESSIONS_COLLECTION);
            }
            return;
          }

          const remoteSessions: RehearsalSession[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const sessionId = docSnap.id;
            if (!deletedIds.has(sessionId)) {
              remoteSessions.push(normalizeSession(data, sessionId));
            }
          });

          // Smart Merge with Safety Guard:
          // Local sessions that have songs must NEVER be overwritten by empty or older remote sessions!
          const sessionMap = new Map<string, RehearsalSession>();
          const sessionsToPushToRemote: RehearsalSession[] = [];

          const remoteMap = new Map<string, RehearsalSession>();
          for (const r of remoteSessions) {
            remoteMap.set(r.id, r);
          }

          // 1. Evaluate all current local sessions
          for (const local of currentLocal) {
            if (deletedIds.has(local.id)) continue;

            const remote = remoteMap.get(local.id);
            if (!remote) {
              // Local session not yet in remote -> keep local & schedule sync to remote
              sessionMap.set(local.id, local);
              sessionsToPushToRemote.push(local);
            } else {
              const localSongCount = local.songs?.length || 0;
              const remoteSongCount = remote.songs?.length || 0;
              const localUpdatedAt = local.updatedAt || local.createdAt || 0;
              const remoteUpdatedAt = remote.updatedAt || remote.createdAt || 0;

              // Rule A: Local has songs, remote is empty -> Preserve local and repair remote
              if (localSongCount > 0 && remoteSongCount === 0) {
                sessionMap.set(local.id, local);
                sessionsToPushToRemote.push(local);
              }
              // Rule B: Local has newer timestamp -> Preserve local and update remote
              else if (localUpdatedAt > remoteUpdatedAt) {
                sessionMap.set(local.id, local);
                sessionsToPushToRemote.push(local);
              }
              // Rule C: Remote is newer or equal -> Accept remote
              else {
                sessionMap.set(remote.id, remote);
              }
            }
          }

          // 2. Add any remote sessions that were not in local yet (created by other members)
          for (const remote of remoteSessions) {
            if (!sessionMap.has(remote.id)) {
              sessionMap.set(remote.id, remote);
            }
          }

          const merged = sortSessionsDescending(Array.from(sessionMap.values()));
          if (merged.length > 0) {
            saveAllLocalSessions(merged);
            onUpdate(merged);
          }

          // Background auto-repair: push any uncommitted local sessions/songs to remote
          if (sessionsToPushToRemote.length > 0) {
            for (const s of sessionsToPushToRemote) {
              setDoc(
                doc(db!, SESSIONS_COLLECTION, s.id),
                sanitizeSessionForFirestore(s),
                { merge: true }
              ).catch((e) => {
                console.warn('Auto-repair sync skipped:', e);
              });
            }
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, SESSIONS_COLLECTION);
          onError?.(error);
          const local = loadLocalSessions();
          onUpdate(local);
        }
      );

      return unsubscribe;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, SESSIONS_COLLECTION);
    }
  }

  // Cross-tab storage fallback
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
  // 1. Immediately provide local cache
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
              const current = loadLocalMembers();
              await setDoc(docRef, { members: current });
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

  // Fallback: listen for cross-tab storage changes
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
// Atomic Session Operations & Write-Through
// ==========================================

/**
 * Creates or updates an entire session document (Write-Through: LocalStorage + Firestore setDoc)
 */
export async function saveSession(session: RehearsalSession): Promise<void> {
  const norm = normalizeSession(session);
  norm.updatedAt = Date.now();
  removeDeletedSessionId(norm.id);
  updateSingleLocalSession(norm);

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
 * Deletes a rehearsal session document by ID.
 */
export async function removeSession(sessionId: string): Promise<void> {
  recordDeletedSessionId(sessionId);
  deleteLocalSession(sessionId);

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
 * Atomically adds a song to a session.
 * Write-Through: updates localStorage immediately, writes via setDoc, and attempts atomic transaction.
 */
export async function atomicAddSong(sessionId: string, newSong: Song): Promise<void> {
  const cleanSong = normalizeSong(newSong);
  const updatedSession = mutateLocalSession(sessionId, (s) => ({
    ...s,
    songs: [cleanSong, ...s.songs.filter((song) => song.id !== cleanSong.id)],
  }));

  if (isFirebaseConfigured && db && updatedSession) {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    // Write-Through setDoc guarantees offline persistence & immediate sync
    try {
      await setDoc(sessionRef, sanitizeSessionForFirestore(updatedSession), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SESSIONS_COLLECTION}/${sessionId}`);
    }

    // Secondary atomic transaction check for active multi-user concurrency
    try {
      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) return;
        const data = sessionSnap.data();
        const currentSongs = Array.isArray(data.songs) ? data.songs.map((s: any) => normalizeSong(s)) : [];
        const filtered = currentSongs.filter((song) => song.id !== cleanSong.id);
        const updatedSongs = [cleanSong, ...filtered];
        transaction.update(sessionRef, {
          songs: updatedSongs.map((s) => normalizeSong(s)),
          updatedAt: Date.now(),
        });
      });
    } catch {
      // Transaction optional if setDoc succeeded
    }
  }
}

/**
 * Atomically deletes a song from a session.
 */
export async function atomicDeleteSong(sessionId: string, songId: string): Promise<void> {
  const updatedSession = mutateLocalSession(sessionId, (s) => ({
    ...s,
    songs: s.songs.filter((song) => song.id !== songId),
  }));

  if (isFirebaseConfigured && db && updatedSession) {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    try {
      await setDoc(sessionRef, sanitizeSessionForFirestore(updatedSession), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SESSIONS_COLLECTION}/${sessionId}`);
    }

    try {
      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) return;
        const data = sessionSnap.data();
        const currentSongs = Array.isArray(data.songs) ? data.songs.map((s: any) => normalizeSong(s)) : [];
        const updatedSongs = currentSongs.filter((s) => s.id !== songId);
        transaction.update(sessionRef, {
          songs: updatedSongs.map((s) => normalizeSong(s)),
          updatedAt: Date.now(),
        });
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Atomically updates title, artist, or notes for a specific song.
 */
export async function atomicUpdateSongInfo(
  sessionId: string,
  songId: string,
  updates: { title?: string; artist?: string; notes?: string }
): Promise<void> {
  const updatedSession = mutateLocalSession(sessionId, (s) => ({
    ...s,
    songs: s.songs.map((song) =>
      song.id === songId ? normalizeSong({ ...song, ...updates }) : song
    ),
  }));

  if (isFirebaseConfigured && db && updatedSession) {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    try {
      await setDoc(sessionRef, sanitizeSessionForFirestore(updatedSession), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SESSIONS_COLLECTION}/${sessionId}`);
    }

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
          songs: updatedSongs.map((s) => normalizeSong(s)),
          updatedAt: Date.now(),
        });
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Atomically assigns a member to a part in a song.
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

  const updatedSession = mutateLocalSession(sessionId, (s) => ({
    ...s,
    songs: s.songs.map((song) => {
      if (song.id === songId) {
        const currentList = song[part] || [];
        if (!currentList.includes(trimmed)) {
          return normalizeSong({ ...song, [part]: [...currentList, trimmed] });
        }
      }
      return song;
    }),
  }));

  if (isFirebaseConfigured && db && updatedSession) {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    try {
      await setDoc(sessionRef, sanitizeSessionForFirestore(updatedSession), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SESSIONS_COLLECTION}/${sessionId}`);
    }

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
          songs: updatedSongs.map((s) => normalizeSong(s)),
          updatedAt: Date.now(),
        });
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Atomically removes a member from a part in a song.
 */
export async function atomicRemoveMember(
  sessionId: string,
  songId: string,
  part: PartType,
  memberName: string
): Promise<void> {
  if (part === 'notes') return;

  const trimmed = memberName.trim();
  const updatedSession = mutateLocalSession(sessionId, (s) => ({
    ...s,
    songs: s.songs.map((song) => {
      if (song.id === songId) {
        return normalizeSong({
          ...song,
          [part]: (song[part] || []).filter((m) => m !== trimmed),
        });
      }
      return song;
    }),
  }));

  if (isFirebaseConfigured && db && updatedSession) {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    try {
      await setDoc(sessionRef, sanitizeSessionForFirestore(updatedSession), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SESSIONS_COLLECTION}/${sessionId}`);
    }

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
              [part]: (song[part] || []).filter((m) => m !== trimmed),
            });
          }
          return song;
        });
        transaction.update(sessionRef, {
          songs: updatedSongs.map((s) => normalizeSong(s)),
          updatedAt: Date.now(),
        });
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Atomically replaces all members for a part in a song.
 */
export async function atomicUpdateSongPartMembers(
  sessionId: string,
  songId: string,
  part: PartType,
  members: string[]
): Promise<void> {
  if (part === 'notes') return;

  const cleanMembers = toCleanStringArray(members);
  const updatedSession = mutateLocalSession(sessionId, (s) => ({
    ...s,
    songs: s.songs.map((song) => {
      if (song.id === songId) {
        return normalizeSong({ ...song, [part]: cleanMembers });
      }
      return song;
    }),
  }));

  if (isFirebaseConfigured && db && updatedSession) {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    try {
      await setDoc(sessionRef, sanitizeSessionForFirestore(updatedSession), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SESSIONS_COLLECTION}/${sessionId}`);
    }

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
          songs: updatedSongs.map((s) => normalizeSong(s)),
          updatedAt: Date.now(),
        });
      });
    } catch {
      // ignore
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
