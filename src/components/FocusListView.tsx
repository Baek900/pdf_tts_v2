/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { SentenceItem, PlayState } from '../types';
import { Sparkles, ArrowRight, Eye, Volume2, Milestone } from 'lucide-react';

interface FocusListViewProps {
  sentences: SentenceItem[];
  activeIndex: number;
  playState: PlayState;
  onSentenceClick: (index: number) => void;
  autoScrollEnabled: boolean;
}

export default function FocusListView({
  sentences,
  activeIndex,
  playState,
  onSentenceClick,
  autoScrollEnabled,
}: FocusListViewProps) {
  const sentenceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Active sentence structure
  const activeSentence = sentences[activeIndex] || null;

  useEffect(() => {
    if (autoScrollEnabled && activeIndex >= 0 && sentenceRefs.current[activeIndex]) {
      sentenceRefs.current[activeIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, autoScrollEnabled, sentences]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl" id="focused-reading-view">
      {/* Upper Panel: Premium Magnified Big Reading Card */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/60 relative overflow-hidden shrink-0 select-text">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/[0.03] rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400 uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>집중 어시스트 리더</span>
          </div>
          {activeSentence && (
            <span className="text-[10px] font-mono bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded-full">
              PAGE {activeSentence.pageNum} • {activeIndex + 1}/{sentences.length}
            </span>
          )}
        </div>

        {activeSentence ? (
          <div className="min-h-24 flex flex-col justify-center">
            <h4 className="text-base md:text-lg font-medium text-slate-100 leading-relaxed transition-all duration-300">
              {activeSentence.text}
            </h4>
          </div>
        ) : (
          <div className="min-h-24 flex flex-col items-center justify-center text-center">
            <span className="text-sm text-slate-500 italic">재생하면 현재 읽는 문장이 커져서 여기에 집중 표기됩니다.</span>
          </div>
        )}
      </div>

      {/* Title bar for list */}
      <div className="p-3 bg-slate-950/20 border-b border-slate-800/40 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-2 text-slate-400 text-xs pl-2 font-medium">
          <Milestone className="w-3.5 h-3.5 text-slate-500" />
          <span>순서별 문장 리스트 ({sentences.length}개)</span>
        </div>
        <div className="text-[10px] text-slate-500 flex items-center space-x-1 pr-2">
          <Eye className="w-3 h-3" />
          <span>클릭 시 해당 지점으로 바로 점프</span>
        </div>
      </div>

      {/* Main scrolling Sentence list */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2.5 speech-scrollbar" 
        id="sentence-scroll-container"
      >
        {sentences.map((item, index) => {
          const isActive = index === activeIndex;
          const isPlaying = isActive && playState === PlayState.PLAYING;

          return (
            <div
              key={item.id}
              ref={(el) => {
                sentenceRefs.current[index] = el;
              }}
              onClick={() => onSentenceClick(index)}
              className={`group flex items-start gap-4 p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-amber-400/10 border-amber-400/30 shadow-md shadow-amber-400/[0.02]'
                  : 'bg-slate-950/25 border-slate-800/50 hover:bg-slate-800/40 hover:border-slate-700/80'
              }`}
              id={`sentence-row-${index}`}
            >
              {/* Left Bullet Badge */}
              <div 
                className={`w-7 h-7 rounded-lg text-[11px] font-mono font-semibold flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 scale-105'
                    : 'bg-slate-900 text-slate-500 group-hover:bg-slate-800'
                }`}
              >
                {String(index + 1).padStart(2, '0')}
              </div>

              {/* Main Sentence content */}
              <div className="flex-1 space-y-1">
                <p 
                  className={`text-xs md:text-sm leading-relaxed transition-colors ${
                    isActive 
                      ? 'text-amber-300 font-medium' 
                      : 'text-slate-300 group-hover:text-slate-200'
                  }`}
                >
                  {item.text}
                </p>

                {/* Sub Metadata info */}
                <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-mono select-none">
                  <span>Page {item.pageNum}</span>
                  {isPlaying && (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Volume2 className="w-3 h-3 animate-bounce" />
                      <span>재생 중...</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Hover action indicator */}
              <div className="self-center pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
