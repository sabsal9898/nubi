import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { RehearsalSession, PartType } from '../types';
import { PART_LABELS } from '../utils/sheetUtils';
import { KNOWN_MEMBERS } from '../constants/defaultData';

interface PartAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: RehearsalSession;
  initialSongId?: string;
  initialPart?: PartType;
  onAssignMember: (songId: string, part: PartType, memberName: string) => void;
  onRemoveMember: (songId: string, part: PartType, memberName: string) => void;
  onClearPart: (songId: string, part: PartType) => void;
}

export const PartAssignmentModal: React.FC<PartAssignmentModalProps> = ({
  isOpen,
  onClose,
  session,
  initialSongId,
  initialPart = 'vocal',
  onAssignMember,
  onRemoveMember,
}) => {
  if (!isOpen) return null;

  const [selectedSongId, setSelectedSongId] = useState<string>(
    initialSongId && session.songs.some((s) => s.id === initialSongId)
      ? initialSongId
      : session.songs[0]?.id || ''
  );
  const [selectedPart, setSelectedPart] = useState<PartType>(initialPart);
  const [memberName, setMemberName] = useState<string>('');

  const selectedSong = session.songs.find((s) => s.id === selectedSongId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = memberName.trim();
    if (!trimmed || !selectedSongId) return;

    onAssignMember(selectedSongId, selectedPart, trimmed);
    setMemberName('');
  };

  const handleChipClick = (name: string) => {
    setMemberName(name);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150"
    >
      {/* Modal Container: Flex Column with 85dvh / 88vh limit */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl border border-[#dadce0] w-full max-w-lg max-h-[85dvh] sm:max-h-[88vh] flex flex-col overflow-hidden"
      >
        {/* 1. Modal Header (Pinned at Top) */}
        <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-[#dadce0] flex items-center justify-between bg-[#f8f9fa]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
              선택
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#202124]">파트 선택 / 신청</h3>
              <p className="text-[11px] text-[#5f6368]">
                곡과 희망 파트를 선택하고 이름을 등록하세요. (한 파트 다중 인원 지원)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5f6368] hover:text-[#202124] p-1.5 rounded-lg hover:bg-gray-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Modal Body (Scrolls vertically on mobile/overflow) */}
        <div
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <form id="assign-member-form" onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Song Selection */}
            <div>
              <label className="block text-xs font-semibold text-[#3c4043] mb-1">
                1. 합주 곡 선택
              </label>
              <select
                value={selectedSongId}
                onChange={(e) => setSelectedSongId(e.target.value)}
                className="w-full text-xs py-2 px-3 border border-[#dadce0] rounded-lg bg-white text-[#202124] focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
              >
                {session.songs.map((song, idx) => (
                  <option key={song.id} value={song.id}>
                    {idx + 1}. {song.title} - {song.artist}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Part Selection */}
            <div>
              <label className="block text-xs font-semibold text-[#3c4043] mb-1.5">
                2. 희망 파트 선택
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    'vocal',
                    'guitar1',
                    'guitar2',
                    'bass',
                    'drum',
                    'keyboard',
                    'notes',
                  ] as PartType[]
                ).map((part) => {
                  const isSelected = selectedPart === part;
                  return (
                    <button
                      key={part}
                      type="button"
                      onClick={() => setSelectedPart(part)}
                      className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition text-center cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                          : 'bg-white border-[#dadce0] text-[#3c4043] hover:bg-[#f1f3f4]'
                      }`}
                    >
                      {PART_LABELS[part]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Member Name Input & Quick Chips */}
            <div>
              <label className="block text-xs font-semibold text-[#3c4043] mb-1">
                3. 멤버 이름
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="예: 윤태호, 노현일..."
                  className="flex-1 text-xs py-2 px-3 border border-[#dadce0] rounded-lg text-[#202124] focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-xs transition shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>배정/추가</span>
                </button>
              </div>

              {/* Quick Name Suggestions */}
              <div className="mt-2">
                <span className="text-[11px] text-[#5f6368] font-medium mr-1.5">
                  빠른 선택:
                </span>
                <div className="inline-flex flex-wrap gap-1 mt-1">
                  {KNOWN_MEMBERS.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleChipClick(name)}
                      className="text-[11px] px-2 py-0.5 bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] rounded-full border border-gray-200 transition cursor-pointer"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Current Song Part Assignment Live Status */}
            {selectedSong && (
              <div className="mt-4 pt-3 border-t border-[#dadce0]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#202124]">
                    현재 곡 [{selectedSong.title}] 배정 현황:
                  </span>
                  <span className="text-[11px] text-gray-500">
                    (태그의 ✕ 클릭 시 즉시 제거)
                  </span>
                </div>

                <div className="space-y-1.5">
                  {(
                    [
                      'vocal',
                      'guitar1',
                      'guitar2',
                      'bass',
                      'drum',
                      'keyboard',
                    ] as PartType[]
                  ).map((part) => {
                    const partValue = selectedSong[part];
                    const assigned: string[] = Array.isArray(partValue) ? partValue : [];
                    return (
                      <div
                        key={part}
                        className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-[#f8f9fa] rounded-lg border border-gray-100"
                      >
                        <span className="font-medium text-[#5f6368] w-24 shrink-0">
                          {PART_LABELS[part]}:
                        </span>
                        <div className="flex-1 flex flex-wrap gap-1.5 items-center justify-end">
                          {assigned.length > 0 ? (
                            assigned.map((name) => (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white border border-[#dadce0] px-2 py-0.5 rounded text-[#202124]"
                              >
                                {name}
                                <button
                                  type="button"
                                  onClick={() =>
                                    onRemoveMember(selectedSong.id, part, name)
                                  }
                                  className="text-gray-400 hover:text-rose-600 cursor-pointer"
                                  title="제거"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">
                              미배정
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {selectedSong.notes && (
                    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-rose-50/50 rounded-lg border border-rose-100">
                      <span className="font-medium text-rose-700 w-24 shrink-0">비고:</span>
                      <span className="text-xs text-[#202124]">{selectedSong.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* 3. Modal Footer (Pinned at Bottom) */}
        <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-[#dadce0] bg-white flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 rounded-lg transition cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
