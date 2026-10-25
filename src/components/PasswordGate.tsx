import React, { useState, useRef, useEffect } from 'react';
import { Lock, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';

interface PasswordGateProps {
  onSuccess: () => void;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password.trim() === '2290') {
      setErrorMessage('');
      onSuccess();
    } else {
      setErrorMessage('암호가 일치하지 않습니다. 다시 확인해주세요.');
      setPassword('');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4 select-none">
      <div
        className={`bg-white border border-gray-200 rounded-2xl shadow-xl p-6 sm:p-8 max-w-sm w-full flex flex-col items-center text-center transition-transform ${
          isShaking ? 'animate-shake' : 'animate-in fade-in zoom-in-95 duration-200'
        }`}
      >


        {/* Central Title */}
        <h1
          className="font-bold text-slate-800 tracking-tight leading-snug mb-2"
          style={{ fontFamily: 'monospace', fontSize: '21px' }}
        >
          🎵 누비밴드 합주곡 셋리스트 🎵
        </h1>

        <p className="text-xs sm:text-sm text-gray-500 mb-[15px]">
          안전한 데이터 보호를 위해<br />
          지정된 암호(PIN)를 입력해주세요.
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <div className="relative w-full">
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              placeholder="암호를 입력하세요"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              className={`w-full text-center tracking-widest rounded-xl border py-3 px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg text-gray-900 placeholder:text-gray-400 placeholder:tracking-normal placeholder:text-sm transition shadow-2xs ${
                errorMessage ? 'border-rose-300 bg-rose-50/30' : 'border-gray-300 bg-white'
              }`}
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-600 animate-in fade-in slide-in-from-top-1 duration-150">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full mt-1 py-3 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>ENTER</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
};
