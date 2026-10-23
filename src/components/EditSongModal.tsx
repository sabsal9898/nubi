import React, { useState, useEffect } from 'react';
import { X, Edit3, Music2, Check } from 'lucide-react';
import { Song } from '../types';

interface EditSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  onSave: (songId: string, title: string, artist: string, notes: string) => void;
}

export const EditSongModal: React.FC<EditSongModalProps> = ({
  isOpen,
  onClose,
  song,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [notes, setNotes] = useState('');

  // Sync inputs whenever the target song changes or modal opens
  useEffect(() => {
    if (song) {
      setTitle(song.title || '');
      setArtist(song.artist || '');
      setNotes(song.notes || '');
    }
  }, [song, isOpen]);

  if (!isOpen || !song) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) return;

    onSave(song.id, title.trim(), artist.trim(), notes.trim());
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-xl border border-[#dadce0] w-full max-w-md max-h-[90dvh] sm:max-h-[88vh] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-[#dadce0] flex items-center justify-between bg-[#f8f9fa]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#202124]">곡 정보 수정</h3>
              <p className="text-[11px] text-[#5f6368]">
                곡명, 아티스트, 비고를 수정합니다. (기존 파트원 배정은 유지됩니다)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5f6368] hover:text-[#202124] p-1 rounded-lg hover:bg-gray-200 transition cursor-pointer"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
          <div>
            <label className="block text-xs font-semibold text-[#3c4043] mb-1">
              곡명 (Title) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: Disco yes, 사랑받고 싶어라..."
              className="w-full text-xs py-2 px-3 border border-[#dadce0] rounded-lg text-[#202124] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3c4043] mb-1">
              아티스트 (Artist) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="예: Tom Misch, 박소은, Muse..."
              className="w-full text-xs py-2 px-3 border border-[#dadce0] rounded-lg text-[#202124] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3c4043] mb-1">
              비고 (Notes - 옵션)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: Eb key 조옮김, 1절 코러스 생략 등"
              className="w-full text-xs py-2 px-3 border border-[#dadce0] rounded-lg text-[#202124] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-700"
            />
          </div>

          <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-2.5 text-[11px] text-blue-800 leading-relaxed">
            <span className="font-semibold">안내:</span> 곡명이나 아티스트 정보를 수정하더라도 이미 배정된 보컬, 기타, 베이스, 드럼, 건반 멤버 목록은 유실되지 않고 안전하게 보존됩니다.
          </div>

          {/* Modal Footer */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#3c4043] hover:bg-[#f1f3f4] border border-[#dadce0] rounded-lg transition cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !artist.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>수정 완료</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
