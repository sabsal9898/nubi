import React, { useState } from 'react';
import { Trash2, Edit2, AlertCircle, X } from 'lucide-react';
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
}

export const SheetTable: React.FC<SheetTableProps> = ({
  session,
  onUpdateSongPart,
  onUpdateSongNotes,
  onUpdateSongTitle,
  onUpdateSongInfo,
  onDeleteSong,
  onOpenAssignModalWithSong,
}) => {
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

  return (
    <div className="w-full p-0 sm:py-4 sm:px-4 lg:px-8">
      {/* Printable / Capturable Clean White Card */}
      <div
        id="sheet-table-capture-area"
        className="bg-white border-y sm:border border-gray-200 sm:rounded-xl shadow-xs p-0 sm:p-5 w-full"
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
              {session.songs.map((song) => (
                <tr
                  key={song.id}
                  className="group hover:bg-blue-50/20 transition-colors"
                >
                  {/* Song Title & Artist Cell (Sticky Left on Mobile with Opaque White Background) - Read-only to prevent accidental touch edits */}
                  <td
                    className="sticky left-0 z-10 bg-white group-hover:bg-[#f8fafd] py-2.5 px-2.5 sm:px-3 text-left font-medium border-r border-b border-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)] select-text"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
                      <span className="font-semibold text-gray-900 leading-tight">
                        {song.title}
                      </span>
                      <span className="text-gray-500 font-normal text-[11px] sm:text-xs truncate">
                        - {song.artist}
                      </span>
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
              ))}
            </tbody>
          </table>
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
