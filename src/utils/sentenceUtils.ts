/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SentenceItem } from '../types';

/**
 * Advanced Korean/English sentence splitter that avoids chunking on common abbreviations
 */
export function splitIntoSentencesOnly(text: string): string[] {
  if (!text) return [];

  // Re-encode spaces and trim
  const cleaned = text.replace(/\s+/g, ' ').trim();

  // Known abbreviations that end with a dot but do NOT indicate sentence endings
  const abbreviations = [
    'e.g.', 'i.e.', 'vs.', 'etc.', 'p.', 'pp.', 'vol.', 'mr.', 'mrs.', 'ms.', 'dr.', 
    'co.', 'ltd.', 'inc.', 'ca.', 'approx.', 'est.', 'jan.', 'feb.', 'mar.', 'apr.', 
    'jun.', 'jul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.', 'vol.1', 'vol.2', 'vol.3', 
    'p.1', 'p.2', 'p.3', 'p.a.', 'ph.d.', 'b.a.', 'm.a.', 'u.s.', 'u.k.', 'a.m.', 'p.m.'
  ];

  const sentences: string[] = [];
  let currentSentence = '';

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    currentSentence += char;

    // Sentence endings are normally marked by '.', '!', '?'
    if (char === '.' || char === '!' || char === '?') {
      const isLast = i === cleaned.length - 1;
      const nextChar = isLast ? '' : cleaned[i + 1];

      // A potential boundary is if next is a space, or it is the end of the text
      if (isLast || nextChar === ' ') {
        // Look back to verify if this token is an abbreviation
        const words = currentSentence.trim().split(' ');
        const lastWord = words[words.length - 1]?.toLowerCase();

        let isAbbrCheck = false;
        if (lastWord) {
          // 1. Direct match with list
          isAbbrCheck = abbreviations.some(abbr => lastWord === abbr || lastWord.endsWith(abbr));

          // 2. Pattern check (e.g. p.45, Vol.12, No.5, or numbered list elements like 1. 2.)
          if (!isAbbrCheck && char === '.') {
            // Check for pattern like: single letter with dot, e.g. "a."
            if (/^[a-z]\.$/i.test(lastWord)) {
              isAbbrCheck = true;
            }
            // Check for page or volume with digit, e.g. "p.5", "vol.22", "v.1"
            else if (/^(p|vol|v|no|sec|ch|fig|eq)\.\d+$/i.test(lastWord)) {
              isAbbrCheck = true;
            }
            // Check for index list numbers, e.g. "1.", "12."
            else if (/^\d+\.$/.test(lastWord)) {
              // If it's a number at the beginning of a sentence list, we can keep it connected
              isAbbrCheck = true;
            }
          }
        }

        if (!isAbbrCheck) {
          sentences.push(currentSentence.trim());
          currentSentence = '';
          // Consume any trailing whitespace
          if (!isLast && nextChar === ' ') {
            i++;
          }
        }
      }
    }
  }

  if (currentSentence.trim()) {
    sentences.push(currentSentence.trim());
  }

  return sentences.filter(s => s.length > 0);
}

export interface LanguageSegment {
  text: string;
  isEnglish: boolean;
}

/**
 * Advanced Bi-lingual text segmenter. Splits mixed sentences into Korean and English chunks
 * by tracking specific alphabet boundaries (even mid-word like 'Transformer는')
 * while correctly preserving spaces to guarantee natural TTS pauses.
 */
export function segmentLanguages(text: string): LanguageSegment[] {
  if (!text) return [];

  // Capture English blocks, Hangul blocks, and whitespaces individually
  const tokens = text.split(/([a-zA-Z]+|[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]+|\s+)/);
  const segments: LanguageSegment[] = [];
  
  let currentSegment: LanguageSegment | null = null;

  for (const token of tokens) {
    if (!token) continue;

    // Pure whitespace tokens are attached onto the active segment to keep word spacing natural
    const isPureSpace = /^\s+$/.test(token);
    if (isPureSpace) {
      if (currentSegment) {
        currentSegment.text += token;
      }
      continue;
    }

    const hasHangul = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/.test(token);
    const hasEnglish = /[a-zA-Z]/.test(token);

    let tokenIsEnglish = false;
    if (hasHangul) {
      tokenIsEnglish = false;
    } else if (hasEnglish) {
      tokenIsEnglish = true;
    } else {
      // For symbols, punctuation, numbers, inherit the active segment's language pattern to avoid choppy pauses
      tokenIsEnglish = currentSegment ? currentSegment.isEnglish : false;
    }

    if (!currentSegment) {
      currentSegment = { text: token, isEnglish: tokenIsEnglish };
    } else if (currentSegment.isEnglish === tokenIsEnglish) {
      currentSegment.text += token;
    } else {
      segments.push({ ...currentSegment });
      currentSegment = { text: token, isEnglish: tokenIsEnglish };
    }
  }

  if (currentSegment) {
    segments.push({ ...currentSegment });
  }

  // Map segments, refine whitespaces and filter empty ones
  return segments.map(seg => ({
    text: seg.text.trim(),
    isEnglish: seg.isEnglish
  })).filter(seg => seg.text.length > 0);
}

/**
 * Parses and maps sentences to individual pages with a computed global index
 */
export function buildSentenceList(pages: { pageNum: number; text: string }[]): SentenceItem[] {
  const result: SentenceItem[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    const sentences = splitIntoSentencesOnly(page.text);
    for (const text of sentences) {
      result.push({
        id: `p${page.pageNum}-s${globalIndex}-${Date.now()}`,
        text,
        pageNum: page.pageNum,
        globalIndex
      });
      globalIndex++;
    }
  }

  return result;
}
