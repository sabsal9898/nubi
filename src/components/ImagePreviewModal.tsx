import React, { useEffect, useState } from 'react';
import { X, Download, Share2, ClipboardCopy, Check, Info } from 'lucide-react';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageDataUrl: string | null;
  fileName: string;
  dateLabel: string;
  onShowToast: (msg: string) => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen,
  onClose,
  imageDataUrl,
  fileName,
  dateLabel,
  onShowToast,
}) => {
  const [canShareFile, setCanShareFile] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Convert base64 DataURL to Blob
  const getBlob = (): Blob | null => {
    if (!imageDataUrl) return null;
    try {
      const parts = imageDataUrl.split(';base64,');
      const contentType = parts[0].split(':')[1] || 'image/png';
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      return new Blob([uInt8Array], { type: contentType });
    } catch (e) {
      console.warn('Failed to convert dataUrl to blob', e);
      return null;
    }
  };

  // Check if Web Share API with files is supported
  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const dummyFile = new File(['dummy'], 'test.png', { type: 'image/png' });
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [dummyFile] })) {
          setCanShareFile(true);
          return;
        }
      } catch {
        // ignore
      }
      // Basic share supported
      setCanShareFile(true);
    } else {
      setCanShareFile(false);
    }
  }, []);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !imageDataUrl) return null;

  // 1. Direct Download
  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = imageDataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onShowToast(`📷 '${fileName}' 파일이 다운로드되었습니다.`);
    } catch (err) {
      console.error('Download error:', err);
      onShowToast('이미지 다운로드 실패: 이미지를 길게 눌러 저장해주세요.');
    }
  };

  // 2. Web Share API (KakaoTalk, Band, etc.)
  const handleShare = async () => {
    const blob = getBlob();
    if (!blob) return;

    try {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `누비밴드 합주 배정표 (${dateLabel})`,
          text: `🎸 누비밴드 ${dateLabel} 합주 선곡 & 파트 배정표입니다.`,
          files: [file],
        });
        onShowToast('공유 창이 열렸습니다.');
        return;
      }

      // Fallback share without file if file sharing rejected
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: `누비밴드 합주 배정표 (${dateLabel})`,
          text: `🎸 누비밴드 ${dateLabel} 합주 선곡 & 파트 배정표입니다.`,
        });
        onShowToast('공유 창이 열렸습니다.');
      }
    } catch (err) {
      // User cancelled share or not allowed
      if ((err as Error).name !== 'AbortError') {
        console.warn('Share error:', err);
        handleDownload();
      }
    }
  };

  // 3. Clipboard copy re-attempt
  const handleCopyClipboard = async () => {
    const blob = getBlob();
    if (!blob) return;

    setIsCopying(true);
    try {
      if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        onShowToast('📋 이미지가 클립보드에 복사되었습니다! 카톡에 바로 붙여넣기(Ctrl+V)하세요.');
      } else {
        throw new Error('Clipboard API not supported');
      }
    } catch (err) {
      console.warn('Clipboard re-copy failed:', err);
      onShowToast('클립보드 접근이 제한되었습니다. 아래 이미지를 1초간 길게 눌러 [복사]하세요.');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden relative"
      >
        {/* Header */}
        <div className="shrink-0 px-4 sm:px-5 py-3.5 border-b border-gray-200 bg-[#f8f9fa] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-gray-900 flex items-center gap-1.5">
              <span>🖼️</span> 배정표 이미지 생성 완료
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {dateLabel} 합주 선곡 & 파트 배정표
            </p>
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

        {/* Notice Banner */}
        <div className="shrink-0 bg-blue-50/90 border-b border-blue-100 px-4 py-2.5 text-xs text-blue-900 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold">스마트폰/모바일 안내:</span> 아래 이미지를{' '}
            <strong className="text-blue-700 underline underline-offset-2">1초간 길게 누르면</strong>{' '}
            브라우저 메뉴에서 바로 <span className="font-bold text-blue-800">[사진 앱에 저장]</span> 또는{' '}
            <span className="font-bold text-blue-800">[복사]</span>할 수 있습니다.
          </div>
        </div>

        {/* Scrollable Image Area with Touch/Long-Press support */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-gray-100 flex items-center justify-center">
          <div className="w-full bg-white rounded-xl p-1.5 sm:p-2.5 shadow-sm border border-gray-200 flex items-center justify-center">
            <img
              src={imageDataUrl}
              alt="누비밴드 합주 배정표"
              className="max-w-full h-auto rounded-lg select-auto touch-auto cursor-pointer border border-gray-100"
              style={{
                WebkitTouchCallout: 'default',
                userSelect: 'auto',
              }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-gray-200 bg-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Share via Kakao/Band button if supported */}
            {canShareFile && (
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-xs transition cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>카톡/앱으로 공유</span>
              </button>
            )}

            {/* Direct download */}
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>파일 저장</span>
            </button>

            {/* Re-attempt clipboard copy */}
            <button
              type="button"
              onClick={handleCopyClipboard}
              disabled={isCopying}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 border border-gray-300 rounded-lg transition cursor-pointer"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">복사 완료!</span>
                </>
              ) : (
                <>
                  <ClipboardCopy className="w-3.5 h-3.5 text-gray-600" />
                  <span>클립보드 복사</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition cursor-pointer ml-auto"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
