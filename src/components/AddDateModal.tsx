import React, { useState } from 'react';
import { X, CalendarPlus, CopyCheck } from 'lucide-react';
import { RehearsalSession } from '../types';

interface AddDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastSession: RehearsalSession;
  onAddSession: (newDateStr: string, newDateKey: string, copyFromPrevious: boolean) => void;
}

export const AddDateModal: React.FC<AddDateModalProps> = ({
  isOpen,
  onClose,
  lastSession,
  onAddSession,
}) => {
  if (!isOpen) return null;

  // Compute a default date: roughly 2 weeks after last session date or today
  const defaultDateStr = '2026년 8월 15일';
  const defaultDateKey = '2026-08-15';

  const [dateStr, setDateStr] = useState(defaultDateStr);
  const [dateKey, setDateKey] = useState(defaultDateKey);
  const [copyPrevious, setCopyPrevious] = useState(true);

  const handleDateKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDateKey(val);
    if (val) {
      const [y, m, d] = val.split('-');
      if (y && m && d) {
        setDateStr(`${y}년 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateStr.trim()) return;
    onAddSession(dateStr.trim(), dateKey, copyPrevious);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl border border-[#dadce0] w-full max-w-md max-h-[85dvh] sm:max-h-[88vh] flex flex-col overflow-hidden"
      >
        <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-[#dadce0] flex items-center justify-between bg-[#f8f9fa]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
              <CalendarPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#202124]">새 합주 일자 추가</h3>
              <p className="text-[11px] text-[#5f6368]">
                새로운 합주 일자 시트를 생성합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5f6368] hover:text-[#202124] p-1 rounded hover:bg-gray-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
          <div>
            <label className="block text-xs font-semibold text-[#3c4043] mb-1">
              달력으로 날짜 선택
            </label>
            <input
              type="date"
              value={dateKey}
              onChange={handleDateKeyChange}
              className="w-full text-xs py-2 px-3 border border-[#dadce0] rounded text-[#202124] focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3c4043] mb-1">
              시트에 표시될 날짜 표기 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              placeholder="예: 2026년 8월 15일"
              className="w-full text-xs py-2 px-3 border border-[#dadce0] rounded text-[#202124] focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          {/* Automatic Carry-over Checkbox */}
          <div className="p-3 bg-[#e8f0fe] rounded border border-blue-200">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={copyPrevious}
                onChange={(e) => setCopyPrevious(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <div>
                <span className="text-xs font-semibold text-[#1a73e8] flex items-center gap-1">
                  <CopyCheck className="w-3.5 h-3.5" />
                  직전 합주 곡 & 파트 배정 자동 복사 (이월)
                </span>
                <p className="text-[11px] text-[#3c4043] mt-0.5 leading-snug">
                  직전 회차({lastSession?.dateStr || '이전 합주'})의 {lastSession?.songs.length || 0}개 곡과
                  배정된 멤버들을 새 합주 표에 그대로 복사합니다.
                </p>
              </div>
            </label>
          </div>

          <div className="pt-2 border-t border-[#dadce0] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium bg-white hover:bg-gray-100 border border-[#dadce0] text-[#3c4043] rounded transition"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>새 합주일 생성</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
