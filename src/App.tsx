import React, { useState, useEffect, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { AlertCircle, Loader2 } from 'lucide-react';
import { RehearsalSession, Song, PartType } from './types';
import { INITIAL_SESSIONS } from './constants/defaultData';
import { Toolbar } from './components/Toolbar';
import { SheetTable } from './components/SheetTable';
import { PartAssignmentModal } from './components/PartAssignmentModal';
import { AddSongModal } from './components/AddSongModal';
import { AddDateModal } from './components/AddDateModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { AllSongsModal } from './components/AllSongsModal';
import { PasswordGate } from './components/PasswordGate';
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
  atomicReorderSongs,
  loadLocalSessions,
  LOCAL_STORAGE_KEY,
} from './services/firestoreService';

export default function App() {
  // 1. Initial Load: prioritize localStorage ('nubi_band_data') sorted in descending order (latest date first)
  const [sessions, setSessions] = useState<RehearsalSession[]>(() =>
    sortSessionsDescending(loadLocalSessions())
  );

  // Always default to the latest rehearsal session (sortedSessions[0]) upon first load or refresh
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const initialList = sortSessionsDescending(loadLocalSessions());
    if (initialList.length > 0) {
      return initialList[0].id;
    }
    return INITIAL_SESSIONS[0]?.id || 'session-2026-07-30';
  });

  // Track initial sync so fresh data from Firestore immediately selects the latest session
  const isInitialSyncRef = useRef<boolean>(true);

  // Modal states
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignModalSongId, setAssignModalSongId] = useState<string | undefined>(undefined);
  const [assignModalPart, setAssignModalPart] = useState<PartType | undefined>(undefined);

  const [isAddSongModalOpen, setIsAddSongModalOpen] = useState(false);
  const [isAddDateModalOpen, setIsAddDateModalOpen] = useState(false);
  const [isDeleteSessionModalOpen, setIsDeleteSessionModalOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [previewImageDataUrl, setPreviewImageDataUrl] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isAllSongsModalOpen, setIsAllSongsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 1.1 Password Lock Authentication State (PIN: 2290)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('nubi_band_auth_verified') === 'true';
    } catch {
      return false;
    }
  });

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
    try {
      sessionStorage.setItem('nubi_band_auth_verified', 'true');
    } catch (e) {
      console.warn('Failed to save auth state to sessionStorage', e);
    }
  };

  const handleLockApp = () => {
    try {
      sessionStorage.removeItem('nubi_band_auth_verified');
    } catch (e) {
      console.warn('Failed to remove auth state from sessionStorage', e);
    }
    setIsAuthenticated(false);
    showToast('화면이 잠겼습니다.');
  };

  // 2. Automatic synchronization to localStorage on state changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
    } catch (err) {
      console.warn('Failed to persist sessions to localStorage:', err);
    }
  }, [sessions]);

  // Subscribe to real-time updates / multi-tab storage events
  useEffect(() => {
    const unsubscribe = subscribeToRehearsalSessions((updatedSessions) => {
      if (updatedSessions && updatedSessions.length > 0) {
        const sorted = sortSessionsDescending(updatedSessions);
        setSessions(sorted);

        if (isInitialSyncRef.current) {
          // On initial page load or refresh, always default to the latest rehearsal session (index 0)
          isInitialSyncRef.current = false;
          setActiveSessionId(sorted[0].id);
        } else {
          // In subsequent background updates (e.g. concurrent edits), preserve active session if still present
          setActiveSessionId((prev) => {
            if (!prev || !sorted.some((s) => s.id === prev)) {
              return sorted[0].id;
            }
            return prev;
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const sortedSessions = sortSessionsDescending(sessions);
  const activeSession =
    sortedSessions.find((s) => s.id === activeSessionId) ||
    sortedSessions[0] ||
    INITIAL_SESSIONS[0];


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
      date: formattedDateStr,
      sheetTitle: activeSession?.sheetTitle || '누비 밴드 파트 배분',
      songs: songsToCarry,
      createdAt: Date.now(),
      updatedAt: Date.now(),
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

  // Handler: Reorder songs in the active rehearsal session
  const handleReorderSongs = async (newSongs: Song[]) => {
    const now = Date.now();
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: now,
            songs: newSongs,
          };
        }
        return s;
      });
      persistSessionsLocally(next);
      return next;
    });

    showToast('곡 순서가 변경되었습니다.');

    // Atomic / Firestore update
    try {
      await atomicReorderSongs(activeSessionId, newSongs);
    } catch (e) {
      console.warn('Cloud atomicReorderSongs skipped:', e);
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

  // Helper: converts base64 dataUrl into Blob safely
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const parts = dataUrl.split(';base64,');
    const contentType = parts[0].split(':')[1] || 'image/png';
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  };

  // Helper: Renders high-resolution image directly using html2canvas
  const generateSheetPng = async (): Promise<string | null> => {
    const targetElement =
      document.getElementById('capture-target-table') ||
      document.getElementById('sheet-table-capture-area');
    if (!targetElement) {
      throw new Error('배정표 영역을 찾을 수 없습니다.');
    }

    // 1. 캡처 직전 잠시 opacity 복구 및 포인터 비활성화 유지
    const prevOpacity = targetElement.style.opacity;
    const prevPointerEvents = targetElement.style.pointerEvents;
    targetElement.style.opacity = '1';

    try {
      // 2. 폰트 및 스타일 계산을 위한 짧은 지연(Tick)
      await new Promise((resolve) => setTimeout(resolve, 120));

      const captureWidth = targetElement.offsetWidth || 1000;
      const captureHeight = targetElement.offsetHeight || 300;

      const canvas = await html2canvas(targetElement, {
        scale: 2, // 선명한 고해상도 (Retina)
        useCORS: true,
        backgroundColor: '#ffffff',
        width: captureWidth,
        height: captureHeight,
        windowWidth: 1200,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        logging: false,
        ignoreElements: (element: Element) => {
          return (
            element.classList.contains('manage-col') ||
            element.getAttribute('data-col') === 'manage' ||
            element.getAttribute('data-html2canvas-ignore') === 'true'
          );
        },
      });

      // 3. Validate canvas dimensions (guard against blank rendering)
      if (!canvas || canvas.width < 100 || canvas.height < 100) {
        throw new Error('생성된 배정표 이미지가 비어 있거나 크기가 비정상적입니다.');
      }

      // 4. Convert to high-quality PNG data URL
      const dataUrl = canvas.toDataURL('image/png');
      if (!dataUrl || dataUrl.length < 1000) {
        throw new Error('배정표 이미지 데이터 추출에 실패했습니다.');
      }

      return dataUrl;
    } finally {
      // 5. 캡처 완료 후 다시 투명화
      targetElement.style.opacity = prevOpacity || '0';
      targetElement.style.pointerEvents = prevPointerEvents || 'none';
    }
  };

  // Handler: High Quality PNG Image File Direct Download
  const handleCaptureImage = async () => {
    try {
      setIsCapturing(true);

      const dataUrl = await generateSheetPng();
      if (!dataUrl) {
        showToast('배정표 영역을 찾을 수 없습니다.');
        return;
      }

      const currentSessionDate =
        (activeSession.dateKey || activeSession.dateStr || '배정표').replace(/[^0-9-]/g, '') ||
        activeSession.dateStr;
      const fileName = `누비밴드_합주배정표_${currentSessionDate}.png`;

      // Trigger direct download without preview modal or screen flash
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('이미지가 다운로드되었습니다.');
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

      const dataUrl = await generateSheetPng();
      if (!dataUrl) {
        showToast('배정표 영역을 찾을 수 없습니다.');
        return;
      }

      setPreviewImageDataUrl(dataUrl);

      let clipboardSuccess = false;
      if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
        try {
          const blob = dataUrlToBlob(dataUrl);
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          clipboardSuccess = true;
          showToast('📋 이미지가 클립보드에 복사되었습니다! 카톡에 바로 Ctrl+V 하세요.');
        } catch (clipErr) {
          console.warn('Clipboard write restricted:', clipErr);
        }
      }

      // If clipboard write failed or was blocked by browser permissions, open ImagePreviewModal
      if (!clipboardSuccess) {
        setIsPreviewModalOpen(true);
        showToast('클립보드 접근이 제한되어 이미지 미리보기 창을 띄웠습니다.');
      }
    } catch (err) {
      console.error('Image clipboard copy error', err);
      showToast('클립보드 이미지 복사 실패: 브라우저 권한을 확인해주세요.');
    } finally {
      setIsCopyingImage(false);
    }
  };

  // Open Assign modal with pre-selected song
  const handleOpenAssignModalWithSong = (songId: string, part?: PartType) => {
    setAssignModalSongId(songId);
    setAssignModalPart(part || 'vocal');
    setIsAssignModalOpen(true);
  };

  // Render password gate if not authenticated
  if (!isAuthenticated) {
    return <PasswordGate onSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans select-none text-gray-900">
      {/* 1. Clean Top Header Bar */}
      <Toolbar
        sessions={sortedSessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onOpenAddDateModal={() => setIsAddDateModalOpen(true)}
        onOpenAllSongsModal={() => setIsAllSongsModalOpen(true)}
        onRequestDeleteSession={handleRequestDeleteSession}
        onLock={handleLockApp}
      />

      {/* 2. Main Content (Assignment Table Card with embedded action toolbar) */}
      <main className="flex-1 w-full flex flex-col pt-5 sm:pt-6 pb-8">
        <SheetTable
          session={activeSession}
          onUpdateSongPart={handleUpdateSongPart}
          onUpdateSongNotes={handleUpdateSongNotes}
          onUpdateSongTitle={handleUpdateSongTitle}
          onUpdateSongInfo={handleUpdateSongInfo}
          onDeleteSong={handleDeleteSong}
          onOpenAssignModalWithSong={handleOpenAssignModalWithSong}
          onOpenAllSongsModal={() => setIsAllSongsModalOpen(true)}
          onReorderSongs={handleReorderSongs}
          onOpenAddSongModal={() => setIsAddSongModalOpen(true)}
          onOpenAssignModal={() => {
            setAssignModalSongId(undefined);
            setAssignModalPart(undefined);
            setIsAssignModalOpen(true);
          }}
          onCaptureImage={handleCaptureImage}
          onCopyImageToClipboard={handleCopyImageToClipboard}
          isCapturing={isCapturing}
          isCopyingImage={isCopyingImage}
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

      {/* Loading Indicator Overlay (클립보드 이미지 복사 시에만 노출) */}
      {isCopyingImage && (
        <div className="fixed inset-0 z-70 flex flex-col items-center justify-center bg-black/45 backdrop-blur-xs select-none animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl px-6 py-5 shadow-2xl border border-gray-200 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">클립보드 복사 중...</p>
              <p className="text-xs text-gray-500 mt-0.5">고화질 표 이미지를 변환하고 있습니다.</p>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview & Mobile Sharing Modal */}
      <ImagePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        imageDataUrl={previewImageDataUrl}
        fileName={`누비밴드_합주배정표_${(activeSession.dateKey || '배정표').replace(/[^0-9-]/g, '') || activeSession.dateStr}.png`}
        dateLabel={formatSessionDateWithDay(activeSession.dateStr, activeSession.dateKey)}
        onShowToast={showToast}
      />

      {/* All Songs History & Merged Part Assignment Modal */}
      <AllSongsModal
        isOpen={isAllSongsModalOpen}
        onClose={() => setIsAllSongsModalOpen(false)}
        sessions={sessions}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
