import React, { useState, useRef, useEffect } from 'react';
import {
  Trash2,
  Edit2,
  AlertCircle,
  X,
  ListMusic,
  GripVertical,
  Plus,
  UserCheck,
  Camera,
  ChevronDown,
  Download,
  ClipboardCopy,
  Loader2,
} from 'lucide-react';
import { RehearsalSession, PartType, Song } from '../types';
import {
  getAssignedMembersForPart,
  formatSessionDateWithDay,
  PART_LABELS,
} from '../utils/sheetUtils';
import { EditSongModal } from './EditSongModal';

interface SheetTableProps {
  session: RehearsalSession;
  onUpdateSongPart: (songId: string, part: PartType, members: string[]) => void;
  onUpdateSongNotes: (songId: string, notes: string) => void;
  onUpdateSongTitle: (songId: string, title: string, artist: string) => void;
  onUpdateSongInfo?: (songId: string, title: string, artist: string, notes: string) => void;
  onDeleteSong: (songId: string) => void;
  onOpenAssignModalWithSong?: (songId: string, part?: PartType) => void;
  onOpenAllSongsModal?: () => void;
  onReorderSongs?: (reorderedSongs: Song[]) => void;
  onOpenAddSongModal?: () => void;
  onOpenAssignModal?: () => void;
  onCaptureImage?: () => void;
  onCopyImageToClipboard?: () => void;
  isCapturing?: boolean;
  isCopyingImage?: boolean;
}

