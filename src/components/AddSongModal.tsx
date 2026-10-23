import React, { useState } from 'react';
import { X, Music2, Plus } from 'lucide-react';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSong: (title: string, artist: string, notes: string) => void;
}

const SONG_PRESETS = [
  { title: 'Hysteria', artist: 'Muse' },
  { title: 'Are You Gonna Be My Girl', artist: 'Jet' },
  { title: 'Creep', artist: 'Radiohead' },
  { title: '담배가게 아가씨', artist: '송창식/YB' },
  { title: '뜨거운 여름밤은 가고 남은 건 볼품없지만', artist: '잔나비' },
  { title: '사건의 지평선', artist: '윤하' },
  { title: '고민중독', artist: 'QWER' },
  { title: '한 페이지가 될 수 있게', artist: 'DAY6' },
];

export const AddSongModal: React.FC<AddSongModalProps> = ({
  isOpen,
  onClose,
  onAddSong,
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) return;
    onAddSong(title.trim(), artist.trim(), notes.trim());
    setTitle('');
    setArtist('');
    setNotes('');
    onClose();
  };

  const handleSelectPreset = (preset: { title: string; artist: string }) => {
    setTitle(preset.title);
    setArtist(preset.artist);
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
            <div className="w-7 h-7 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
              <Music2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#202124]">합주 곡 추가</h3>
              <p className="text-[11px] text-[#5f6368]">
                현재 합주 표의 맨 위 첫 번째 행에 새 곡을 추가합니다.
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 overscroll-contain">
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
              className="w-full text-xs py-2 px-3 border border-[#dadce0] rounded text-[#202124] focus:outline-none focus:border-blue-500 font-medium"
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
              className="w-full text-xs py-2 px-3 border border-[#dadce0] rounded text-[#202124] focus:outline-none focus:border-blue-500"
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
              className="w-full text-xs py-2 px-3 border border-[#dadce0] rounded text-[#202124] focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Preset Suggestions */}
          <div className="pt-2">
            <span className="text-[11px] text-[#5f6368] font-medium block mb-1">
              밴드 추천 선곡 프리셋:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SONG_PRESETS.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className="text-[11px] px-2 py-0.5 bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] rounded border border-gray-200 transition"
                >
                  {p.title} ({p.artist})
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[#dadce0] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium bg-white hover:bg-gray-100 border border-[#dadce0] text-[#3c4043] rounded transition"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>곡 추가하기</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
