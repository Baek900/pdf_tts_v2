/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pdfjsLib from 'pdfjs-dist';
import { ParseProgress } from '../types';

// Import the local worker script via Vite's static asset URL loader.
// This preserves the exact matching version of pdfjs-dist.
// @ts-ignore
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

export interface ExtractedPdf {
  text: string;
  pages: { pageNum: number; text: string }[];
}

const WORKER_COMPAT_POLYFILL = `
if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function() {
    var resolve, reject;
    var promise = new Promise(function(res, rej) {
      resolve = res;
      reject = rej;
    });
    return { promise: promise, resolve: resolve, reject: reject };
  };
}
if (typeof URL !== 'undefined' && typeof URL.canParse === 'undefined') {
  URL.canParse = function(url, base) {
    try {
      new URL(url, base);
      return true;
    } catch (e) {
      return false;
    }
  };
}
if (typeof ReadableStream !== 'undefined' && !ReadableStream.prototype[Symbol.asyncIterator]) {
  ReadableStream.prototype[Symbol.asyncIterator] = function() {
    var reader = this.getReader();
    return {
      next: function() {
        return reader.read().then(function(result) {
          return { value: result.value, done: result.done };
        });
      },
      return: function() {
        reader.releaseLock();
        return Promise.resolve({ done: true, value: undefined });
      }
    };
  };
}
`;

let cachedBlobUrl: string | null = null;

/**
 * Creates a same-origin Blob URL from the worker script.
 * This completely bypasses cross-origin iframe security restrictions for Web Workers.
 */