export const SheetTable: React.FC<SheetTableProps> = ({
  session,
  onUpdateSongPart,
  onUpdateSongNotes,
  onUpdateSongTitle,
  onUpdateSongInfo,
  onDeleteSong,
  onOpenAssignModalWithSong,
  onOpenAllSongsModal,
  onReorderSongs,
  onOpenAddSongModal,
  onOpenAssignModal,
  onCaptureImage,
  onCopyImageToClipboard,
  isCapturing = false,
  isCopyingImage = false,
}) => {
  // Dropdown state for unified image action menu
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setIsShareMenuOpen(false);
      }
    };
    if (isShareMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isShareMenuOpen]);

  const isBusy = isCapturing || isCopyingImage;

  // Modal state for editing song title, artist & notes
  const [songToEdit, setSongToEdit] = useState<Song | null>(null);

  // State for deletion confirm popup
  const [songToDelete, setSongToDelete] = useState<{
    id: string;
    title: string;
    artist: string;
  } | null>(null);

  const handleSaveSongEdit = (
    songId: string,
    title: string,
    artist: string,
    notes: string
  ) => {
    if (onUpdateSongInfo) {
      onUpdateSongInfo(songId, title, artist, notes);
    } else {
      onUpdateSongTitle(songId, title, artist);
      onUpdateSongNotes(songId, notes);
    }
  };

  const handleConfirmDelete = () => {
    if (!songToDelete) return;
    onDeleteSong(songToDelete.id);
    setSongToDelete(null);
  };

  // Drag and drop reordering state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState<boolean>(false);

  // Refs for mobile long-press touch interaction (220ms delay & scroll protection)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchActiveIndexRef = useRef<number | null>(null);
  const currentDragOverRef = useRef<number | null>(null);

  // Cleanup body overflow on unmount
  useEffect(() => {
    return () => {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      document.body.style.overflow = '';
    };
  }, []);

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= session.songs.length || toIndex >= session.songs.length) return;

    const updated = [...session.songs];
    const [movedSong] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedSong);

    onReorderSongs?.(updated);
  };

  // --- PC HTML5 Drag & Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      handleReorder(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // --- Mobile Touch with Long-Press (220ms) Handlers ---
  const cancelTouchTimer = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    cancelTouchTimer();
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    touchActiveIndexRef.current = index;
    currentDragOverRef.current = index;

    // Start 220ms long-press timer
    touchTimerRef.current = setTimeout(() => {
      // Tactile haptic feedback if supported by browser
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate(40);
        } catch {
          // ignore
        }
      }
      setIsTouchDragging(true);
      setDraggedIndex(index);
      setDragOverIndex(index);
      document.body.style.overflow = 'hidden'; // prevent page scrolling while dragging row
    }, 220);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];

    // If long press has not triggered yet, check if finger moved (normal scroll gesture)
    if (!isTouchDragging) {
      if (touchStartPosRef.current) {
        const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);
        if (deltaX > 8 || deltaY > 8) {
          cancelTouchTimer();
        }
      }
      return;
    }

    // Touch dragging active: prevent default scroll and calculate target row under finger
    e.preventDefault();

    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;

    const row = element.closest('tr[data-song-index]') as HTMLTableRowElement | null;
    if (row) {
      const idxAttr = row.getAttribute('data-song-index');
      if (idxAttr !== null) {
        const overIndex = parseInt(idxAttr, 10);
        if (!isNaN(overIndex) && overIndex !== currentDragOverRef.current) {
          currentDragOverRef.current = overIndex;
          setDragOverIndex(overIndex);
        }
      }
    }
  };

  const handleTouchEnd = () => {
    cancelTouchTimer();
    if (isTouchDragging) {
      document.body.style.overflow = '';
      const from = touchActiveIndexRef.current;
      const to = currentDragOverRef.current;
      if (from !== null && to !== null && from !== to) {
        handleReorder(from, to);
      }
      setIsTouchDragging(false);
      setDraggedIndex(null);
      setDragOverIndex(null);
      touchActiveIndexRef.current = null;
      currentDragOverRef.current = null;
    }
  };

  const columnHeaders: {
    key: PartType | 'song';
    label: string;
    width: string;
    bg: string;
    isSticky?: boolean;
  }[] = [
    {
      key: 'song',
      label: '곡명 - 아티스트',
      width: 'w-[22%] min-w-[150px] sm:min-w-[170px]',
      bg: 'bg-[#bfdbfe]',
      isSticky: true,
    },
    {
      key: 'vocal',
      label: '보컬',
      width: 'w-[11%] min-w-[85px] sm:min-w-[95px]',
      bg: 'bg-[#bfdbfe]',
    },
    {
      key: 'guitar1',
      label: '리드 기타',
      width: 'w-[11%] min-w-[85px] sm:min-w-[95px]',
      bg: 'bg-[#bfdbfe]',
    },
    {
      key: 'guitar2',
      label: '백킹 기타',
      width: 'w-[11%] min-w-[85px] sm:min-w-[95px]',
      bg: 'bg-[#bfdbfe]',
    },
    {
      key: 'bass',
      label: '베이스',
      width: 'w-[11%] min-w-[80px] sm:min-w-[90px]',
      bg: 'bg-[#bfdbfe]',
    },
    {
      key: 'drum',
      label: '드럼',
      width: 'w-[11%] min-w-[80px] sm:min-w-[90px]',
      bg: 'bg-[#bfdbfe]',
    },
    {
      key: 'keyboard',
      label: '건반',
      width: 'w-[11%] min-w-[80px] sm:min-w-[90px]',
      bg: 'bg-[#bfdbfe]',
    },
    {
      key: 'notes',
      label: '비고',
      width: 'w-[10%] min-w-[80px] sm:min-w-[90px]',
      bg: 'bg-[#fecdd3]',
    },
  ];

  // Unique participating members in this session for mobile summary
  const sessionParticipants = Array.from(
    new Set([
      ...getAssignedMembersForPart(session, 'vocal'),
      ...getAssignedMembersForPart(session, 'guitar1'),
      ...getAssignedMembersForPart(session, 'guitar2'),
      ...getAssignedMembersForPart(session, 'bass'),
      ...getAssignedMembersForPart(session, 'drum'),
      ...getAssignedMembersForPart(session, 'keyboard'),
    ])
  ).filter(Boolean);

  // Helper: Renders 2 or more members stacked vertically in mobile grid cells without commas
  const renderStackedMembers = (memberList?: string[]) => {
    if (!memberList || memberList.length === 0) {
      return <span className="text-gray-300 select-none">&nbsp;</span>;
    }

    const names = memberList
      .flatMap((m) => (m ? m.split(',') : []))
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length === 0) {
      return <span className="text-gray-300 select-none">&nbsp;</span>;
    }

    return (
      <div className="flex flex-col items-center justify-center gap-0.5 leading-tight w-full py-0.5">
        {names.map((name, idx) => (
          <span
            key={idx}
            className={`whitespace-nowrap font-medium text-gray-800 tracking-tight ${
              names.length > 1 ? 'text-[11px]' : 'text-[12px]'
            }`}
          >
            {name}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
      {/* Printable / Capturable Clean White Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-xs p-3 sm:p-5 w-full">
        {/* Table Action Toolbar: [곡 추가], [파트 선택], [📷 캡처] */}
        <div
          data-html2canvas-ignore="true"
          className="w-full flex justify-between items-center pb-3 mb-2.5 border-b border-gray-100 select-none"
        >
          {/* 좌측: [+ 곡 추가] + [👤 파트 선택] */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onOpenAddSongModal && (
              <button
                type="button"
                onClick={onOpenAddSongModal}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-2xs transition active:scale-98 shrink-0 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-gray-500" />
                <span>곡 추가</span>
              </button>
            )}

            {onOpenAssignModal && (
              <button
                type="button"
                onClick={onOpenAssignModal}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition active:scale-98 shrink-0 cursor-pointer whitespace-nowrap"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>파트 선택</span>
              </button>
            )}
          </div>

          {/* 우측: [📷 캡처] 드롭다운 버튼 */}
          <div className="relative shrink-0" ref={shareMenuRef}>
            <button
              type="button"
              onClick={() => setIsShareMenuOpen(!isShareMenuOpen)}
              disabled={isBusy}
              title="배정표 사진 저장 및 클립보드 복사"
              className={`inline-flex items-center justify-center gap-1 p-2 sm:px-2.5 sm:py-1.5 text-xs font-semibold rounded-lg border transition shadow-2xs cursor-pointer active:scale-98 ${
                isShareMenuOpen
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
              } disabled:opacity-50`}
            >
              {isBusy ? (
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
              ) : (
                <Camera className="w-4 h-4 text-emerald-600" />
              )}
              <ChevronDown
                className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${
                  isShareMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Popover Menu */}
            {isShareMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                {/* 1. 사진 저장 (PNG) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsShareMenuOpen(false);
                    onCaptureImage?.();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 flex items-center gap-2.5 transition cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 leading-tight">사진 저장 (PNG)</div>
                    <div className="text-[10px] text-gray-400">배정표 파일 다운로드</div>
                  </div>
                </button>

                <div className="my-1 border-t border-gray-100" />

                {/* 2. 사진 복사 (클립보드) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsShareMenuOpen(false);
                    onCopyImageToClipboard?.();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 flex items-center gap-2.5 transition cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                    <ClipboardCopy className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 leading-tight">사진 복사 (클립보드)</div>
                    <div className="text-[10px] text-gray-400">카톡에 바로 Ctrl+V 붙여넣기</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* A. DESKTOP / TABLET VIEW (sm and above): Horizontal Table */}
        {/* ======================================================== */}
        <div
          id="sheet-table-capture-area"
          data-capture-target="true"
          className="hidden sm:block w-full bg-white"
        >
          <div className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-gray-300">
            <table className="w-full border-separate border-spacing-0 text-xs sm:text-sm select-text border-t border-l border-gray-300">
            <thead>
              {/* Row 1: Date Box Cell (연한 살구/오렌지) - Sticky on mobile */}
              <tr>
                <th
                  colSpan={1}
                  className="sticky left-0 z-20 bg-[#fed7aa] text-gray-900 font-bold py-2.5 px-3 text-center tracking-tight text-xs sm:text-sm select-none border-r border-b border-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]"
                >
                  {formatSessionDateWithDay(session.dateStr, session.dateKey)}
                </th>
                <th
                  colSpan={7}
                  className="bg-white border-r border-b border-gray-300"
                />
                <th
                  data-html2canvas-ignore="true"
                  data-col="manage"
                  className="manage-col w-10 bg-transparent border-b border-gray-300"
                />
              </tr>

              {/* Row 2: Column Headers (Pastel Blue + Pastel Rose for 비고) */}
              <tr>
                {columnHeaders.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.bg} ${col.width} text-gray-900 font-bold py-2.5 px-1.5 sm:px-2 text-center tracking-tight text-xs sm:text-sm select-none border-r border-b border-gray-300 ${
                      col.isSticky
                        ? 'sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]'
                        : ''
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
                <th
                  data-html2canvas-ignore="true"
                  data-col="manage"
                  className="manage-col w-10 bg-gray-50 border-r border-b border-gray-300 text-[11px] text-gray-400 font-normal py-2 px-1 text-center"
                >
                  관리
                </th>
              </tr>
            </thead>

            <tbody>
              {/* Row 3: '참여인원' Summary Row */}
              <tr className="bg-[#f1f5f9] font-medium text-gray-700">
                <td className="sticky left-0 z-10 bg-[#e2e8f0] text-center font-bold py-2 px-2.5 text-gray-900 select-none border-r border-b border-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]">
                  참여인원
                </td>

                {/* Vocal */}
                <td className="py-2 px-1.5 text-center text-[11px] sm:text-xs leading-snug break-keep border-r border-b border-gray-300">
                  {getAssignedMembersForPart(session, 'vocal').join(', ') || '-'}
                </td>

                {/* Guitar 1 */}
                <td className="py-2 px-1.5 text-center text-[11px] sm:text-xs leading-snug break-keep border-r border-b border-gray-300">
                  {getAssignedMembersForPart(session, 'guitar1').join(', ') || '-'}
                </td>

                {/* Guitar 2 */}
                <td className="py-2 px-1.5 text-center text-[11px] sm:text-xs leading-snug break-keep border-r border-b border-gray-300">
                  {getAssignedMembersForPart(session, 'guitar2').join(', ') || '-'}
                </td>

                {/* Bass */}
                <td className="py-2 px-1.5 text-center text-[11px] sm:text-xs leading-snug break-keep border-r border-b border-gray-300">
                  {getAssignedMembersForPart(session, 'bass').join(', ') || '-'}
                </td>

                {/* Drum */}
                <td className="py-2 px-1.5 text-center text-[11px] sm:text-xs leading-snug break-keep border-r border-b border-gray-300">
                  {getAssignedMembersForPart(session, 'drum').join(', ') || '-'}
                </td>

                {/* Keyboard */}
                <td className="py-2 px-1.5 text-center text-[11px] sm:text-xs leading-snug break-keep border-r border-b border-gray-300">
                  {getAssignedMembersForPart(session, 'keyboard').join(', ') || '-'}
                </td>

                {/* Notes */}
                <td className="py-2 px-1.5 text-center text-[11px] sm:text-xs text-gray-400 border-r border-b border-gray-300">
                  -
                </td>

                <td
                  data-html2canvas-ignore="true"
                  data-col="manage"
                  className="manage-col bg-gray-50/50 border-r border-b border-gray-300"
                />
              </tr>

              {/* Song Rows */}
              {session.songs.map((song, index) => {
                const isCurrentlyDragged = draggedIndex === index;
                const isTargetOfDrag = dragOverIndex === index && draggedIndex !== index;

                return (
                  <tr
                    key={song.id}
                    data-song-index={index}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`group transition-all duration-150 ${
                      isCurrentlyDragged
                        ? 'opacity-85 bg-blue-50/90 shadow-lg ring-2 ring-blue-500 scale-[1.002] z-30 relative'
                        : isTargetOfDrag
                        ? 'bg-blue-50/60 border-t-2 border-t-blue-600'
                        : 'hover:bg-blue-50/20'
                    }`}
                  >
                    {/* Song Title & Artist Cell with automatic row numbering: 1. Title - Artist */}
                    <td
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      onTouchStart={(e) => handleTouchStart(e, index)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onTouchCancel={handleTouchEnd}
                      title="드래그하여 순서 변경 (모바일: 꾹 누른 후 위아래로 이동)"
                      className={`sticky left-0 z-10 py-2.5 px-2 sm:px-2.5 text-left font-medium border-r border-b border-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)] select-none cursor-grab active:cursor-grabbing transition-colors ${
                        isCurrentlyDragged
                          ? 'bg-blue-100/90'
                          : 'bg-white group-hover:bg-[#f8fafd]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <GripVertical
                          data-html2canvas-ignore="true"
                          className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600 shrink-0 select-none transition-colors pointer-events-none"
                        />
                        <div className="flex flex-wrap items-baseline gap-x-1.5 text-left leading-snug min-w-0 flex-1">
                          {/* 1. 연번 + 곡명 (절대 분리 금지) */}
                          <span className="font-semibold text-gray-900 whitespace-nowrap">
                            {index + 1}. {song.title}
                          </span>

                          {/* 2. 구분자 및 아티스트 (폭 부족 시 통째로 다음 줄로 개행) */}
                          {song.artist && (
                            <span className="text-gray-500 text-xs sm:text-sm whitespace-nowrap">
                              - {song.artist}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                  {/* Part Cells */}
                  {(
                    [
                      { key: 'vocal' },
                      { key: 'guitar1' },
                      { key: 'guitar2' },
                      { key: 'bass' },
                      { key: 'drum' },
                      { key: 'keyboard' },
                      { key: 'notes' },
                    ] as const
                  ).map(({ key }) => {
                    const rawValue =
                      key === 'notes' ? song.notes : song[key].join(', ');
                    const hasMembers = key !== 'notes' && song[key].length > 0;

                    return (
                      <td
                        key={key}
                        onClick={() => {
                          if (key === 'notes') {
                            setSongToEdit(song);
                          } else {
                            onOpenAssignModalWithSong?.(song.id, key as PartType);
                          }
                        }}
                        title={
                          key === 'notes'
                            ? '비고 수정 (클릭 시 수정 창 열림)'
                            : hasMembers
                            ? `${song.title} [${PART_LABELS[key as PartType]}]: ${rawValue} (클릭하여 배정 인원 관리/추가)`
                            : `${song.title} [${PART_LABELS[key as PartType]}] 파트원 배정 및 신청하기 (클릭)`
                        }
                        className="py-2 px-1.5 sm:px-2 text-center text-xs sm:text-sm text-gray-900 cursor-pointer min-h-[38px] hover:bg-blue-100/60 active:bg-blue-200/60 break-keep border-r border-b border-gray-300 transition-colors select-none group/cell"
                      >
                        <div className="flex items-center justify-center min-h-[22px] leading-tight">
                          <span
                            className={
                              rawValue
                                ? 'font-medium text-gray-900'
                                : 'text-gray-300 group-hover/cell:text-blue-500 font-normal transition-colors'
                            }
                          >
                            {rawValue || (key === 'notes' ? '' : '-')}
                          </span>
                        </div>
                      </td>
                    );
                  })}

                  {/* Row Management (Edit Song Info & Delete - always accessible) */}
                  <td
                    data-html2canvas-ignore="true"
                    data-col="manage"
                    className="manage-col px-1 text-center align-middle bg-white group-hover:bg-[#f8fafd] border-r border-b border-gray-300"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSongToEdit(song)}
                        title="곡 정보 수정 (곡명, 아티스트, 비고)"
                        className="p-1.5 text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSongToDelete({
                            id: song.id,
                            title: song.title,
                            artist: song.artist,
                          })
                        }
                        title="이 합주에서 곡 삭제"
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>

        {/* ======================================================== */}
        {/* B. MOBILE VIEW (under sm): Grid Card List View           */}
        {/* ======================================================== */}
        <div className="block sm:hidden w-full select-none pt-1">
          {/* 1. Mobile Top Information Box */}
          <div className="border border-gray-200 rounded-[6px] overflow-hidden mb-3.5 bg-white shadow-2xs">
            {/* 1행: 주황색 날짜 헤더 (가운데 정렬) */}
            <div className="bg-[#fed7aa] text-gray-900 font-bold py-2.5 px-3 text-center text-sm border-b border-gray-200 tracking-tight">
              {formatSessionDateWithDay(session.dateStr, session.dateKey)}
            </div>
            {/* 2행: 참여인원 (세로 분할선) */}
            <div className="flex items-stretch bg-[#f8f9fb] text-xs">
              <div className="w-20 min-w-[80px] bg-[#e2e8f0] text-center font-bold text-gray-700 py-2.5 px-1 border-r border-gray-200 flex items-center justify-center shrink-0">
                참여인원
              </div>
              <div className="py-2.5 px-3 text-gray-800 font-medium break-keep leading-snug flex-1 flex items-center bg-[#f8f9fb]">
                {sessionParticipants.length > 0 ? sessionParticipants.join(', ') : '-'}
              </div>
            </div>
          </div>

          {/* 2. Song Grid Card List */}
          {session.songs && session.songs.length > 0 ? (
            <div className="flex flex-col">
              {session.songs.map((song, index) => (
                <div
                  key={song.id}
                  data-song-id={song.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onTouchStart={(e) => handleTouchStart(e, index)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className={`bg-white border border-gray-200 rounded-[6px] mb-[8px] overflow-hidden shadow-2xs transition-all ${
                    draggedIndex === index ? 'opacity-40 scale-[0.99] border-dashed border-blue-400' : ''
                  } ${dragOverIndex === index ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}
                >
                  {/* [1층: 곡 정보 & 관리 도구] */}
                  <div
                    className="w-full flex justify-between items-center px-3 border-b border-blue-200"
                    style={{ backgroundColor: '#bfdbfe', height: '40px' }}
                  >
                    {/* 좌측: 드래그 핸들 + [연번]. [곡명] + [- 아티스트] */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                      <div
                        className="cursor-grab active:cursor-grabbing py-1 text-slate-300 hover:text-slate-500 touch-none shrink-0"
                        style={{
                          marginLeft: '-8px',
                          marginRight: '-4px',
                          paddingLeft: '0px',
                          paddingRight: '0px',
                        }}
                        title="드래그하여 순서 변경"
                      >
                        <GripVertical className="w-4 h-4 text-slate-300" />
                      </div>
                      <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                        <span className="text-[15px] font-bold text-slate-900 tracking-tight shrink-0">
                          {index + 1}. {song.title}
                        </span>
                        {song.artist && (
                          <span className="text-[13px] font-bold text-slate-500 truncate">
                            - {song.artist}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 우측: 수정 & 삭제 버튼 */}
                    <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setSongToEdit(song)}
                        title="곡 정보 수정"
                        className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-white/80 transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSongToDelete({
                            id: song.id,
                            title: song.title,
                            artist: song.artist,
                          })
                        }
                        title="곡 삭제"
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-white/80 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* [2층: 파트 이름 행 (6열 균등 분할)] */}
                  <div className="grid grid-cols-6 border-b border-gray-200 bg-[#f8f9fb] text-center py-1.5 text-xs font-semibold text-gray-700">
                    <div className="border-r border-gray-200">V</div>
                    <div className="border-r border-gray-200">G1</div>
                    <div className="border-r border-gray-200">G2</div>
                    <div className="border-r border-gray-200">B</div>
                    <div className="border-r border-gray-200">D</div>
                    <div>K</div>
                  </div>

                  {/* [3층: 멤버 이름 행 (6열 균등 분할 - 2명 이상 세로 스택)] */}
                  <div
                    className="grid grid-cols-6 text-center text-xs text-gray-800 bg-white items-center"
                    style={{ height: '40px' }}
                  >
                    <div
                      onClick={() => onOpenAssignModalWithSong?.(song.id, 'vocal')}
                      className="px-0.5 border-r border-gray-100 min-h-[34px] flex items-center justify-center cursor-pointer hover:bg-blue-50/50"
                      title="보컬 파트 멤버 배정"
                    >
                      {renderStackedMembers(song.vocal)}
                    </div>
                    <div
                      onClick={() => onOpenAssignModalWithSong?.(song.id, 'guitar1')}
                      className="px-0.5 border-r border-gray-100 min-h-[34px] flex items-center justify-center cursor-pointer hover:bg-blue-50/50"
                      title="리드 기타 파트 멤버 배정"
                    >
                      {renderStackedMembers(song.guitar1)}
                    </div>
                    <div
                      onClick={() => onOpenAssignModalWithSong?.(song.id, 'guitar2')}
                      className="px-0.5 border-r border-gray-100 min-h-[34px] flex items-center justify-center cursor-pointer hover:bg-blue-50/50"
                      title="백킹 기타 파트 멤버 배정"
                    >
                      {renderStackedMembers(song.guitar2)}
                    </div>
                    <div
                      onClick={() => onOpenAssignModalWithSong?.(song.id, 'bass')}
                      className="px-0.5 border-r border-gray-100 min-h-[34px] flex items-center justify-center cursor-pointer hover:bg-blue-50/50"
                      title="베이스 파트 멤버 배정"
                    >
                      {renderStackedMembers(song.bass)}
                    </div>
                    <div
                      onClick={() => onOpenAssignModalWithSong?.(song.id, 'drum')}
                      className="px-0.5 border-r border-gray-100 min-h-[34px] flex items-center justify-center cursor-pointer hover:bg-blue-50/50"
                      title="드럼 파트 멤버 배정"
                    >
                      {renderStackedMembers(song.drum)}
                    </div>
                    <div
                      onClick={() => onOpenAssignModalWithSong?.(song.id, 'keyboard')}
                      className="px-0.5 min-h-[34px] flex items-center justify-center cursor-pointer hover:bg-blue-50/50"
                      title="건반 파트 멤버 배정"
                    >
                      {renderStackedMembers(song.keyboard)}
                    </div>
                  </div>

                  {/* [4층: 비고 행 (notes가 있을 경우)] */}
                  {song.notes && song.notes.trim() && (
                    <div className="px-3 py-1.5 bg-[#fff1f2] border-t border-rose-100 text-[11px] text-[#be123c] flex items-center gap-1.5 leading-snug">
                      <span className="font-semibold shrink-0">비고:</span>
                      <span className="break-words">{song.notes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200 p-6">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2">
                <Plus className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-gray-700">등록된 곡이 없습니다</p>
              <p className="text-xs text-gray-400 mt-1">상단의 [+ 곡 추가] 버튼을 눌러 첫 곡을 등록해보세요.</p>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* C. EXPORT CAPTURE TEMPLATE (Always 1000px Horizontal)    */}
        {/* ======================================================== */}
        <div
          id="capture-target-table"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '1000px',
            minWidth: '1000px',
            zIndex: -50,
            opacity: 0,
            backgroundColor: '#ffffff',
            pointerEvents: 'none',
          }}
          className="p-5"
          aria-hidden="true"
        >
          <div className="w-full bg-white border border-gray-300 rounded-lg overflow-hidden">
            <table className="w-full border-separate border-spacing-0 text-sm select-text border-t border-l border-gray-300">
              <thead>
                {/* Row 1: Date Box Cell (연한 살구/오렌지) */}
                <tr>
                  <th
                    colSpan={1}
                    className="bg-[#fed7aa] text-gray-900 font-bold py-2.5 px-3 text-center tracking-tight text-sm select-none border-r border-b border-gray-300"
                  >
                    {formatSessionDateWithDay(session.dateStr, session.dateKey)}
                  </th>
                  <th
                    colSpan={7}
                    className="bg-white border-r border-b border-gray-300"
                  />
                </tr>

                {/* Row 2: Column Headers */}
                <tr>
                  {columnHeaders.map((col) => (
                    <th
                      key={col.key}
                      className={`${col.bg} ${col.width} text-gray-900 font-bold py-2.5 px-2 text-center tracking-tight text-sm select-none border-r border-b border-gray-300`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Row 3: '참여인원' Summary Row */}
                <tr className="bg-[#f1f5f9] font-medium text-gray-700">
                  <td className="bg-[#e2e8f0] text-center font-bold py-2 px-2.5 text-gray-900 select-none border-r border-b border-gray-300">
                    참여인원
                  </td>
                  <td className="py-2 px-1.5 text-center text-xs leading-snug break-keep border-r border-b border-gray-300">
                    {getAssignedMembersForPart(session, 'vocal').join(', ') || '-'}
                  </td>
                  <td className="py-2 px-1.5 text-center text-xs leading-snug break-keep border-r border-b border-gray-300">
                    {getAssignedMembersForPart(session, 'guitar1').join(', ') || '-'}
                  </td>
                  <td className="py-2 px-1.5 text-center text-xs leading-snug break-keep border-r border-b border-gray-300">
                    {getAssignedMembersForPart(session, 'guitar2').join(', ') || '-'}
                  </td>
                  <td className="py-2 px-1.5 text-center text-xs leading-snug break-keep border-r border-b border-gray-300">
                    {getAssignedMembersForPart(session, 'bass').join(', ') || '-'}
                  </td>
                  <td className="py-2 px-1.5 text-center text-xs leading-snug break-keep border-r border-b border-gray-300">
                    {getAssignedMembersForPart(session, 'drum').join(', ') || '-'}
                  </td>
                  <td className="py-2 px-1.5 text-center text-xs leading-snug break-keep border-r border-b border-gray-300">
                    {getAssignedMembersForPart(session, 'keyboard').join(', ') || '-'}
                  </td>
                  <td className="py-2 px-1.5 text-center text-xs text-gray-400 border-r border-b border-gray-300">
                    -
                  </td>
                </tr>

                {/* Song Rows */}
                {session.songs && session.songs.map((song, index) => (
                  <tr key={song.id} className="border-b border-gray-300">
                    <td className="bg-[#fef9c3] font-bold py-2.5 px-3 border-r border-b border-gray-300 text-gray-900 leading-snug">
                      <div>
                        {index + 1}. {song.title}
                      </div>
                      {song.artist && (
                        <div className="text-xs text-gray-600 font-normal mt-0.5">
                          - {song.artist}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-1.5 text-center text-xs font-medium text-gray-900 border-r border-b border-gray-300">
                      {song.vocal.join(', ') || ''}
                    </td>
                    <td className="py-2.5 px-1.5 text-center text-xs font-medium text-gray-900 border-r border-b border-gray-300">
                      {song.guitar1.join(', ') || ''}
                    </td>
                    <td className="py-2.5 px-1.5 text-center text-xs font-medium text-gray-900 border-r border-b border-gray-300">
                      {song.guitar2.join(', ') || ''}
                    </td>
                    <td className="py-2.5 px-1.5 text-center text-xs font-medium text-gray-900 border-r border-b border-gray-300">
                      {song.bass.join(', ') || ''}
                    </td>
                    <td className="py-2.5 px-1.5 text-center text-xs font-medium text-gray-900 border-r border-b border-gray-300">
                      {song.drum.join(', ') || ''}
                    </td>
                    <td className="py-2.5 px-1.5 text-center text-xs font-medium text-gray-900 border-r border-b border-gray-300">
                      {song.keyboard.join(', ') || ''}
                    </td>
                    <td className="py-2.5 px-2 text-center text-xs text-gray-700 border-r border-b border-gray-300">
                      {song.notes ? (
                        <span className="text-[#be123c] font-medium">{song.notes}</span>
                      ) : (
                        ''
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Song Information Modal (Title, Artist, Notes with Parts Preserved) */}
      <EditSongModal
        isOpen={Boolean(songToEdit)}
        song={songToEdit}
        onClose={() => setSongToEdit(null)}
        onSave={(songId, title, artist, notes) => {
          handleSaveSongEdit(songId, title, artist, notes);
          setSongToEdit(null);
        }}
      />

      {/* Delete Confirmation In-App Modal (replaces browser confirm) */}
      {songToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm overflow-hidden p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900">
                  합주 곡 삭제 확인
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  현재 합주(<strong>{session.dateStr}</strong>)에서 아래 곡을 삭제하시겠습니까?
                </p>
                <div className="mt-2.5 p-2 bg-gray-50 border border-gray-200 rounded text-xs font-semibold text-gray-800 truncate">
                  {songToDelete.title} - {songToDelete.artist}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  * 과거 다른 합주 회차의 기록은 보존됩니다.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSongToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-medium bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
