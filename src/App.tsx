import React, { useState, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import confetti from 'canvas-confetti';
import { AlertCircle } from 'lucide-react';
import { RehearsalSession, Song, PartType } from './types';
import { INITIAL_SESSIONS } from './constants/defaultData';
import { Toolbar } from './components/Toolbar';
import { SheetTable } from './components/SheetTable';
import { PartAssignmentModal } from './components/PartAssignmentModal';
import { AddSongModal } from './components/AddSongModal';
import { AddDateModal } from './components/AddDateModal';
import { sortSessionsDescending, formatSessionDateWithDay } from './utils/sheetUtils';
import {
  subscribeToRehearsalSessions,
  saveSession,
  removeSession,
  atomicAddSong,
  atomicDeleteSong,
  atomicUpdateSongInfo,
  atomicAssignMember,
  atomicRemoveMember,
  atomicUpdateSongPartMembers,
  loadLocalSessions,
  LOCAL_STORAGE_KEY,
} from './services/firestoreService';

const ACTIVE_SESSION_KEY = 'nubi_band_active_session_id';
const LEGACY_ACTIVE_SESSION_KEY = 'noobi_band_active_session_id';

export default function App() {
  // 1. Initial Load: prioritize localStorage ('nubi_band_data'), fallback to mock data
  const [sessions, setSessions] = useState<RehearsalSession[]>(() => loadLocalSessions());

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const saved =
        localStorage.getItem(ACTIVE_SESSION_KEY) ||
        localStorage.getItem(LEGACY_ACTIVE_SESSION_KEY);
      const initialList = loadLocalSessions();
      if (saved && initialList.some((s) => s.id === saved)) {
        return saved;
      }
      if (initialList.length > 0) {
        return initialList[0].id;
      }
    } catch {
      // ignore
    }
    return INITIAL_SESSIONS[0]?.id || 'session-2026-07-30';
  });

  // Modal states
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignModalSongId, setAssignModalSongId] = useState<string | undefined>(undefined);
  const [assignModalPart, setAssignModalPart] = useState<PartType | undefined>(undefined);

  const [isAddSongModalOpen, setIsAddSongModalOpen] = useState(false);
  const [isAddDateModalOpen, setIsAddDateModalOpen] = useState(false);
  const [isDeleteSessionModalOpen, setIsDeleteSessionModalOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 2. Automatic synchronization to localStorage on state changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
    } catch (err) {
      console.warn('Failed to persist sessions to localStorage:', err);
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
    } catch {
      // ignore
    }
  }, [activeSessionId]);

  // Subscribe to real-time updates / multi-tab storage events
  useEffect(() => {
    const unsubscribe = subscribeToRehearsalSessions((updatedSessions) => {
      if (updatedSessions && updatedSessions.length > 0) {
        setSessions(updatedSessions);
        setActiveSessionId((prev) => {
          if (!updatedSessions.some((s) => s.id === prev)) {
            return updatedSessions[0].id;
          }
          return prev;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || INITIAL_SESSIONS[0];

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Helper to persist sessions synchronously and return updated session
  const persistSessionsLocally = (nextSessions: RehearsalSession[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextSessions));
    } catch (e) {
      console.warn('Direct localStorage save failed:', e);
    }
  };

  // Handler: Request session delete with 1-session guard
  const handleRequestDeleteSession = () => {
    if (sessions.length <= 1) {
      showToast('최소 하나 이상의 합주 일정은 남아 있어야 합니다.');
      return;
    }
    setIsDeleteSessionModalOpen(true);
  };

  // Handler: Confirm delete current session
  const handleConfirmDeleteSession = async () => {
    if (sessions.length <= 1) {
      showToast('최소 하나 이상의 합주 일정은 남아 있어야 합니다.');
      setIsDeleteSessionModalOpen(false);
      return;
    }

    const deletedDateStr = formatSessionDateWithDay(activeSession.dateStr, activeSession.dateKey) || activeSession.dateStr;
    const sessionToDeleteId = activeSessionId;
    const remaining = sessions.filter((s) => s.id !== sessionToDeleteId);
    const sortedRemaining = sortSessionsDescending(remaining);

    // Update React state & localStorage immediately
    setSessions(sortedRemaining);
    persistSessionsLocally(sortedRemaining);

    if (sortedRemaining.length > 0) {
      setActiveSessionId(sortedRemaining[0].id);
    }
    setIsDeleteSessionModalOpen(false);
    showToast(`🗑️ '${deletedDateStr}' 합주일이 삭제되었습니다.`);

    // Isolated cloud sync
    try {
      await removeSession(sessionToDeleteId);
    } catch (e) {
      console.warn('Cloud sync skipped:', e);
    }
  };

  // Handler: Add new Rehearsal Date (with automatic carry-over & descending sort)
  const handleAddDate = async (
    dateStr: string,
    dateKey: string,
    copyFromPrevious: boolean
  ) => {
    const newSessionId = `session-${Date.now()}`;
    let songsToCarry: Song[] = [];

    if (copyFromPrevious && activeSession) {
      songsToCarry = activeSession.songs.map((s, index) => ({
        ...s,
        id: `song-${Date.now()}-${index}`,
        vocal: [...s.vocal],
        guitar1: [...s.guitar1],
        guitar2: [...s.guitar2],
        bass: [...s.bass],
        drum: [...s.drum],
        keyboard: [...s.keyboard],
        notes: s.notes,
      }));
    }

    const formattedDateStr = formatSessionDateWithDay(dateStr, dateKey) || dateStr;

    const newSession: RehearsalSession = {
      id: newSessionId,
      dateStr: formattedDateStr,
      dateKey,
      sheetTitle: activeSession?.sheetTitle || '누비 밴드 파트 배분',
      songs: songsToCarry,
      createdAt: Date.now(),
    };

    setSessions((prev) => {
      const next = sortSessionsDescending([newSession, ...prev]);
      persistSessionsLocally(next);
      return next;
    });

    setActiveSessionId(newSessionId);
    showToast(`📅 '${formattedDateStr}' 합주가 추가되었습니다! (${songsToCarry.length}개 곡 이월)`);

    // Isolated cloud sync
    try {
      await saveSession(newSession);
    } catch (e) {
      console.warn('Cloud sync skipped:', e);
    }
  };

  // Handler: Add new Song to current session (prepended to top)
  const handleAddSong = async (title: string, artist: string, notes: string) => {
    const newSong: Song = {
      id: `song-${Date.now()}`,
      title,
      artist,
      vocal: [],
      guitar1: [],
      guitar2: [],
      bass: [],
      drum: [],
      keyboard: [],
      notes,
    };

    const now = Date.now();
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: now,
            songs: [newSong, ...s.songs],
          };
        }
        return s;
      });
      persistSessionsLocally(next);
      return next;
    });

    showToast(`🎵 새 곡 '${title}'이(가) 추가되었습니다!`);

    // Atomic transaction for Firestore
    try {
      await atomicAddSong(activeSessionId, newSong);
    } catch (e) {
      console.warn('Cloud atomicAddSong skipped:', e);
    }
  };

  // Handler: Delete song from current session only
  const handleDeleteSong = async (songId: string) => {
    const now = Date.now();
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: now,
            songs: s.songs.filter((song) => song.id !== songId),
          };
        }
        return s;
      });
      persistSessionsLocally(next);
      return next;
    });

    showToast('곡이 현재 합주 목록에서 삭제되었습니다.');

    // Atomic transaction for Firestore
    try {
      await atomicDeleteSong(activeSessionId, songId);
    } catch (e) {
      console.warn('Cloud atomicDeleteSong skipped:', e);
    }
  };

  // Handler: Update song title/artist
  const handleUpdateSongTitle = async (
    songId: string,
    title: string,
    artist: string
  ) => {
    const now = Date.now();
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: now,
            songs: s.songs.map((song) =>
              song.id === songId ? { ...song, title, artist } : song
            ),
          };
        }
        return s;
      });
      persistSessionsLocally(next);
      return next;
    });

    // Atomic transaction for Firestore
    try {
      await atomicUpdateSongInfo(activeSessionId, songId, { title, artist });
    } catch (e) {
      console.warn('Cloud atomicUpdateSongInfo skipped:', e);
    }
  };

  // Handler: Update song title, artist, and notes atomically preserving all part assignments
  const handleUpdateSongInfo = async (
    songId: string,
    title: string,
    artist: string,
    notes: string
  ) => {
    const cleanTitle = title.trim();
    const cleanArtist = artist.trim();
    const cleanNotes = notes.trim();
    const now = Date.now();

    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: now,
            songs: s.songs.map((song) =>
              song.id === songId
                ? {
                    ...song,
                    title: cleanTitle,
                    artist: cleanArtist,
                    notes: cleanNotes,
                  }
                : song
            ),
          };
        }
        return s;
      });
      persistSessionsLocally(next);
      return next;
    });

    showToast(`🎵 '${cleanTitle}' 곡 정보가 수정되었습니다.`);

    // Atomic transaction for Firestore
    try {
      await atomicUpdateSongInfo(activeSessionId, songId, {
        title: cleanTitle,
        artist: cleanArtist,
        notes: cleanNotes,
      });
    } catch (e) {
      console.warn('Cloud atomicUpdateSongInfo skipped:', e);
    }
  };

  // Handler: Update song notes
  const handleUpdateSongNotes = async (songId: string, notes: string) => {
    const now = Date.now();
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: now,
            songs: s.songs.map((song) =>
              song.id === songId ? { ...song, notes } : song
            ),
          };
        }
        return s;
      });
      persistSessionsLocally(next);
      return next;
    });

    // Atomic transaction for Firestore
    try {
      await atomicUpdateSongInfo(activeSessionId, songId, { notes });
    } catch (e) {
      console.warn('Cloud atomicUpdateSongInfo skipped:', e);
    }
  };

  // Handler: Update entire member array for a part of a song
  const handleUpdateSongPart = async (
    songId: string,
    part: PartType,
    members: string[]
  ) => {
    if (part === 'notes') return;

    const now = Date.now();
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: now,
            songs: s.songs.map((song) => {
              if (song.id === songId) {
                return { ...song, [part]: members };
              }
              return song;
            }),
          };
        }
        return s;
      });
      persistSessionsLocally(next);
      return next;
    });

    // Atomic transaction for Firestore
    try {
      await atomicUpdateSongPartMembers(activeSessionId, songId, part, members);
    } catch (e) {
      console.warn('Cloud atomicUpdateSongPartMembers skipped:', e);
    }
  };

  // Handler: Assign single member to song's part
  const handleAssignMember = async (
    songId: string,
    part: PartType,
    memberName: string
  ) => {
    if (part === 'notes') {
      await handleUpdateSongNotes(songId, memberName);
      return;
    }

    const now = Date.now();
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: now,
            songs: s.songs.map((song) => {
              if (song.id === songId) {
                const currentList = song[part] || [];
                if (!currentList.includes(memberName)) {
                  return {
                    ...song,
                    [part]: [...currentList, memberName],
                  };
                }
              }
              return song;
            }),
          };
        }
        return s;
      });
      persistSessionsLocally(next);
      return next;
    });

    showToast(`✅ [${memberName}]님이 배정되었습니다.`);

    // Atomic transaction for Firestore
    try {
      await atomicAssignMember(activeSessionId, songId, part, memberName);
    } catch (e) {
      console.warn('Cloud atomicAssignMember skipped:', e);
    }
  };

  // Handler: Remove single member from song's part
  const handleRemoveMember = async (
    songId: string,
    part: PartType,
    memberName: string
  ) => {
    if (part === 'notes') return;

    const now = Date.now();
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: now,
            songs: s.songs.map((song) => {
              if (song.id === songId) {
                return {
                  ...song,
                  [part]: (song[part] || []).filter((m) => m !== memberName),
                };
              }
              return song;
            }),
          };
        }
        return s;
      });
      persistSessionsLocally(next);
      return next;
    });

    showToast('파트에서 제외되었습니다.');

    // Atomic transaction for Firestore
    try {
      await atomicRemoveMember(activeSessionId, songId, part, memberName);
    } catch (e) {
      console.warn('Cloud atomicRemoveMember skipped:', e);
    }
  };

  // Handler: Clear all members of a part
  const handleClearPart = async (songId: string, part: PartType) => {
    if (part === 'notes') {
      await handleUpdateSongNotes(songId, '');
      return;
    }
    await handleUpdateSongPart(songId, part, []);
  };

  // Helper: Renders high-resolution, unclipped canvas of the entire table from "곡명" to "비고"
  const generateSheetCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const element =
      document.getElementById('sheet-table-capture-area') ||
      document.getElementById('capture-sheet-area');
    if (!element) return null;

    // Determine the full scroll width of the table so mobile screens don't clip horizontal columns
    const fullScrollWidth = Math.max(element.scrollWidth, element.offsetWidth, 780);

    const canvas = await html2canvas(element, {
      scale: 2, // 2x high resolution
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: fullScrollWidth,
      windowWidth: fullScrollWidth,
      backgroundColor: '#ffffff',
      ignoreElements: (node) => {
        return (
          node.getAttribute('data-html2canvas-ignore') === 'true' ||
          node.getAttribute('data-col') === 'manage' ||
          node.classList.contains('manage-col')
        );
      },
      onclone: (clonedDoc) => {
        const clonedElement =
          clonedDoc.getElementById('sheet-table-capture-area') ||
          clonedDoc.getElementById('capture-sheet-area');

        if (clonedElement) {
          clonedElement.style.overflow = 'visible';
          clonedElement.style.width = 'auto';
          clonedElement.style.maxWidth = 'none';

          // Expand any horizontal scroll wrappers in cloned DOM
          clonedElement
            .querySelectorAll<HTMLElement>('.overflow-x-auto, [class*="overflow-x"]')
            .forEach((el) => {
              el.style.overflow = 'visible';
              el.style.width = 'max-content';
              el.style.maxWidth = 'none';
            });

          // Table should take natural max-content width
          const table = clonedElement.querySelector<HTMLTableElement>('table');
          if (table) {
            table.style.width = 'max-content';
            table.style.minWidth = '100%';
          }

          // In html2canvas, position: sticky on table cells can cause overlap/jitter in offscreen rendering.
          // Neutralizing it in the cloned element ensures pristine table rendering.
          clonedElement
            .querySelectorAll<HTMLElement>('.sticky, [class*="sticky"]')
            .forEach((el) => {
              el.style.position = 'static';
              el.style.boxShadow = 'none';
            });
        }

        // Completely remove all manage column elements from the cloned DOM
        clonedDoc
          .querySelectorAll('.manage-col, [data-col="manage"], [data-html2canvas-ignore="true"]')
          .forEach((el) => {
            el.remove();
          });
      },
    });

    return canvas;
  };

  // Handler: High Quality PNG Image File Download
  const handleCaptureImage = async () => {
    try {
      setIsCapturing(true);

      const canvas = await generateSheetCanvas();
      if (!canvas) {
        showToast('배정표 영역을 찾을 수 없습니다.');
        return;
      }

      const dateName = (activeSession.dateKey || '배정표').replace(/[^0-9-]/g, '');
      const fileName = `누비밴드_파트배분_${dateName || activeSession.dateStr}.png`;

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      link.click();

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });

      showToast(`📷 ${fileName} 저장 완료!`);
    } catch (err) {
      console.error('Image capture error', err);
      showToast('이미지 저장 중 오류가 발생했습니다.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Handler: Clipboard Image Copy (Directly paste with Ctrl+V into KakaoTalk)
  const handleCopyImageToClipboard = async () => {
    try {
      setIsCopyingImage(true);

      const canvas = await generateSheetCanvas();
      if (!canvas) {
        showToast('배정표 영역을 찾을 수 없습니다.');
        return;
      }

      const dateName = (activeSession.dateKey || '배정표').replace(/[^0-9-]/g, '');
      const fileName = `누비밴드_파트배분_${dateName || activeSession.dateStr}.png`;

      canvas.toBlob(async (blob) => {
        try {
          if (!blob) {
            throw new Error('이미지 Blob 생성 실패');
          }

          if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            showToast('📋 이미지가 클립보드에 복사되었습니다! 카톡에 바로 Ctrl+V 하세요.');
          } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            link.click();
            showToast('클립보드 직접 복사를 미지원하는 브라우저로 이미지 파일이 다운로드되었습니다.');
          }
        } catch (clipErr) {
          console.warn('Clipboard write fallback to download:', clipErr);
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = fileName;
          link.click();
          showToast('클립보드 접근 제한으로 이미지 파일이 다운로드되었습니다.');
        } finally {
          setIsCopyingImage(false);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Image clipboard copy error', err);
      showToast('클립보드 이미지 복사 실패: 브라우저 권한을 확인해주세요.');
      setIsCopyingImage(false);
    }
  };

  // Open Assign modal with pre-selected song
  const handleOpenAssignModalWithSong = (songId: string, part?: PartType) => {
    setAssignModalSongId(songId);
    setAssignModalPart(part || 'vocal');
    setIsAssignModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans select-none text-gray-900">
      {/* 1. Clean Top Header Bar */}
      <Toolbar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onOpenAddDateModal={() => setIsAddDateModalOpen(true)}
        onOpenAddSongModal={() => setIsAddSongModalOpen(true)}
        onOpenAssignModal={() => {
          setAssignModalSongId(undefined);
          setAssignModalPart(undefined);
          setIsAssignModalOpen(true);
        }}
        onCaptureImage={handleCaptureImage}
        onCopyImageToClipboard={handleCopyImageToClipboard}
        onRequestDeleteSession={handleRequestDeleteSession}
        isCapturing={isCapturing}
        isCopyingImage={isCopyingImage}
      />

      {/* 2. Main Content (Assignment Table Card) */}
      <main className="flex-1 w-full flex flex-col">
        <SheetTable
          session={activeSession}
          onUpdateSongPart={handleUpdateSongPart}
          onUpdateSongNotes={handleUpdateSongNotes}
          onUpdateSongTitle={handleUpdateSongTitle}
          onUpdateSongInfo={handleUpdateSongInfo}
          onDeleteSong={handleDeleteSong}
          onOpenAssignModalWithSong={handleOpenAssignModalWithSong}
        />
      </main>

      {/* Modals */}
      <PartAssignmentModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        session={activeSession}
        initialSongId={assignModalSongId}
        initialPart={assignModalPart}
        onAssignMember={handleAssignMember}
        onRemoveMember={handleRemoveMember}
        onClearPart={handleClearPart}
      />

      <AddSongModal
        isOpen={isAddSongModalOpen}
        onClose={() => setIsAddSongModalOpen(false)}
        onAddSong={handleAddSong}
      />

      <AddDateModal
        isOpen={isAddDateModalOpen}
        onClose={() => setIsAddDateModalOpen(false)}
        lastSession={activeSession}
        onAddSession={handleAddDate}
      />

      {/* Session Delete Confirmation In-App Modal */}
      {isDeleteSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm overflow-hidden p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900">
                  합주일 삭제 확인
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  정말로 <strong>[{formatSessionDateWithDay(activeSession.dateStr, activeSession.dateKey)}]</strong> 기록을 완전히 삭제하시겠습니까? 복구할 수 없습니다.
                </p>
                <p className="text-[11px] text-gray-400 mt-2">
                  * 삭제 후 남아 있는 최신 합주 회차로 자동 이동합니다.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteSessionModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg transition cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSession}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg shadow-xs transition cursor-pointer"
              >
                완전 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