async function getSameOriginWorkerUrl(onProgress?: (progress: ParseProgress) => void): Promise<string> {
  if (cachedBlobUrl) {
    return cachedBlobUrl;
  }

  // 1. Try loading from local Vite-served worker asset first (highest fidelity)
  try {
    console.log(`Fetching local PDF.js worker from: ${pdfjsWorkerUrl}`);
    onProgress?.({
      stage: 'worker',
      percent: 25,
      message: '보안 정책 우회를 위한 동일 출처(Same-Origin) 보안 워커 생성 중...'
    });
    const response = await fetch(pdfjsWorkerUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch local worker: HTTP ${response.status}`);
    }
    const workerScript = await response.text();
    const blob = new Blob([WORKER_COMPAT_POLYFILL + "\n" + workerScript], { type: 'application/javascript' });
    cachedBlobUrl = URL.createObjectURL(blob);
    console.log('Successfully created local same-origin Blob URL for PDF.js worker');
    return cachedBlobUrl;
  } catch (localError: any) {
    console.warn('Failed to load local worker via Vite, falling back to CDN fetch...', localError);
  }

  // 2. Cascade fallback through CORS-enabled CDNs, downloading them via fetch to convert to a same-origin Blob
  const version = pdfjsLib.version || '6.0.227';
  const cdnCandidates = [
    `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.mjs`,
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.mjs`,
    `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`,
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`,
    `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.js`,
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.js`,
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`
  ];

  for (const cdnUrl of cdnCandidates) {
    try {
      console.log(`Fetching CDN worker fallback: ${cdnUrl}`);
      onProgress?.({
        stage: 'worker',
        percent: 35,
        message: '클라우드 CDN 네트워크를 통해 비상용 호환성 워커를 수신 중...'
      });
      const response = await fetch(cdnUrl);
      if (!response.ok) continue;
      const workerScript = await response.text();
      const blob = new Blob([WORKER_COMPAT_POLYFILL + "\n" + workerScript], { type: 'application/javascript' });
      cachedBlobUrl = URL.createObjectURL(blob);
      console.log(`Successfully converted CDN worker to local Blob: ${cdnUrl}`);
      return cachedBlobUrl;
    } catch (cdnError) {
      console.warn(`Failed to fetch and Blob-ify CDN worker: ${cdnUrl}`, cdnError);
    }
  }

  // 3. Absolute absolute fallback: Return the direct URL of the local / local bundle
  return pdfjsWorkerUrl;
}

/**
 * Extracts all text from a PDF file page by page.
 * Uses local Blob URL isolation to ensure 100% stable execution inside Sandboxed Iframes.
 */
export async function extractTextFromPdf(
  file: File,
  onProgress?: (progress: ParseProgress) => void
): Promise<ExtractedPdf> {
  let arrayBuffer: ArrayBuffer;
  try {
    onProgress?.({
      stage: 'read',
      percent: 10,
      message: '이진 파일 데이터 로드 및 비트 해독 중...'
    });
    if (typeof file.arrayBuffer === 'function') {
      arrayBuffer = await file.arrayBuffer();
    } else {
      console.log('file.arrayBuffer is not supported by this browser shell. Falling back to FileReader...');
      arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(reader.result);
          } else {
            reject(new Error('ArrayBuffer 변환에 실패했습니다.'));
          }
        };
        reader.onerror = () => reject(reader.error || new Error('FileReader 작업 중 오류가 발생했습니다.'));
        reader.readAsArrayBuffer(file);
      });
    }
  } catch (e: any) {
    throw new Error(`파일 데이터를 읽어올 수 없습니다: ${e.message || e}`);
  }

  let pdf: any = null;
  let lastError: any = null;

  try {
    // Dynamically retrieve/compile a same-origin Blob URL
    const activeWorkerSrc = await getSameOriginWorkerUrl(onProgress);
    console.log(`Setting GlobalWorkerOptions.workerSrc to same-origin asset: ${activeWorkerSrc}`);
    pdfjsLib.GlobalWorkerOptions.workerSrc = activeWorkerSrc;

    onProgress?.({
      stage: 'parse_structure',
      percent: 50,
      message: 'PDF 구조 해석 및 헤더 서명 유효성 분석 중...'
    });

    // Pass the raw arrayBuffer directly without duplicating via slice() to save up to 50% initial memory overhead
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    pdf = await loadingTask.promise;
  } catch (err: any) {
    console.warn(`Primary same-origin Blob load failed. Attempting classic fallback directly. Error:`, err);
    lastError = err;
    
    // Fallback: If Blob URL generation fails, try setting standard CDN sources directly as classical URL
    const version = pdfjsLib.version || '6.0.227';
    const emergencyUrls = [
      pdfjsWorkerUrl,
      `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`,
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`
    ];
    
    for (const url of emergencyUrls) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = url;
        // Re-attempt parse using safe slice copy fallback only in emergency cases
        const bufferCopy = arrayBuffer.slice(0);
        const loadingTask = pdfjsLib.getDocument({ data: bufferCopy });
        pdf = await loadingTask.promise;
        console.log(`Successfully parsed PDF using secondary fallback: ${url}`);
        break;
      } catch (subErr) {
        lastError = subErr;
      }
    }
  }

  // If both methods failed, report detailed telemetry
  if (!pdf) {
    console.error('All PDF.js worker load attempts failed.', lastError);
    throw new Error(
      `PDF 분석 엔진 초기화 실패 (브라우저 보안 정책으로 인해 PDF 분석 기능을 사용할 수 없습니다). 상세 원인: ${
        lastError?.message || lastError || 'Unknown Error'
      }`
    );
  }

  try {
    const pages: { pageNum: number; text: string }[] = [];
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Map text items to string, handling lines gracefully
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      pages.push({ pageNum: i, text: pageText });
      fullText += pageText + '\n';

      // Perform aggressive garbage collection hints on PDF.js internal resource structures
      // every 10 pages parsed to prevent heap ballooning on massive multi-page files
      if (i % 10 === 0) {
        try {
          pdf.cleanup();
        } catch (cleanErr) {
          console.warn('PDF Document internal cleanup warning:', cleanErr);
        }
      }

      const percent = 55 + Math.floor((i / pdf.numPages) * 40); // 55% to 95%
      onProgress?.({
        stage: 'pages',
        percent,
        message: `페이지별 본문 추출 및 유니코드 매핑 중... (${i} / ${pdf.numPages} 페이지 완료)`
      });
    }

    onProgress?.({
      stage: 'pages',
      percent: 98,
      message: '텍스트 완전 추출 완료. 무결성 구조 필터링 진행 중...'
    });

    // Defensive check to avoid returning junk content for scanned/encrypted docs
    const cleanCharCount = fullText.replace(/[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣]/g, '').length;
    if (cleanCharCount < 15) {
      throw new Error('텍스트를 추출할 수 없는 문서이거나 암호화된 파일입니다.');
    }

    onProgress?.({
      stage: 'complete',
      percent: 100,
      message: '분석 완료! 문장 단위 세그먼테이션을 완성합니다.'
    });

    return { text: fullText, pages };
  } catch (err: any) {
    console.error('PDF parsing error inside loaded doc:', err);
    if (err.message && err.message.includes('텍스트를 추출할 수 없는')) {
      throw err;
    }
    throw new Error(`PDF 본문 텍스트 분석 처리 중 오류가 발생했습니다: ${err.message || err.toString()}`);
  }
}
