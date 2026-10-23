import { RehearsalSession } from '../types';

export function generateStandaloneHtml(sessions: RehearsalSession[], activeId: string): string {
  const jsonSessions = JSON.stringify(sessions).replace(/<\/script>/g, '<\\/script>');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>누비밴드 합주 파트배분 매니저 (단일 파일 버전)</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- React 18 & Babel CDN -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>
  <!-- html2canvas CDN -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <!-- Pretendard Font -->
  <link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
  <style>
    body {
      font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
      background-color: #f8f9fa;
      color: #202124;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useRef } = React;

    const INITIAL_SESSIONS = ${jsonSessions};
    const ACTIVE_ID = "${activeId}";

    function App() {
      const [sessions, setSessions] = useState(() => {
        const saved = localStorage.getItem('noobi_band_sessions');
        return saved ? JSON.parse(saved) : INITIAL_SESSIONS;
      });
      const [activeSessionId, setActiveSessionId] = useState(ACTIVE_ID);
      const [toast, setToast] = useState('');

      useEffect(() => {
        localStorage.setItem('noobi_band_sessions', JSON.stringify(sessions));
      }, [sessions]);

      const currentSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

      const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
      };

      const handleCapture = async () => {
        const el = document.getElementById('sheet-canvas');
        if (!el || !window.html2canvas) return;
        try {
          const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
          const link = document.createElement('a');
          link.download = \`누비밴드_파트배분_\${currentSession.dateKey || '배정표'}.png\`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          showToast('📷 배정표 이미지가 성공적으로 저장되었습니다!');
        } catch (e) {
          alert('이미지 저장 중 오류가 발생했습니다.');
        }
      };

      const handleCopyNotice = () => {
        let text = \`🎸 [누비밴드 \${currentSession.dateStr} 합주 선곡 & 파트 배정표] 🥁\\n\\n\`;
        currentSession.songs.forEach((s, i) => {
          text += \`\${i+1}. \${s.title} - \${s.artist}\\n\`;
          const parts = [];
          if (s.vocal?.length) parts.push(\`[보컬] \${s.vocal.join(', ')}\`);
          if (s.guitar1?.length) parts.push(\`[기타1] \${s.guitar1.join(', ')}\`);
          if (s.guitar2?.length) parts.push(\`[기타2] \${s.guitar2.join(', ')}\`);
          if (s.bass?.length) parts.push(\`[베이스] \${s.bass.join(', ')}\`);
          if (s.drum?.length) parts.push(\`[드럼] \${s.drum.join(', ')}\`);
          if (s.keyboard?.length) parts.push(\`[건반] \${s.keyboard.join(', ')}\`);
          if (s.notes) parts.push(\`[비고] \${s.notes}\`);
          text += \`   \${parts.join(' | ') || '(미정)'}\\n\`;
        });
        navigator.clipboard.writeText(text);
        showToast('📋 카카오톡 공지 문구가 복사되었습니다!');
      };

      return (
        <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
          {/* Top Google Sheets bar */}
          <div className="bg-white border-b border-gray-300 px-4 py-2 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8 text-[#0F9D58]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h10v2H7zm0 4h10v2H7zm0 4h7v2H7z"/>
              </svg>
              <div>
                <h1 className="text-base font-semibold text-gray-800">누비밴드 합주 파트배분 매니저 (단일 파일)</h1>
                <p className="text-xs text-gray-500">Google Sheets Style Band Scheduler</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleCapture} className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded transition shadow-sm">
                📷 배정표 이미지 저장(PNG)
              </button>
              <button onClick={handleCopyNotice} className="px-3 py-1.5 text-xs font-medium bg-amber-400 hover:bg-amber-500 text-amber-950 rounded transition font-semibold shadow-sm">
                📋 카톡 공지 복사
              </button>
            </div>
          </div>

          {/* Sheet Canvas */}
          <div className="flex-1 p-6 overflow-auto flex justify-center">
            <div id="sheet-canvas" className="bg-white p-8 shadow-sm border border-gray-300 rounded max-w-5xl w-full">
              <div className="text-center font-bold text-lg mb-4 text-gray-900 tracking-wide">
                {currentSession.sheetTitle || '누비 밴드 파트 배분'}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-xs sm:text-sm text-center">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 bg-[#fed7aa] text-gray-900 font-bold py-2 px-3 w-48 text-left pl-4">
                        {currentSession.dateStr}
                      </th>
                      <th colSpan="7" className="border border-gray-300 bg-white"></th>
                    </tr>
                    <tr className="bg-[#bfdbfe] text-gray-900 font-bold">
                      <th className="border border-gray-300 py-2.5 px-3">곡명 - 아티스트</th>
                      <th className="border border-gray-300 py-2.5 px-3 w-32">보컬</th>
                      <th className="border border-gray-300 py-2.5 px-3 w-28">기타1(Lead)</th>
                      <th className="border border-gray-300 py-2.5 px-3 w-28">기타2(Backing)</th>
                      <th className="border border-gray-300 py-2.5 px-3 w-24">베이스</th>
                      <th className="border border-gray-300 py-2.5 px-3 w-24">드럼</th>
                      <th className="border border-gray-300 py-2.5 px-3 w-24">건반</th>
                      <th className="border border-gray-300 py-2.5 px-3 bg-[#fecdd3] w-28">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-[#f1f5f9] font-medium text-gray-700">
                      <td className="border border-gray-300 py-2 px-3 font-semibold text-gray-800 bg-gray-200">참여인원</td>
                      {['vocal', 'guitar1', 'guitar2', 'bass', 'drum', 'keyboard', 'notes'].map(part => {
                        const set = new Set();
                        currentSession.songs.forEach(s => {
                          if (Array.isArray(s[part])) s[part].forEach(m => set.add(m));
                        });
                        if (currentSession.extraMembers?.[part]) {
                          currentSession.extraMembers[part].forEach(m => set.add(m));
                        }
                        const text = Array.from(set).join(', ');
                        return (
                          <td key={part} className="border border-gray-300 py-2 px-2 text-[11px] leading-snug">
                            {text || '-'}
                          </td>
                        );
                      })}
                    </tr>
                    {currentSession.songs.map((song, i) => (
                      <tr key={song.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="border border-gray-300 py-2 px-3 font-semibold text-gray-900 text-left">
                          {song.title} <span className="text-gray-500 font-normal">- {song.artist}</span>
                        </td>
                        <td className="border border-gray-300 py-2 px-2">{song.vocal?.join(', ') || ''}</td>
                        <td className="border border-gray-300 py-2 px-2">{song.guitar1?.join(', ') || ''}</td>
                        <td className="border border-gray-300 py-2 px-2">{song.guitar2?.join(', ') || ''}</td>
                        <td className="border border-gray-300 py-2 px-2">{song.bass?.join(', ') || ''}</td>
                        <td className="border border-gray-300 py-2 px-2">{song.drum?.join(', ') || ''}</td>
                        <td className="border border-gray-300 py-2 px-2">{song.keyboard?.join(', ') || ''}</td>
                        <td className="border border-gray-300 py-2 px-2 text-gray-500 text-xs">{song.notes || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {toast && (
            <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm z-50 animate-bounce">
              {toast}
            </div>
          )}
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>`;
}
