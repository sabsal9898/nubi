import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, ListMusic, Calendar, Users, Music2, RotateCcw } from 'lucide-react';
import { RehearsalSession, PartType } from '../types';
import {
  PART_LABELS,
  PART_KEYS,
  formatSessionDateWithDay,
  getSessionDateTimestamp,
  sortSessionsDescending,
} from '../utils/sheetUtils';

interface AllSongsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: RehearsalSession[];
}

export interface AggregatedSong {
  id: string;
  title: string;
  artist: string;
  vocal: string[];
  guitar1: string[];
  guitar2: string[];
  bass: string[];
  drum: string[];
  keyboard: string[];
  notes: string[];
  sessionDates: Array<{
    sessionId: string;
    dateLabel: string;
    dateKey: string;
    timestamp: number;
  }>;
  latestTimestamp: number;
  playCount: number;
}

/**
 * Formats an array of session dates into dateRange (e.g. '26/10~26/11' or '26/11')
 * and countLabel (e.g. '(2회)' or '(1회)'), with full date details for tooltip.
 */
function formatSessionDateRange(
  sessionDates: Array<{ sessionId: string; dateLabel: string; dateKey: string; timestamp: number }>
): { dateRange: string; countLabel: string; fullDates: string } {
  if (!sessionDates || sessionDates.length === 0) {
    return { dateRange: '-', countLabel: '', fullDates: '' };
  }

  const sorted = [...sessionDates].sort((a, b) => a.timestamp - b.timestamp);
  const fullDates = sorted.map((s) => s.dateLabel || s.dateKey).join(', ');

  const parseYYMM = (item: { dateKey?: string; dateLabel?: string; timestamp?: number }): string => {
    // 1. From dateKey (e.g. '2026-10-22')
    if (item.dateKey) {
      const match = item.dateKey.match(/^(\d{4})-(\d{1,2})/);
      if (match) {
        const yy = match[1].slice(-2);
        const mm = match[2].padStart(2, '0');
        return `${yy}/${mm}`;
      }
    }
    // 2. From dateLabel (e.g. '2026년 10월 22일...')
    if (item.dateLabel) {
      const match = item.dateLabel.match(/(\d{4})[^\d]+(\d{1,2})/);
      if (match) {
        const yy = match[1].slice(-2);
        const mm = match[2].padStart(2, '0');
        return `${yy}/${mm}`;
      }
    }
    // 3. From timestamp fallback
    if (item.timestamp && !isNaN(item.timestamp) && item.timestamp > 0) {
      const d = new Date(item.timestamp);
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${yy}/${mm}`;
    }
    return '';
  };

  const startYYMM = parseYYMM(sorted[0]);
  const endYYMM = parseYYMM(sorted[sorted.length - 1]);
  const count = sorted.length;
  const countLabel = `(${count}회)`;

  if (!startYYMM && !endYYMM) {
    return { dateRange: `${count}회`, countLabel: '', fullDates };
  }

  if (count === 1 || startYYMM === endYYMM) {
    return {
      dateRange: startYYMM || endYYMM,
      countLabel,
      fullDates,
    };
  }

  return {
    dateRange: `${startYYMM}~${endYYMM}`,
    countLabel,
    fullDates,
  };
}

export const AllSongsModal: React.FC<AllSongsModalProps> = ({
  isOpen,
  onClose,
  sessions,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('all');

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Reset filters when modal is reopened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedSessionId('all');
    }
  }, [isOpen]);

  // Sorted list of all sessions descending
  const sortedSessions = useMemo(() => sortSessionsDescending(sessions), [sessions]);

  // Aggregate and merge songs across all rehearsal sessions
  const aggregatedSongs = useMemo<AggregatedSong[]>(() => {
    const map = new Map<string, AggregatedSong>();

    // Process from oldest to newest or newest to oldest; we maintain latestTimestamp
    sortedSessions.forEach((session) => {
      const sessionTimestamp = getSessionDateTimestamp(session);
      const sessionDateLabel =
        formatSessionDateWithDay(session.dateStr, session.dateKey) ||
        session.dateStr ||
        session.dateKey;

      if (!Array.isArray(session.songs)) return;

      session.songs.forEach((song) => {
        const cleanTitle = (song.title || '').trim();
        const cleanArtist = (song.artist || '').trim();
        if (!cleanTitle && !cleanArtist) return;

        // Merge key based on normalized title and artist
        const key = `${cleanTitle.toLowerCase()}:::${cleanArtist.toLowerCase()}`;

        if (!map.has(key)) {
          map.set(key, {
            id: key,
            title: cleanTitle,
            artist: cleanArtist,
            vocal: Array.isArray(song.vocal) ? [...song.vocal.map((m) => m.trim()).filter(Boolean)] : [],
            guitar1: Array.isArray(song.guitar1) ? [...song.guitar1.map((m) => m.trim()).filter(Boolean)] : [],
            guitar2: Array.isArray(song.guitar2) ? [...song.guitar2.map((m) => m.trim()).filter(Boolean)] : [],
            bass: Array.isArray(song.bass) ? [...song.bass.map((m) => m.trim()).filter(Boolean)] : [],
            drum: Array.isArray(song.drum) ? [...song.drum.map((m) => m.trim()).filter(Boolean)] : [],
            keyboard: Array.isArray(song.keyboard) ? [...song.keyboard.map((m) => m.trim()).filter(Boolean)] : [],
            notes: song.notes && song.notes.trim() ? [song.notes.trim()] : [],
            sessionDates: [
              {
                sessionId: session.id,
                dateLabel: sessionDateLabel,
                dateKey: session.dateKey,
                timestamp: sessionTimestamp,
              },
            ],
            latestTimestamp: sessionTimestamp,
            playCount: 1,
          });
        } else {
          const existing = map.get(key)!;

          // Merge part members (Union set)
          const mergeParts = (existingList: string[], newList?: string[]) => {
            if (!Array.isArray(newList)) return existingList;
            const set = new Set(existingList);
            newList.forEach((name) => {
              const trimmed = name.trim();
              if (trimmed) set.add(trimmed);
            });
            return Array.from(set);
          };

          existing.vocal = mergeParts(existing.vocal, song.vocal);
          existing.guitar1 = mergeParts(existing.guitar1, song.guitar1);
          existing.guitar2 = mergeParts(existing.guitar2, song.guitar2);
          existing.bass = mergeParts(existing.bass, song.bass);
          existing.drum = mergeParts(existing.drum, song.drum);
          existing.keyboard = mergeParts(existing.keyboard, song.keyboard);

          // Merge notes
          if (song.notes && song.notes.trim() && !existing.notes.includes(song.notes.trim())) {
            existing.notes.push(song.notes.trim());
          }

          // Add session date if not already recorded
          if (!existing.sessionDates.some((s) => s.sessionId === session.id)) {
            existing.sessionDates.push({
              sessionId: session.id,
              dateLabel: sessionDateLabel,
              dateKey: session.dateKey,
              timestamp: sessionTimestamp,
            });
            existing.playCount = existing.sessionDates.length;
          }

          if (sessionTimestamp > existing.latestTimestamp) {
            existing.latestTimestamp = sessionTimestamp;
          }
        }
      });
    });

    // Sort songs: most recently played/registered first, then alphabetical by title
    return Array.from(map.values()).sort((a, b) => {
      const diff = b.latestTimestamp - a.latestTimestamp;
      if (diff !== 0) return diff;
      return a.title.localeCompare(b.title, 'ko-KR');
    });
  }, [sortedSessions]);

  // Filter songs by search text and session filter
  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return aggregatedSongs.filter((song) => {
      // 1. Session filter
      if (selectedSessionId !== 'all') {
        const matchesSession = song.sessionDates.some((s) => s.sessionId === selectedSessionId);
        if (!matchesSession) return false;
      }

      // 2. Search query filter
      if (!q) return true;

      const titleMatch = song.title.toLowerCase().includes(q);
      const artistMatch = song.artist.toLowerCase().includes(q);
      const notesMatch = song.notes.some((n) => n.toLowerCase().includes(q));

      const memberMatch = [
        ...song.vocal,
        ...song.guitar1,
        ...song.guitar2,
        ...song.bass,
        ...song.drum,
        ...song.keyboard,
      ].some((m) => m.toLowerCase().includes(q));

      const dateMatch = song.sessionDates.some(
        (d) => d.dateLabel.toLowerCase().includes(q) || d.dateKey.toLowerCase().includes(q)
      );

      return titleMatch || artistMatch || notesMatch || memberMatch || dateMatch;
    });
  }, [aggregatedSongs, searchQuery, selectedSessionId]);

  // Count unique total participants across filtered songs
  const totalUniqueParticipants = useMemo(() => {
    const set = new Set<string>();
    filteredSongs.forEach((song) => {
      song.vocal.forEach((m) => set.add(m));
      song.guitar1.forEach((m) => set.add(m));
      song.guitar2.forEach((m) => set.add(m));
      song.bass.forEach((m) => set.add(m));
      song.drum.forEach((m) => set.add(m));
      song.keyboard.forEach((m) => set.add(m));
    });
    return set.size;
  }, [filteredSongs]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 lg:p-6 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-6xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden relative"
      >
        {/* 1. Modal Header */}
        <div className="shrink-0 px-4 sm:px-6 py-3.5 border-b border-gray-200 bg-[#f8f9fa] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
              <ListMusic className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-gray-900">전체 합주곡 누적 현황</h3>

              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                역대 합주 회차에 등록된 모든 곡과 파트별 누적 참여 인원 현황을 조회합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Filter Bar */}
        <div className="shrink-0 px-4 sm:px-6 py-3 bg-white border-b border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="곡명, 아티스트, 멤버 검색..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50/50 hover:bg-white text-gray-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Session / Date Filter */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-500 font-medium shrink-0">회차:</span>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-900 focus:outline-none cursor-pointer pr-1"
              >
                <option value="all">전체 회차 ({aggregatedSongs.length}곡)</option>
                {sortedSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatSessionDateWithDay(s.dateStr, s.dateKey)} ({s.songs.length}곡)
                  </option>
                ))}
              </select>
            </div>

            {(searchQuery || selectedSessionId !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSessionId('all');
                }}
                title="필터 초기화"
                className="p-2 text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 3. Table Content (Scrollable) */}
        <div className="flex-1 overflow-auto bg-gray-50/40 p-2 sm:p-5">
          {filteredSongs.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-300 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
                <table className="w-full border-separate border-spacing-0 text-xs text-left">
                  <thead>
                    <tr className="bg-[#bfdbfe] text-gray-900 font-bold text-center border-b border-gray-300 select-none">
                      <th className="py-2.5 px-1 w-[38px] min-w-[38px] max-w-[38px] border-r border-b border-gray-300 text-center sticky left-0 z-20 bg-[#fed7aa]">
                        연번
                      </th>
                      <th className="py-2.5 px-2 w-[135px] min-w-[125px] sm:min-w-[135px] max-w-[160px] border-r border-b border-gray-300 text-center sticky left-[38px] z-20 bg-[#fed7aa] shadow-[3px_0_5px_-2px_rgba(0,0,0,0.12)]">
                        곡명 - 아티스트
                      </th>
                      <th className="py-2.5 px-2 min-w-[90px] border-r border-b border-gray-300">
                        {PART_LABELS.vocal}
                      </th>
                      <th className="py-2.5 px-2 min-w-[95px] border-r border-b border-gray-300">
                        {PART_LABELS.guitar1}
                      </th>
                      <th className="py-2.5 px-2 min-w-[95px] border-r border-b border-gray-300">
                        {PART_LABELS.guitar2}
                      </th>
                      <th className="py-2.5 px-2 min-w-[90px] border-r border-b border-gray-300">
                        {PART_LABELS.bass}
                      </th>
                      <th className="py-2.5 px-2 min-w-[90px] border-r border-b border-gray-300">
                        {PART_LABELS.drum}
                      </th>
                      <th className="py-2.5 px-2 min-w-[90px] border-r border-b border-gray-300">
                        {PART_LABELS.keyboard}
                      </th>
                      <th className="py-2.5 px-2 min-w-[100px] border-r border-b border-gray-300 bg-[#fecdd3]">
                        {PART_LABELS.notes}
                      </th>
                      <th className="py-2.5 px-2.5 min-w-[120px] border-b border-gray-300 bg-[#fed7aa] text-center">
                        합주기간
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSongs.map((song, idx) => {
                      const { dateRange, countLabel, fullDates } = formatSessionDateRange(song.sessionDates);

                      return (
                        <tr
                          key={song.id}
                          className="hover:bg-blue-50/30 transition-colors border-b border-gray-200 group"
                        >
                          {/* 1. 연번 (Sticky) */}
                          <td className="py-2 px-1 w-[38px] min-w-[38px] max-w-[38px] text-center font-bold text-gray-500 border-r border-b border-gray-200 bg-white group-hover:bg-[#f8fafd] sticky left-0 z-10">
                            {idx + 1}
                          </td>

                          {/* 2. 곡명 - 아티스트 (Sticky - 3/4 폭, 연번 열과 빈틈없이 밀착) */}
                          <td className="py-2 px-2 w-[135px] min-w-[125px] sm:min-w-[135px] max-w-[160px] border-r border-b border-gray-200 bg-white group-hover:bg-[#f8fafd] sticky left-[38px] z-10 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.12)]">
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-gray-900 leading-snug break-words">
                                {song.title}
                              </span>
                              <span className="text-[11px] text-gray-500 font-normal break-words">
                                - {song.artist || '아티스트 미상'}
                              </span>
                            </div>
                          </td>

                          {/* 3. 보컬 */}
                          <td className="py-2 px-1.5 text-center border-r border-b border-gray-200 text-gray-800 leading-snug break-keep">
                            {song.vocal.length > 0 ? (
                              <span className="font-medium text-gray-900">{song.vocal.join(', ')}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>

                          {/* 4. 리드 기타 */}
                          <td className="py-2 px-1.5 text-center border-r border-b border-gray-200 text-gray-800 leading-snug break-keep">
                            {song.guitar1.length > 0 ? (
                              <span className="font-medium text-gray-900">{song.guitar1.join(', ')}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>

                          {/* 5. 백킹 기타 */}
                          <td className="py-2 px-1.5 text-center border-r border-b border-gray-200 text-gray-800 leading-snug break-keep">
                            {song.guitar2.length > 0 ? (
                              <span className="font-medium text-gray-900">{song.guitar2.join(', ')}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>

                          {/* 6. 베이스 */}
                          <td className="py-2 px-1.5 text-center border-r border-b border-gray-200 text-gray-800 leading-snug break-keep">
                            {song.bass.length > 0 ? (
                              <span className="font-medium text-gray-900">{song.bass.join(', ')}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>

                          {/* 7. 드럼 */}
                          <td className="py-2 px-1.5 text-center border-r border-b border-gray-200 text-gray-800 leading-snug break-keep">
                            {song.drum.length > 0 ? (
                              <span className="font-medium text-gray-900">{song.drum.join(', ')}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>

                          {/* 8. 건반 */}
                          <td className="py-2 px-1.5 text-center border-r border-b border-gray-200 text-gray-800 leading-snug break-keep">
                            {song.keyboard.length > 0 ? (
                              <span className="font-medium text-gray-900">{song.keyboard.join(', ')}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>

                          {/* 9. 비고 */}
                          <td className="py-2 px-2 text-center border-r border-b border-gray-200 text-gray-700 text-[11px] leading-snug break-keep">
                            {song.notes.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {song.notes.map((n, i) => (
                                  <span key={i} className="text-rose-700 bg-rose-50 px-1 py-0.5 rounded text-[10px]">
                                    {n}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>

                          {/* 10. 합주일 (상하 2줄 분리: 1줄 날짜 기간, 2줄 누적 횟수) */}
                          <td className="py-2 px-2 border-b border-gray-200 text-center leading-snug">
                            <div
                              title={fullDates ? `합주일 상세:\n${fullDates}` : undefined}
                              className="inline-flex flex-col items-center justify-center cursor-help min-w-[64px]"
                            >
                              <span className="text-[11px] font-medium text-gray-800 tracking-tight leading-tight whitespace-nowrap">
                                {dateRange}
                              </span>
                              {countLabel && (
                                <span className="text-[10px] text-gray-500 leading-tight mt-0.5 whitespace-nowrap">
                                  {countLabel}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
                <Music2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-gray-800">일치하는 합주곡이 없습니다</h4>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                검색어를 변경하거나 회차 필터를 '전체 회차'로 재설정해보세요.
              </p>
              {(searchQuery || selectedSessionId !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedSessionId('all');
                  }}
                  className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>검색 필터 초기화</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 4. Modal Footer */}
        <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-gray-500">

          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
