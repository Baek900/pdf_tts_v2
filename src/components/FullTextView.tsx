/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PageData, SentenceItem } from '../types';
import { Search, ChevronRight, BookOpen, Layers, Sparkles, FileText } from 'lucide-react';

// Import pdf.worker url directly
// @ts-ignore
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
}

interface FullTextViewProps {
  file: File | null;
  pages: PageData[];
  sentences: SentenceItem[];
  activeIndex: number;
  onSentenceClick: (index: number) => void;
}

// -------------------------------------------------------------
// Interactive PDF Page Renderer utilizing PDF Canvas & Highlights
// -------------------------------------------------------------
export function PdfPage({ 
  pdfDoc, 
  pageNum, 
  pageSentences, 
  activeIndex, 
  onSentenceClick 
}: { 
  pdfDoc: any; 
  pageNum: number; 
  pageSentences: SentenceItem[]; 
  activeIndex: number; 
  onSentenceClick: (idx: number) => void; 
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState<any>(null);
  const [containerWidth, setContainerWidth] = useState<number>(500);
  const [textContentItems, setTextContentItems] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState<boolean>(false);
  const [isIntersecting, setIsIntersecting] = useState<boolean>(false);

  // Measure container width dynamically to guarantee full responsive fluid layouts
  useEffect(() => {
    if (!containerRef.current) return;
    
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.getBoundingClientRect().width);
      }
    };

    handleResize();

    const observer = new ResizeObserver(() => {
      handleResize();
    });
    
    observer.observe(containerRef.current);
    window.addEventListener('resize', handleResize);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Set up dynamic IntersectionObserver to only load/render canvases when visible or near-visible
  useEffect(() => {
    if (!containerRef.current) return;

    // Use rootMargin of 400px to preheat/preload pages just before they enter the user's view
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      rootMargin: '400px 0px 400px 0px',
      threshold: 0.01
    });

    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Fetch and render actual PDF contents lazily when intersecting with viewport
  useEffect(() => {
    if (!pdfDoc) return;

    if (!isIntersecting) {
      // Release GPU canvases and heap memory immediately when scrolled away
      setTextContentItems([]);
      setViewport(null);
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
        // Force GC on graphic memory allocations
        canvas.width = 0;
        canvas.height = 0;
      }
      return;
    }

    let active = true;
    let renderTask: any = null;

    const renderPage = async () => {
      setPageLoading(true);
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (!active) return;

        // Calculate custom fit ratio scale matching parent container width
        const baseViewport = page.getViewport({ scale: 1.0 });
        const scale = containerWidth / baseViewport.width;
        const pageViewport = page.getViewport({ scale });
        setViewport(pageViewport);

        if (canvasRef.current) {
          const canvas = canvasRef.current;
          canvas.width = pageViewport.width;
          canvas.height = pageViewport.height;

          const context = canvas.getContext('2d');
          if (context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            renderTask = page.render({
              canvasContext: context,
              viewport: pageViewport
            });
            await renderTask.promise;
          }
        }

        const content = await page.getTextContent();
        if (active) {
          setTextContentItems(content.items);
        }
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error(`Error rendering PDF page ${pageNum}:`, err);
        }
      } finally {
        if (active) {
          setPageLoading(false);
        }
      }
    };

    renderPage();

    return () => {
      active = false;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch (e) {}
      }
    };
  }, [pdfDoc, pageNum, containerWidth, isIntersecting]);

  // Combined master text string for calculating exact word indices
  const { masterString, itemSpans } = useMemo(() => {
    let mStr = '';
    const spans: { start: number; end: number; item: any }[] = [];
    
    textContentItems.forEach((item) => {
      const text = item.str || '';
      if (text) {
        const start = mStr.length;
        mStr += text + ' ';
        const end = mStr.length;
        spans.push({ start, end, item });
      }
    });

    return { masterString: mStr, itemSpans: spans };
  }, [textContentItems]);

  // Backtrace sentence indexes on masterString to find pixel bounding boxes
  const sentenceOverlays = useMemo(() => {
    if (!viewport || !masterString || itemSpans.length === 0) return [];

    let searchOffset = 0;
    
    return pageSentences.map((sentence) => {
      const text = sentence.text.trim();
      let idx = masterString.indexOf(text, searchOffset);

      // Handle character mismatches due to minor whitespace or hyphen differences
      if (idx === -1) {
        const normMaster = masterString.substring(searchOffset).toLowerCase().replace(/\s+/g, '');
        const normSent = text.toLowerCase().replace(/\s+/g, '');
        const normOffset = normMaster.indexOf(normSent);

        if (normOffset !== -1) {
          let mIdx = searchOffset;
          let nIdx = 0;
          let foundStart = -1;
          let foundEnd = -1;

          while (mIdx < masterString.length) {
            const mChar = masterString[mIdx].toLowerCase().replace(/\s+/g, '');
            if (mChar === '') {
              mIdx++;
              continue;
            }
            if (nIdx === normOffset) {
              foundStart = mIdx;
            }
            if (nIdx === normOffset + normSent.length - 1) {
              foundEnd = mIdx + 1;
              break;
            }
            nIdx++;
            mIdx++;
          }

          if (foundStart !== -1 && foundEnd !== -1) {
            idx = foundStart;
          }
        }
      }

      let startIdx = idx;
      let endIdx = idx !== -1 ? idx + text.length : -1;

      if (idx !== -1) {
        searchOffset = idx + text.length;
      } else {
        const backupIdx = masterString.indexOf(text);
        if (backupIdx !== -1) {
          startIdx = backupIdx;
          endIdx = backupIdx + text.length;
        }
      }

      if (startIdx === -1) return { sentence, rects: [] };

      const overlappingSpans = itemSpans.filter(span => {
        return Math.max(span.start, startIdx) < Math.min(span.end, endIdx);
      });

      const rects = overlappingSpans.map(span => {
        const { item } = span;
        const tx = item.transform[4];
        const ty = item.transform[5];
        const fs = Math.abs(item.transform[3]);
        const itemHeight = item.height || fs || 12;
        const itemWidth = item.width;

        const p1 = viewport.convertToViewportPoint(tx, ty + itemHeight);
        const p2 = viewport.convertToViewportPoint(tx + itemWidth, ty);

        const rx = Math.min(p1[0], p2[0]);
        const ry = Math.min(p1[1], p2[1]);
        const rw = Math.max(p1[0], p2[0]) - rx;
        const rh = Math.max(p1[1], p2[1]) - ry;

        return { x: rx, y: ry, w: rw, h: rh };
      }).filter(r => r.w > 0 && r.h > 0);

      return { sentence, rects };
    });
  }, [viewport, pageSentences, masterString, itemSpans]);

  return (
    <div className="relative p-5 bg-slate-950/45 border border-slate-800/80 rounded-2xl">
      <div className="flex justify-between items-center mb-3">
        <div className="text-[10px] uppercase font-mono tracking-wider font-semibold bg-slate-900 border border-slate-800 text-amber-400 px-3 py-1 rounded-lg flex items-center space-x-1.5">
          <Layers className="w-3.5 h-3.5" />
          <span>PAGE {pageNum}</span>
        </div>
        {pageLoading && (
          <span className="text-[10px] text-slate-500 font-mono animate-pulse">원본 렌더링 중...</span>
        )}
        {!isIntersecting && (
          <span className="text-[10px] text-slate-600 font-mono">대기 모드 (메모리 절약)</span>
        )}
      </div>

      <div 
        ref={containerRef}
        className="relative mx-auto rounded-xl overflow-hidden bg-slate-950/20 select-none border border-slate-900 shadow-inner flex items-center justify-center"
        style={{
          width: '100%',
          minHeight: '200px',
          height: viewport ? `${viewport.height}px` : `${Math.max(containerWidth, 300) * 1.414}px`,
          maxWidth: '100%'
        }}
      >
        {isIntersecting ? (
          <canvas ref={canvasRef} className="block w-full h-full" />
        ) : (
          <div className="text-slate-600 font-mono text-xs text-center flex flex-col items-center gap-1">
            <span className="animate-pulse">⏳</span>
            <span>스크롤 연동 자동 재생 대기</span>
          </div>
        )}
        
        {/* Full-width transparent target layers matching original text boundaries */}
        {viewport && sentenceOverlays.map((so) => {
          const isActive = so.sentence.globalIndex === activeIndex;
          
          return so.rects.map((rect, rIdx) => (
            <div
              key={`${so.sentence.id}-${rIdx}`}
              style={{
                position: 'absolute',
                left: `${rect.x}px`,
                top: `${rect.y}px`,
                width: `${rect.w}px`,
                height: `${rect.h + 2}px`
              }}
              className={`cursor-pointer transition-all duration-100 ease-out pointer-events-auto mix-blend-multiply rounded-sm ${
                isActive
                  ? 'bg-amber-400/40 divide-amber-600/30 border-b-2 border-amber-500 ring-2 ring-amber-400/25 shadow-md shadow-amber-500/10'
                  : 'hover:bg-amber-400/10 after:content-[""] after:absolute after:inset-0 after:border after:border-amber-400/10 after:opacity-0 hover:after:opacity-100'
              }`}
              onClick={() => onSentenceClick(so.sentence.globalIndex)}
              title="클릭하여 재생"
            />
          ));
        })}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Main FullTextView Container Wrapper
// -------------------------------------------------------------
export default function FullTextView({ file, pages, sentences, activeIndex, onSentenceClick }: FullTextViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  
  const pageContainerRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load parent PDFDocument proxy if a standard system File layout exists
  useEffect(() => {
    if (!file) {
      setPdfDocument(null);
      return;
    }
    
    let active = true;
    const initDoc = async () => {
      setPdfLoading(true);
      try {
        let arrayBuffer: ArrayBuffer;
        if (typeof file.arrayBuffer === 'function') {
          arrayBuffer = await file.arrayBuffer();
        } else {
          console.log('file.arrayBuffer is not supported in render initialization. Falling back to FileReader...');
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
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        if (active) {
          setPdfDocument(doc);
        }
      } catch (err) {
        console.error("Failed to load global PDF layout renderer context:", err);
      } finally {
        if (active) setPdfLoading(false);
      }
    };

    initDoc();

    return () => {
      active = false;
    };
  }, [file]);

  // Scroll active page card into view smoothly whenever activeIndex changes
  useEffect(() => {
    if (sentences.length === 0) return;
    const activeSentence = sentences[activeIndex];
    if (activeSentence) {
      const pageNum = activeSentence.pageNum;
      if (pageContainerRefs.current[pageNum]) {
        pageContainerRefs.current[pageNum]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [activeIndex, sentences]);

  // Group sentences by page
  const pageSentencesMap = useMemo(() => {
    const map: Record<number, SentenceItem[]> = {};
    sentences.forEach((sentence) => {
      if (!map[sentence.pageNum]) {
        map[sentence.pageNum] = [];
      }
      map[sentence.pageNum].push(sentence);
    });
    return map;
  }, [sentences]);

  // Text highlights fallback highlighting matching engine
  const highlightSearch = (text: string, term: string) => {
    if (!term) return text;
    const parts = text.split(new RegExp(`(${term})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === term.toLowerCase() 
            ? <mark key={i} className="bg-amber-400 text-slate-950 font-medium px-0.5 rounded">{part}</mark>
            : part
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl" id="full-text-view-container">
      {/* Header bar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          {pdfDocument ? (
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          ) : (
            <BookOpen className="w-5 h-5 text-amber-400" />
          )}
          <h3 className="font-semibold text-slate-200 text-sm tracking-wide">
            {pdfDocument ? 'PDF 오리지널 원본 뷰' : '본문 원문 레이아웃 뷰'}
          </h3>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
            {pages.length} Pages
          </span>
        </div>

        {/* Local text search input */}
        <div className="relative w-full sm:w-48 xl:w-64">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="문구 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/55 transition-colors"
          />
        </div>
      </div>

      {/* Pages scrolling container */}
      <div className="flex-1 overflow-y-auto p-5 space-y-8 select-text speech-scrollbar">
        {pages.map((page) => {
          const pageSentences = pageSentencesMap[page.pageNum] || [];
          
          return (
            <div 
              key={page.pageNum}
              ref={(el) => {
                pageContainerRefs.current[page.pageNum] = el;
              }}
              id={`page-card-${page.pageNum}`}
            >
              {pdfDocument ? (
                /* PDF Canvas layout with pixel alignment overlay */
                <PdfPage 
                  pdfDoc={pdfDocument}
                  pageNum={page.pageNum}
                  pageSentences={pageSentences}
                  activeIndex={activeIndex}
                  onSentenceClick={onSentenceClick}
                />
              ) : (
                /* Text-based fallback designed to keep demo or mock inputs operational */
                <div className="relative p-6 bg-slate-950/40 border border-slate-800/65 rounded-xl transition-all hover:bg-slate-950/60 transition-all duration-200">
                  <div className="absolute top-4 right-4 flex items-center space-x-1.5 text-slate-500 font-mono text-[10px] uppercase tracking-wider select-none bg-slate-900 px-2 py-1 rounded">
                    <Layers className="w-3 h-3" />
                    <span>PAGE {page.pageNum}</span>
                  </div>

                  <div className="mt-4 text-sm leading-relaxed text-slate-300 antialiased space-y-1">
                    {pageSentences.length > 0 ? (
                      pageSentences.map((sentence) => {
                        const isActive = sentence.globalIndex === activeIndex;
                        const matchesSearch = searchTerm && sentence.text.toLowerCase().includes(searchTerm.toLowerCase());

                        return (
                          <span
                            key={sentence.id}
                            onClick={() => onSentenceClick(sentence.globalIndex)}
                            className={`inline cursor-pointer rounded px-1 py-0.5 transition-all text-[13.5px] leading-relaxed ${
                              isActive
                                ? 'bg-amber-400/90 text-slate-950 font-medium shadow-sm shadow-amber-400/20 ring-1 ring-amber-400 scale-[1.01] hover:bg-amber-300'
                                : matchesSearch
                                ? 'bg-amber-950/40 border-b border-dashed border-amber-600/40 text-slate-200 hover:bg-slate-800/80'
                                : 'hover:bg-slate-800/50 hover:text-slate-100 duration-100 text-slate-300/90'
                            }`}
                            title="이 문장부터 읽기"
                          >
                            {highlightSearch(sentence.text, searchTerm)}{' '}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-slate-500 italic block">이 페이지에는 읽을 수 있는 텍스트가 없습니다.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
