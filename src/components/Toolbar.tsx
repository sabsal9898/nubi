import React from 'react';
import {
  Calendar,
  Plus,
  ChevronDown,
  Trash2,
  ListMusic,
} from 'lucide-react';
import { RehearsalSession } from '../types';
import { sortSessionsDescending, formatSessionDateCompact } from '../utils/sheetUtils';

interface ToolbarProps {
  sessions: RehearsalSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onOpenAddDateModal: () => void;
  onOpenAllSongsModal?: () => void;
  onRequestDeleteSession: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onOpenAddDateModal,
  onOpenAllSongsModal,
  onRequestDeleteSession,
}) => {
  // Sort sessions with latest date first
  const sortedSessions = sortSessionsDescending(sessions);

  // Button: + 합주일 추가 (모바일에서는 아이콘만 표시)
  const AddDateBtn = (
    <button
      type="button"
      onClick={onOpenAddDateModal}
      title="합주일 추가"
      className="inline-flex items-center justify-center gap-1 px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-2xs transition active:scale-98 shrink-0 cursor-pointer whitespace-nowrap"
    >
      <Plus className="w-3.5 h-3.5 text-gray-600" />
      <span className="hidden sm:inline">합주일 추가</span>
    </button>
  );

  // Button: 합주일 삭제 (모바일에서는 아이콘만 표시)
  const DeleteDateBtn = (
    <button
      type="button"
      onClick={onRequestDeleteSession}
      title="현재 보고 있는 합주일 삭제"
      className="inline-flex items-center justify-center gap-1 px-1.5 py-1 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200 rounded-lg shadow-2xs transition active:scale-98 shrink-0 cursor-pointer whitespace-nowrap"
    >
      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
      <span className="hidden sm:inline">합주일 삭제</span>
    </button>
  );

  // 합주일 선택 토글/드롭다운 (📅 합주일 | 2026-11-26(목) ▼ - 캡슐 스타일 통합)
  const DateSelectDropdown = (
    <div
      className="h-[29px] flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100/90 px-2.5 rounded-lg border border-gray-300 transition shrink-0 shadow-2xs"
    >
      <Calendar className="w-3.5 h-3.5 text-gray-600 shrink-0" />
      <span className="text-[12px] text-gray-700 font-medium whitespace-nowrap shrink-0">
        합주일
      </span>
      <span className="text-gray-300 font-normal select-none">|</span>
      <div className="relative flex items-center">
        <select
          value={activeSessionId}
          onChange={(e) => onSelectSession(e.target.value)}
          aria-label="합주 일자 선택"
          className="appearance-none bg-transparent pr-4 text-[12px] font-semibold text-gray-900 focus:outline-none cursor-pointer tracking-tight whitespace-nowrap"
        >
          {sortedSessions.map((sess) => (
            <option key={sess.id} value={sess.id}>
              {formatSessionDateCompact(sess.dateStr, sess.dateKey)}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3 h-3 text-gray-500 absolute right-0 pointer-events-none" />
      </div>
    </div>
  );

  // Button: 전체 합주곡 목록
  const AllSongsBtn = onOpenAllSongsModal ? (
    <button
      type="button"
      onClick={onOpenAllSongsModal}
      className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition active:scale-98 cursor-pointer shrink-0 whitespace-nowrap"
      title="등록된 모든 합주곡 목록 및 파트 배정 현황 보기"
    >
      <ListMusic className="w-3.5 h-3.5 text-slate-600 shrink-0" />
      <span className="hidden sm:inline">누적 합주곡 현황</span>
      <span className="sm:hidden">누적 현황</span>
    </button>
  ) : null;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-2xs select-none">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-4 sm:pb-5">
        {/* [1번째 줄] 메인 타이틀 영역 (화면 가로 중앙 정렬) */}
        <div className="w-full flex justify-center items-center text-center mb-[20px]">
          <h1
            className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight leading-none text-center"
            style={{ fontFamily: 'monospace' }}
          >
            🎵 누비밴드 합주곡 셋리스트 🎵
          </h1>
        </div>

        {/* [2번째 줄] 합주일 관리 & 전체 목록 통합 컨트롤 바 */}
        <div className="w-full flex justify-between items-center gap-1.5 sm:gap-2">
          {/* 좌측 그룹: [📅 합주일 | 토글] + [+] 추가 + [🗑️] 삭제 밀착 */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {DateSelectDropdown}
            {AddDateBtn}
            {DeleteDateBtn}
          </div>

          {/* 우측 그룹: 구분선 (Divider) + [🎶 전체 목록] */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="h-3.5 sm:h-4 w-px bg-gray-200 shrink-0" />
            {AllSongsBtn}
          </div>
        </div>
      </div>
    </header>
  );
};
