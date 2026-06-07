/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum PlayState {
  STOPPED = 'STOPPED',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED'
}

export interface PageData {
  pageNum: number;
  text: string;
}

export interface SentenceItem {
  id: string;
  text: string;
  pageNum: number;
  globalIndex: number;
}

export interface TTSVoiceOption {
  name: string;
  lang: string;
  voice: SpeechSynthesisVoice;
}

export interface ParseProgress {
  percent: number;
  message: string;
  stage: 'idle' | 'read' | 'worker' | 'parse_structure' | 'pages' | 'complete';
}

