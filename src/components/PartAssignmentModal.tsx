import React, { useState, useEffect } from 'react';
import { X, UserPlus, Plus, Edit2, Check } from 'lucide-react';
import { RehearsalSession, PartType } from '../types';
import { PART_LABELS } from '../utils/sheetUtils';
import {
  STORAGE_MEMBERS_KEY,
  loadLocalMembers,
  subscribeToBandMembers,
  atomicAddBandMember,
  atomicRemoveBandMember,
} from '../services/firestoreService';

export { STORAGE_MEMBERS_KEY };

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
  const [selectedSongId, setSelectedSongId] = useState<string>(
    initialSongId && session.songs.some((s) => s.id === initialSongId)
      ? initialSongId
      : session.songs[0]?.id || ''
  );
  const [selectedPart, setSelectedPart] = useState<PartType>(initialPart);
  const [memberName, setMemberName] = useState<string>('');

  // Quick members state synced via Firestore & localStorage
  const [quickMembers, setQuickMembers] = useState<string[]>(() => loadLocalMembers());
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Real-time synchronization of quick members from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToBandMembers((updatedMembers) => {
      if (Array.isArray(updatedMembers)) {
        setQuickMembers(updatedMembers);
      }
    });
    return () => unsubscribe();
  }, []);

  // Synchronize selected song & part when modal opens or initial props change
  useEffect(() => {
    if (isOpen) {
      const validSongId =
        initialSongId && session.songs.some((s) => s.id === initialSongId)
          ? initialSongId
          : session.songs[0]?.id || '';
      setSelectedSongId(validSongId);
      setSelectedPart(initialPart || 'vocal');
      setMemberName('');
      setQuickMembers(loadLocalMembers());
      setIsEditMode(false);
      setMemberToDelete(null);
      setToastNotice(null);
    }
  }, [isOpen, initialSongId, initialPart]);

  // Keep selectedSongId valid if songs list changes
  useEffect(() => {
    if (session.songs.length > 0 && !session.songs.some((s) => s.id === selectedSongId)) {
      setSelectedSongId(session.songs[0].id);
    }
  }, [session.songs, selectedSongId]);

  if (!isOpen) return null;

  const selectedSong = session.songs.find((s) => s.id === selectedSongId);

  const showToastNotice = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice((prev) => (prev === msg ? null : prev));
    }, 2500);
  };

  const addMemberToQuickList = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setQuickMembers((prev) => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed];
    });
    // Atomic cloud update using arrayUnion
    atomicAddBandMember(trimmed).catch((err) => {
      console.warn('Failed to add band member to Firestore:', err);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = memberName.trim();
    if (!trimmed || !selectedSongId) return;

    onAssignMember(selectedSongId, selectedPart, trimmed);
    // Auto-add new member to quick selection list if not present
    addMemberToQuickList(trimmed);
    setMemberName('');
  };

  const handleRegisterOnly = (e: React.MouseEvent) => {
    e.preventDefault();
    const trimmed = memberName.trim();
    if (!trimmed) return;
    if (quickMembers.includes(trimmed)) {
      showToastNotice(`'${trimmed}' 멤버는 이미 빠른 선택 목록에 있습니다.`);
      return;
    }
    addMemberToQuickList(trimmed);
    showToastNotice(`'${trimmed}' 멤버가 빠른 선택 목록에 등록되었습니다.`);
  };

  const handleChipClick = (name: string) => {
    setMemberName(name);
  };

  const handleRequestDelete = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setMemberToDelete(name);
  };

  const handleConfirmDelete = () => {
    if (!memberToDelete) return;
    const target = memberToDelete;
    setQuickMembers((prev) => prev.filter((m) => m !== target));
    // Atomic cloud removal using arrayRemove
    atomicRemoveBandMember(target).catch((err) => {
      console.warn('Failed to remove band member from Firestore:', err);
    });
    setMemberToDelete(null);
    showToastNotice(`'${target}' 멤버를 빠른 선택에서 삭제했습니다.`);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150"
    >
      {/* Modal Container: Flex Column with 85dvh / 88vh limit */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl border border-[#dadce0] w-full max-w-lg max-h-[85dvh] sm:max-h-[88vh] flex flex-col overflow-hidden relative"
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
                곡과 희망 파트를 선택하고 이름을 등록하세요.
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

            {/* 3. Member Name Input & Quick Chips with Edit/Delete/Add capabilities */}
            <div>
              <label className="block text-xs font-semibold text-[#3c4043] mb-1">
                3. 멤버 이름
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="예: 홍길동..."
                  className="flex-1 text-xs py-2 px-3 border border-[#dadce0] rounded-lg text-[#202124] focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleRegisterOnly}
                  disabled={!memberName.trim() || quickMembers.includes(memberName.trim())}
                  title={
                    !memberName.trim()
                      ? '멤버 이름을 입력해주세요'
                      : quickMembers.includes(memberName.trim())
                      ? '이미 빠른 선택 목록에 등록된 멤버입니다'
                      : '빠른 선택 목록에 멤버 등록'
                  }
                  className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed text-[#3c4043] text-xs font-medium rounded-lg flex items-center gap-1 border border-[#dadce0] transition shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">멤버</span> 등록
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-xs transition shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>입력</span>
                </button>
              </div>

              {/* Quick Member Selection with [편집]/[완료], Delete (X), and Restore defaults */}
              <div className="mt-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#5f6368] font-semibold">
                      빠른 선택:
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditMode(!isEditMode)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                        isEditMode
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                          : 'bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] border border-gray-200'
                      }`}
                    >
                      {isEditMode ? (
                        <>
                          <Check className="w-3 h-3 stroke-[2.5]" />
                          <span>완료</span>
                        </>
                      ) : (
                        <>
                          <Edit2 className="w-2.5 h-2.5" />
                          <span>편집</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Chips list */}
                <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
                  {quickMembers.length > 0 ? (
                    quickMembers.map((name) => (
                      <span
                        key={name}
                        onClick={() => handleChipClick(name)}
                        className={`inline-flex items-center gap-1 text-[11px] pl-2.5 pr-1.5 py-0.5 rounded-full border transition cursor-pointer select-none group ${
                          isEditMode
                            ? 'bg-amber-50 border-amber-300 text-amber-900 ring-1 ring-amber-300/50 hover:bg-amber-100'
                            : 'bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] border-gray-200'
                        }`}
                      >
                        <span className="font-medium">{name}</span>
                        <button
                          type="button"
                          onClick={(e) => handleRequestDelete(e, name)}
                          className={`p-0.5 rounded-full transition cursor-pointer ${
                            isEditMode
                              ? 'text-rose-600 hover:bg-rose-200 bg-rose-100'
                              : 'text-gray-400 hover:text-rose-600 hover:bg-gray-200'
                          }`}
                          title={`'${name}' 멤버 삭제`}
                        >
                          <X className="w-2.5 h-2.5 stroke-[2.5]" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <div className="w-full text-center py-2 text-[11px] text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                      등록된 빠른 선택 멤버가 없습니다.
                    </div>
                  )}
                </div>

                {/* Micro notice */}
                {toastNotice && (
                  <div className="mt-1.5 text-[11px] text-blue-600 font-medium animate-in fade-in duration-150 flex items-center gap-1">
                    <span>• {toastNotice}</span>
                  </div>
                )}
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

        {/* 4. Delete Confirmation In-App Modal */}
        {memberToDelete && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setMemberToDelete(null);
            }}
            className="absolute inset-0 z-60 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-xs p-5 text-center animate-in zoom-in-95 duration-150"
            >
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <X className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 mb-1.5">멤버 삭제</h4>
              <p className="text-xs text-gray-600 leading-relaxed mb-4">
                <span className="font-semibold text-gray-900">'{memberToDelete}'</span> 멤버를<br />
                빠른 선택 목록에서 삭제하시겠습니까?
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setMemberToDelete(null)}
                  className="flex-1 py-1.5 px-3 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-1.5 px-3 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition cursor-pointer"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
