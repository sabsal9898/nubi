import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Plus,
  UserCheck,
  Camera,
  ClipboardCopy,
  Download,
  Loader2,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { RehearsalSession } from '../types';
import { sortSessionsDescending } from '../utils/sheetUtils';

interface ToolbarProps {
  sessions: RehearsalSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onOpenAddDateModal: () => void;
  onOpenAddSongModal: () => void;
  onOpenAssignModal: () => void;
  onCaptureImage: () => void;
  onCopyImageToClipboard: () => void;
  onRequestDeleteSession: () => void;
  isCapturing: boolean;
  isCopyingImage: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onOpenAddDateModal,
  onOpenAddSongModal,
  onOpenAssignModal,
  onCaptureImage,
  onCopyImageToClipboard,
  onRequestDeleteSession,
  isCapturing,
  isCopyingImage,
}) => {
  // Sort sessions with latest date first
  const sortedSessions = sortSessionsDescending(sessions);

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

  // Button: + 합주일 추가
  const AddDateBtn = (
    <button
      type="button"
      onClick={onOpenAddDateModal}
      className="inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-2xs transition active:scale-98 shrink-0 cursor-pointer"
    >
      <Plus className="w-3.5 h-3.5 text-gray-500" />
      <span>합주일 추가</span>
    </button>
  );

  // Button: 합주일 삭제
  const DeleteDateBtn = (
    <button
      type="button"
      onClick={onRequestDeleteSession}
      title="현재 보고 있는 합주일 삭제"
      className="inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200 rounded-lg shadow-2xs transition active:scale-98 shrink-0 cursor-pointer"
    >
      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
      <span>합주일 삭제</span>
    </button>
  );

  // 1. 합주일 관리 3종 세트 (선택 토글 + 추가 + 삭제)
  const DateManagementGroup = (
    <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
      {/* 1) 합주일 선택 토글/드롭다운 */}
      <div className="flex items-center gap-1 bg-gray-50 hover:bg-gray-100/80 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border border-gray-200 transition shrink-0">
        <Calendar className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <span className="hidden sm:inline text-xs font-medium text-gray-500 shrink-0">회차:</span>
        <div className="relative flex items-center">
          <select
            value={activeSessionId}
            onChange={(e) => onSelectSession(e.target.value)}
            aria-label="합주 회차 선택"
            className="appearance-none bg-transparent pr-3.5 text-xs font-semibold text-gray-900 focus:outline-none cursor-pointer"
          >
            {sortedSessions.map((sess) => (
              <option key={sess.id} value={sess.id}>
                {sess.dateStr}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-gray-400 absolute right-0 pointer-events-none" />
        </div>
      </div>

      {/* 2) + 합주일 추가 */}
      {AddDateBtn}

      {/* 3) 합주일 삭제 */}
      {DeleteDateBtn}
    </div>
  );

  // Button: + 곡 추가
  const AddSongBtn = (
    <button
      type="button"
      onClick={onOpenAddSongModal}
      className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-2xs transition active:scale-98 shrink-0 cursor-pointer"
    >
      <Plus className="w-3.5 h-3.5 text-gray-500" />
      <span>곡 추가</span>
    </button>
  );

  // Button: 파트 선택
  const AssignPartBtn = (
    <button
      type="button"
      onClick={onOpenAssignModal}
      className="inline-flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition active:scale-98 shrink-0 cursor-pointer"
    >
      <UserCheck className="w-3.5 h-3.5" />
      <span>파트 선택</span>
    </button>
  );

  const isBusy = isCapturing || isCopyingImage;

  // Unified Image Action Dropdown Popover (카메라 아이콘 통합 버튼)
  const ShareDropdown = (
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
              onCaptureImage();
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
              onCopyImageToClipboard();
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
  );

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-2xs select-none">
      <div className="w-full px-3 sm:px-6 lg:px-8 py-2.5 md:py-0 md:h-15">
        {/* ======================================================== */}
        {/* 1. DESKTOP & TABLET VIEW (md and above): Single-row layout */}
        {/* ======================================================== */}
        <div className="hidden md:flex items-center justify-between h-15 gap-4">
          {/* Header Left: Brand Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-2xs">
              N
            </div>
            <div>
              <h1 className="text-base lg:text-lg font-bold text-gray-900 tracking-tight leading-none">
                누비 밴드 파트 배분
              </h1>
              <span className="text-[11px] text-gray-500 font-normal">
                Noobi Band Practice Part Manager
              </span>
            </div>
          </div>

          {/* Header Right: [합주일 관리 3종 세트] | [곡/파트 버튼] | [사진 드롭다운] */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 합주일 관리 3종 세트: [합주일 선택 토글] [+ 합주일 추가] [합주일 삭제] */}
            {DateManagementGroup}

            <div className="h-4 w-px bg-gray-200 mx-1" />

            {/* Song & Part Buttons */}
            <div className="flex items-center gap-1.5">
              {AddSongBtn}
              {AssignPartBtn}
            </div>

            <div className="h-4 w-px bg-gray-200 mx-0.5" />

            {/* Unified Photo Action Dropdown */}
            {ShareDropdown}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. MOBILE VIEW (< md): Clean layout, no horizontal scroll */}
        {/* ======================================================== */}
        <div className="flex flex-col md:hidden w-full gap-2">
          {/* Top Line: Brand Title */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              N
            </div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight leading-none">
              누비 밴드 파트 배분
            </h1>
          </div>

          {/* [1번째 줄]: 타이틀 바로 아래 줄에 [합주일 관리 3종 세트] 왼쪽 정렬 */}
          <div className="flex items-center justify-start w-full">
            {DateManagementGroup}
          </div>

          {/* [2번째 줄]: 곡/파트 액션 (좌) 및 통합 사진 드롭다운 (우) 양 끝 분할 정렬 */}
          <div className="flex justify-between items-center w-full pt-1.5 border-t border-gray-100">
            {/* 좌측 그룹: [+ 곡 추가], [파트 선택] */}
            <div className="flex items-center gap-1.5">
              {AddSongBtn}
              {AssignPartBtn}
            </div>

            {/* 우측 그룹: 통합 사진 드롭다운 (📷 ▾) */}
            <div>
              {ShareDropdown}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
