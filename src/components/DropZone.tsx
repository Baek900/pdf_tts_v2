/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Upload, FileText, AlertCircle, BookOpen, Cloud, Laptop } from 'lucide-react';
import { ParseProgress } from '../types';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  onLoadSample: () => void;
  onGoogleDriveClick: () => void;
  error: string | null;
  loading: boolean;
  parseProgress?: ParseProgress | null;
}

export default function DropZone({ 
  onFileSelected, 
  onLoadSample, 
  onGoogleDriveClick, 
  error, 
  loading, 
  parseProgress 
}: DropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        onFileSelected(file);
      } else {
        alert('PDF 파일만 업로드할 수 있습니다.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelected(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-lg mx-auto" id="dropzone-root">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all p-8 md:p-12 text-center flex flex-col items-center justify-center bg-slate-900 ${
          isDragActive 
            ? 'border-amber-400 bg-amber-500/5 shadow-amber-500/10 shadow-lg' 
            : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 shadow-md'
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {loading ? (
          <div className="w-full flex flex-col items-center justify-center space-y-6 py-4 px-2 select-none" id="loader-content">
            {/* Spinning/pulsing graphic */}
            <div className="relative">
              <div className="w-16 h-16 border-4 border-slate-800 border-t-amber-500 rounded-full animate-spin mb-2" id="spinner"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-400 animate-pulse" />
              </div>
            </div>

            <div className="text-center space-y-1.5 w-full">
              <h3 className="text-lg font-semibold text-slate-100 tracking-tight">
                PDF 분석 엔진 처리 중...
              </h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                {parseProgress?.message || '문서를 분석하고 문장 단위로 파싱하고 있습니다.'}
              </p>
            </div>

            {/* Glowing progress percent display */}
            <div className="flex items-baseline justify-center space-x-1 font-mono">
              <span className="text-4xl font-extrabold text-amber-400 tracking-tighter">
                {parseProgress?.percent || 15}
              </span>
              <span className="text-sm font-semibold text-slate-500">%</span>
            </div>

            {/* Premium slider progress tracking bar */}
            <div className="w-full max-w-sm bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800 p-[2px] shadow-inner">
              <motion.div 
                className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 h-full rounded-full shadow-md shadow-amber-500/20"
                style={{ width: '0%' }}
                animate={{ width: `${parseProgress?.percent || 15}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>

            {/* Modular progress steps verification lists */}
            <div className="w-full max-w-xs bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 text-left space-y-2.5 text-xs font-medium">
              <div className="flex items-center space-x-2.5">
                <span className={`w-2 h-2 rounded-full ${(parseProgress?.percent || 15) >= 10 ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]' : 'bg-slate-700'}`} />
                <span className={`transition-colors ${(parseProgress?.percent || 15) >= 10 ? 'text-slate-200 font-semibold' : 'text-slate-500'}`}>
                  1단계: 이진 파일 스트림 검수 완료
                </span>
              </div>
              <div className="flex items-center space-x-2.5">
                <span className={`w-2 h-2 rounded-full ${(parseProgress?.percent || 15) >= 25 ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]' : 'bg-slate-700'}`} />
                <span className={`transition-colors ${(parseProgress?.percent || 15) >= 25 ? 'text-slate-200 font-semibold' : 'text-slate-500'}`}>
                  2단계: 동일 출처(Same-Origin) 보안 워커 활성화
                </span>
              </div>
              <div className="flex items-center space-x-2.5">
                <span className={`w-2 h-2 rounded-full ${(parseProgress?.percent || 15) >= 50 ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]' : 'bg-slate-700'}`} />
                <span className={`transition-colors ${(parseProgress?.percent || 15) >= 50 ? 'text-slate-200 font-semibold' : 'text-slate-500'}`}>
                  3단계: PDF 메타 정보 검사 및 기하 해석
                </span>
              </div>
              <div className="flex items-center space-x-2.5">
                <span className={`w-2 h-2 rounded-full ${(parseProgress?.percent || 15) >= 55 ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]' : 'bg-slate-700'}`} />
                <span className={`transition-colors ${(parseProgress?.percent || 15) >= 55 ? 'text-slate-200 font-semibold' : 'text-slate-500'}`}>
                  4단계: 고밀도 유니코드 변환 및 어미 매핑
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 bg-slate-800/80 rounded-full text-amber-400 mb-5 relative">
              <Upload className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-semibold text-slate-100 tracking-tight mb-2">
              PDF 파일을 선택하거나 드래그하세요
            </h3>
            
            <p className="text-sm text-slate-400 max-w-xs mx-auto mb-6 leading-relaxed">
              모든 처리는 브라우저 안전 영역 내부에서 완전 오프라인으로 비공개 실행됩니다.
            </p>

            {/* Error Message */}
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start text-left space-x-3 w-full"
                id="error-banner"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                <span className="text-sm font-medium leading-relaxed">{error}</span>
              </motion.div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="application/pdf"
              className="hidden"
            />

            <div className="flex flex-col gap-3.5 w-full max-w-sm mx-auto select-none">
              <button
                type="button"
                onClick={triggerFileInput}
                className="px-5 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all duration-200 text-sm flex items-center justify-center space-x-2.5 shadow-lg shadow-amber-500/10 active:scale-[0.98] cursor-pointer"
                id="btn-upload"
              >
                <Laptop className="w-4.5 h-4.5" />
                <span>내 컴퓨터에서 파일 가져오기</span>
              </button>

              <button
                type="button"
                onClick={onGoogleDriveClick}
                className="px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold transition-all duration-200 text-sm flex items-center justify-center space-x-2.5 border border-slate-700 hover:border-slate-600 active:scale-[0.98] cursor-pointer"
                id="btn-google-drive"
              >
                <Cloud className="w-4.5 h-4.5 text-amber-400 animate-pulse" />
                <span>구글 드라이브 파일 가져오기</span>
              </button>

              <button
                type="button"
                onClick={onLoadSample}
                className="mt-1 px-5 py-3 rounded-xl bg-transparent hover:bg-slate-900/50 text-slate-400 hover:text-slate-200 font-semibold transition-all duration-200 text-xs flex items-center justify-center space-x-1.5 active:scale-[0.98] cursor-pointer"
                id="btn-sample"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                <span>데모 샘플 번역문으로 시작하기</span>
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
