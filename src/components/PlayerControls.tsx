/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PlayState, TTSVoiceOption } from '../types';
import { 
  Play, Pause, Square, SkipForward, SkipBack, 
  Volume2, Sliders, ChevronDown, RefreshCw 
} from 'lucide-react';

interface PlayerControlsProps {
  playState: PlayState;
  onPlayPause: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  
  // Progress
  activeIndex: number;
  totalSentences: number;
  onSeek: (index: number) => void;
  
  // Settings
  voices: TTSVoiceOption[];
  selectedVoiceName: string;
  onVoiceChange: (voiceName: string) => void;
  
  rate: number;
  onRateChange: (rate: number) => void;
  
  pitch: number;
  onPitchChange: (pitch: number) => void;

  autoScrollEnabled: boolean;
  onToggleAutoScroll: () => void;

  hybridEnabled: boolean;
  onToggleHybrid: () => void;

  onDownloadMp3?: () => void;
  downloadingMp3?: boolean;
}

export default function PlayerControls({
  playState,
  onPlayPause,
  onStop,
  onPrev,
  onNext,
  activeIndex,
  totalSentences,
  onSeek,
  voices,
  selectedVoiceName,
  onVoiceChange,
  rate,
  onRateChange,
  pitch,
  onPitchChange,
  autoScrollEnabled,
  onToggleAutoScroll,
  hybridEnabled,
  onToggleHybrid,
  onDownloadMp3,
  downloadingMp3
}: PlayerControlsProps) {
  const [showSettings, setShowSettings] = useState(false);

  const percent = totalSentences > 0 ? Math.round((activeIndex / totalSentences) * 100) : 0;

  return (
    <div className="w-full bg-slate-950 border-t border-slate-800 shadow-2xl p-4 md:p-6 select-none" id="tts-player-controls">
      <div className="max-w-6xl mx-auto space-y-4">
        
        {/* Row 1: Interactive Progress Scrubber */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="text-amber-400 font-semibold">{percent}%</span>
              <span>읽음</span>
            </div>
            <span>
              문장 {totalSentences > 0 ? activeIndex + 1 : 0} / {totalSentences}
            </span>
          </div>
          
          <div className="relative w-full h-2 rounded-full bg-slate-800 cursor-pointer overflow-hidden group">
            {/* Clickable range to jump to different sentences */}
            <input 
              type="range"
              min={0}
              max={Math.max(0, totalSentences - 1)}
              value={activeIndex}
              onChange={(e) => onSeek(Number(e.target.value))}
              disabled={totalSentences === 0}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            
            {/* Fill track */}
            <div 
              style={{ width: `${percent}%` }}
              className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-300 relative"
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border border-amber-600 scale-0 group-hover:scale-100 transition-transform shadow" />
            </div>
          </div>
        </div>

        {/* Row 2: Control Bar Dashboard */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Section A: Skip & Core Play/Pause Buttons */}
          <div className="flex items-center justify-center md:justify-start space-x-4">
            <button
              onClick={onPrev}
              disabled={totalSentences === 0 || activeIndex === 0}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
              title="이전 문장"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={onPlayPause}
              disabled={totalSentences === 0}
              className="p-4 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/10 hover:shadow-amber-400/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title={playState === PlayState.PLAYING ? '일시정지' : '재생'}
            >
              {playState === PlayState.PLAYING ? (
                <Pause className="w-5 h-5 fill-slate-950" />
              ) : (
                <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
              )}
            </button>

            <button
              onClick={onStop}
              disabled={totalSentences === 0 || playState === PlayState.STOPPED}
              className="p-3 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-950/15 hover:border-rose-900/30 transition-all active:scale-95 disabled:opacity-40"
              title="정지 (초기화)"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={onNext}
              disabled={totalSentences === 0 || activeIndex >= totalSentences - 1}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
              title="다음 문장"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Section B: Speech Quick Details & Toggles */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            
            {/* Auto Scroll Option */}
            <label className="flex items-center space-x-2 bg-slate-900/85 border border-slate-800/80 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors">
              <input 
                type="checkbox"
                checked={autoScrollEnabled}
                onChange={onToggleAutoScroll}
                className="accent-amber-500 w-4 h-4 rounded"
              />
              <span className="text-xs font-medium text-slate-300">자동 포커스 스크롤</span>
            </label>

            {/* Smart Bilingual Dual Engine TTS */}
            <label className="flex items-center space-x-2 bg-slate-900/85 border border-slate-800/80 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors" title="한문장 안에 한글과 영어가 섞여있을 때, 각각 최적의 목소리로 지연 없이 매끄럽게 나누어 들려줍니다.">
              <input 
                type="checkbox"
                checked={hybridEnabled}
                onChange={onToggleHybrid}
                className="accent-amber-500 w-4 h-4 rounded"
              />
              <span className="text-xs font-medium text-slate-300 flex items-center space-x-1">
                <span>한/영 스마트 엔진</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              </span>
            </label>

            {/* Quick Speed controls Indicator */}
            <div className="text-xs text-slate-400 font-medium">
              배속: <span className="text-amber-400 font-semibold font-mono">{rate.toFixed(1)}x</span>
            </div>

            {/* Premium Entire TTS MP3 Downloader Action Button */}
            {onDownloadMp3 && (
              <button
                type="button"
                onClick={onDownloadMp3}
                disabled={downloadingMp3 || totalSentences === 0}
                className="px-4 py-2 bg-gradient-to-tr from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 disabled:opacity-45 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer active:scale-95 transition-all shadow-md shadow-amber-500/10"
                title="추출된 전체 문장을 오프라인 MP3 포맷 대용량 파일로 인코딩하여 즉시 다운로드"
              >
                {downloadingMp3 ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>MP3 다운로드 중...</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                    <span>전체 MP3 다운로드</span>
                  </>
                )}
              </button>
            )}

            {/* Show/Hide detailed Settings Panel */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all outline-none border ${
                showSettings 
                  ? 'bg-amber-400/10 text-amber-300 border-amber-400/40' 
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>오디오 조절판</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showSettings ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Row 3: Expandable Detailed Audio Panel (Pitch, Voice, Speed) */}
        {showSettings && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 relative mt-2">
            
            {/* Voice Dropdown Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-400">목소리 음성 선택</label>
              <div className="relative">
                <select
                  value={selectedVoiceName}
                  onChange={(e) => onVoiceChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 h-10 pr-8 appearance-none"
                >
                  <option value="">일반 시스템 기본 음성</option>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang.split('-')[0].toUpperCase()})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3.5 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                일부 브라우저는 OS 기본 음성이 상이하게 설치될 수 있습니다.
              </p>
            </div>

            {/* Speed Rate Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span>말하기 속도 (배속)</span>
                <span className="text-amber-400 font-mono font-bold">{rate.toFixed(1)}x</span>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={rate}
                  onChange={(e) => onRateChange(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-950 rounded-lg h-1.5 outline-none cursor-pointer"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.5x</span>
                <span>1.0x (보통)</span>
                <span>2.0x</span>
              </div>
            </div>

            {/* Pitch (음높이) Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span>목소리 톤 (음높이)</span>
                <span className="text-amber-400 font-mono font-bold">{pitch.toFixed(1)}</span>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={pitch}
                  onChange={(e) => onPitchChange(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-950 rounded-lg h-1.5 outline-none cursor-pointer"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>저음 (0.5)</span>
                <span>보통 (1.0)</span>
                <span>고음 (1.5)</span>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
