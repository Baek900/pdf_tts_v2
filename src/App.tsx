/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Headphones, FileText, RefreshCw, AlertTriangle, 
  Sparkles, Music, CheckCircle2, Bookmark, Flame
} from 'lucide-react';

import { PlayState, PageData, SentenceItem, TTSVoiceOption, ParseProgress } from './types';
import { buildSentenceList, segmentLanguages } from './utils/sentenceUtils';
import { extractTextFromPdf } from './utils/pdfExtractor';

import DropZone from './components/DropZone';
import FullTextView from './components/FullTextView';
import FocusListView from './components/FocusListView';
import PlayerControls from './components/PlayerControls';
import GoogleDriveModal from './components/GoogleDriveModal';
import { initAuth } from './utils/googleDrive';

const findBestEnglishVoice = (currentVoices: TTSVoiceOption[]): TTSVoiceOption | undefined => {
  const enVoices = currentVoices.filter(v => v.lang.toLowerCase().startsWith('en'));
  if (enVoices.length === 0) return undefined;

  // Prioritize premium/natural English voice names for ultimate reading fidelity
  const premiumKeywords = [
    'google us english', // Ultra Premium Google Chrome US English
    'google uk english', // Premium Google Chrome UK English
    'samantha',          // Crystal clear macOS/iOS English (female)
    'daniel',            // Clear macOS English (male)
    'natural',           // Microsoft modern natural voices
    'karen',             // macOS AU voice
    'moira',             // macOS IE voice
    'tessa',             // macOS ZA voice
    'microsoft zira',    // Standard Windows Desktop English (Zira is much cleaner than David)
    'google'             // Generic Google high-fidelity web TTS
  ];

  for (const keyword of premiumKeywords) {
    const found = enVoices.find(v => v.name.toLowerCase().includes(keyword));
    if (found) return found;
  }

  // Fallback to US-specific locale prefix
  const usVoice = enVoices.find(v => v.lang.toLowerCase().includes('en-us'));
  if (usVoice) return usVoice;

  return enVoices[0];
};

const findBestKoreanVoice = (currentVoices: TTSVoiceOption[]): TTSVoiceOption | undefined => {
  const koVoices = currentVoices.filter(v => v.lang.toLowerCase().startsWith('ko'));
  if (koVoices.length === 0) return undefined;

  const premiumKeywords = [
    'google 한국어',     // High-fidelity Chromium Korean synth
    'yuna',            // Pristine macOS Korean voice (Yuna)
    'heami',           // Standard macOS alternative
    'google',          // Fallback Google voice
    'microsoft hyunsu',// Premium Edge-like Korean
    'sunhi'            // iOS/Windows standard
  ];

  for (const keyword of premiumKeywords) {
    const found = koVoices.find(v => v.name.toLowerCase().includes(keyword));
    if (found) return found;
  }

  // Fallback to standard ko-KR identifier
  const krVoice = koVoices.find(v => v.lang.toLowerCase().includes('ko-kr'));
  if (krVoice) return krVoice;

  return koVoices[0];
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [pages, setPages] = useState<PageData[]>([]);
  const [sentences, setSentences] = useState<SentenceItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [playState, setPlayState] = useState<PlayState>(PlayState.STOPPED);
  
  // UI states
  const [loading, setLoading] = useState<boolean>(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState<boolean>(false);
  const [parseProgress, setParseProgress] = useState<ParseProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [downloadingMp3, setDownloadingMp3] = useState<boolean>(false);

  // Progressive Web App installation prompting states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBadge, setShowInstallBadge] = useState<boolean>(false);

  // Capture PWA browser install prompt triggers
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBadge(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install completion: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBadge(false);
  };

  // Synchronize Google Auth session state
  useEffect(() => {
    const unsubscribe = initAuth();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Speech options
  const [voices, setVoices] = useState<TTSVoiceOption[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [rate, setRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [hybridEnabled, setHybridEnabled] = useState<boolean>(true);

  // Synchronization refs to bypass React state stale closures inside TTS boundary events
  const playStateRef = useRef<PlayState>(PlayState.STOPPED);
  const activeIndexRef = useRef<number>(0);
  const sentencesRef = useRef<SentenceItem[]>([]);
  const selectedVoiceNameRef = useRef<string>('');
  const rateRef = useRef<number>(1.0);
  const pitchRef = useRef<number>(1.0);
  const hybridEnabledRef = useRef<boolean>(true);
  const voicesRef = useRef<TTSVoiceOption[]>([]);

  useEffect(() => {
    playStateRef.current = playState;
  }, [playState]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    sentencesRef.current = sentences;
  }, [sentences]);

  useEffect(() => {
    selectedVoiceNameRef.current = selectedVoiceName;
  }, [selectedVoiceName]);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    pitchRef.current = pitch;
  }, [pitch]);

  useEffect(() => {
    hybridEnabledRef.current = hybridEnabled;
  }, [hybridEnabled]);

  useEffect(() => {
    voicesRef.current = voices;
  }, [voices]);

  // Load and sort browser-supported speech synthesis voices
  const loadVoices = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const sysVoices = window.speechSynthesis.getVoices();
    
    const mapped: TTSVoiceOption[] = sysVoices.map((v) => ({
      name: v.name,
      lang: v.lang,
      voice: v
    }));

    // Prioritize Korean (ko) and English (en) voices first, then rank premium variants on top
    mapped.sort((a, b) => {
      const aKo = a.lang.toLowerCase().startsWith('ko');
      const bKo = b.lang.toLowerCase().startsWith('ko');
      const aEn = a.lang.toLowerCase().startsWith('en');
      const bEn = b.lang.toLowerCase().startsWith('en');

      if (aKo && !bKo) return -1;
      if (!aKo && bKo) return 1;
      if (aEn && !bEn) return -1;
      if (!aEn && bEn) return 1;

      // Secondary sorting: place premium/recognized system engines higher for each language group
      const premiumKeywords = ['google', 'samantha', 'yuna', 'daniel', 'hyunsu', 'zira', 'natural'];
      const aPremium = premiumKeywords.some(keyword => a.name.toLowerCase().includes(keyword));
      const bPremium = premiumKeywords.some(keyword => b.name.toLowerCase().includes(keyword));
      if (aPremium && !bPremium) return -1;
      if (!aPremium && bPremium) return 1;

      return a.name.localeCompare(b.name);
    });

    setVoices(mapped);

    // Auto-select best Korean voice first, or fallback cleanly to the best English voice
    if (mapped.length > 0 && !selectedVoiceName) {
      const defaultKo = findBestKoreanVoice(mapped);
      if (defaultKo) {
        setSelectedVoiceName(defaultKo.name);
      } else {
        const defaultEn = findBestEnglishVoice(mapped);
        if (defaultEn) {
          setSelectedVoiceName(defaultEn.name);
        } else {
          setSelectedVoiceName(mapped[0].name);
        }
      }
    }
  }, [selectedVoiceName]);

  // Set up voice change listeners
  useEffect(() => {
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [loadVoices]);

  // Clean speaking queue when component unmounts (navigating away / tab closing)
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Primary sequential speech generator (supporting premium Bi-lingual Hybrid dual-engine)
  const speakSentenceOfIndex = useCallback((index: number, segmentIndex: number = 0) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Only cancel the global speech manager when first initiating a new sentence
    if (segmentIndex === 0) {
      window.speechSynthesis.cancel();
    }

    // Chromium 및 OS 기본 오디오 엔진과의 타임아웃 경합을 필터링하기 위해 짧은 하드웨어 풀링 딜레이를 제공합니다.
    setTimeout(() => {
      const currentSentences = sentencesRef.current;
      if (index < 0 || index >= currentSentences.length) {
        setPlayState(PlayState.STOPPED);
        setActiveIndex(0);
        return;
      }

      // 재생 상태가 수동 정지 또는 끊겼는지 실시간 Ref 검증
      if (playStateRef.current !== PlayState.PLAYING) {
        return;
      }

      // B. Set current state (only visual update on index change)
      if (segmentIndex === 0) {
        setActiveIndex(index);
      }

      const targetSentence = currentSentences[index];
      
      // Check if Hybrid Bi-lingual layout is active
      const useHybrid = hybridEnabledRef.current;
      
      if (useHybrid) {
        const segments = segmentLanguages(targetSentence.text);
        
        // If there are multiple language blocks in this sentence
        if (segments.length > 0) {
          // If we finished all segments of this sentence, move to the next sentence!
          if (segmentIndex >= segments.length) {
            setTimeout(() => {
              if (playStateRef.current === PlayState.PLAYING) {
                const nextIdx = index + 1;
                if (nextIdx < currentSentences.length) {
                  speakSentenceOfIndex(nextIdx, 0);
                } else {
                  setPlayState(PlayState.STOPPED);
                  setActiveIndex(0);
                }
              }
            }, 100);
            return;
          }

          const activeSeg = segments[segmentIndex];
          const utterance = new SpeechSynthesisUtterance(activeSeg.text);

          // Voice Selection Strategy
          const activeVoiceName = selectedVoiceNameRef.current;
          const currentVoices = voicesRef.current;

          if (activeSeg.isEnglish) {
            // Find an English voice for highest fidelity text rendering quality!
            // Prefer the user-selected voice if it is an english voice
            let englishVoice = currentVoices.find(v => v.name === activeVoiceName && v.lang.toLowerCase().startsWith('en'));
            
            // Fallback to our premium prioritized English voices
            if (!englishVoice) {
              englishVoice = findBestEnglishVoice(currentVoices);
            }

            if (englishVoice) {
              utterance.voice = englishVoice.voice;
              utterance.lang = englishVoice.lang;
            } else if (activeVoiceName) {
              // Last-ditch: use selected voice
              const activeVoice = currentVoices.find(v => v.name === activeVoiceName);
              if (activeVoice) {
                utterance.voice = activeVoice.voice;
                utterance.lang = activeVoice.lang;
              }
            } else {
              utterance.lang = 'en-US';
            }
          } else {
            // For Korean/Non-English, use user selected voice or fallback to premium Korean voice
            let koreanVoice = currentVoices.find(v => v.name === activeVoiceName && v.lang.toLowerCase().startsWith('ko'));
            if (!koreanVoice) {
              koreanVoice = findBestKoreanVoice(currentVoices);
            }
            if (koreanVoice) {
              utterance.voice = koreanVoice.voice;
              utterance.lang = koreanVoice.lang;
            } else {
              utterance.lang = 'ko-KR';
            }
          }

          utterance.rate = rateRef.current;
          utterance.pitch = pitchRef.current;

          utterance.onend = () => {
            if (playStateRef.current === PlayState.PLAYING) {
              // Re-check state and speak the next segment sequentially with minor timeout to prevent collision
              setTimeout(() => {
                if (playStateRef.current === PlayState.PLAYING) {
                  speakSentenceOfIndex(index, segmentIndex + 1);
                }
              }, 20);
            }
          };

          utterance.onerror = (e) => {
            if (e.error !== 'interrupted' && e.error !== 'canceled') {
              console.warn('Speech engine segment error, advancing...', e.error);
              if (playStateRef.current === PlayState.PLAYING) {
                speakSentenceOfIndex(index, segmentIndex + 1);
              }
            }
          };

          window.speechSynthesis.speak(utterance);
          return;
        }
      }

      // Default Standard Fallback (Single voice reading entire text)
      const utterance = new SpeechSynthesisUtterance(targetSentence.text);

      const activeVoiceName = selectedVoiceNameRef.current;
      const currentVoices = voicesRef.current;
      if (activeVoiceName) {
        const activeVoice = currentVoices.find(v => v.name === activeVoiceName);
        if (activeVoice) {
          utterance.voice = activeVoice.voice;
          utterance.lang = activeVoice.lang;
        }
      }

      utterance.rate = rateRef.current;
      utterance.pitch = pitchRef.current;

      utterance.onend = () => {
        setTimeout(() => {
          if (playStateRef.current === PlayState.PLAYING) {
            const nextIdx = index + 1;
            if (nextIdx < currentSentences.length) {
              speakSentenceOfIndex(nextIdx, 0);
            } else {
              setPlayState(PlayState.STOPPED);
              setActiveIndex(0);
            }
          }
        }, 150);
      };

      utterance.onerror = (e) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('Speech engine error, advancing...', e.error);
          if (index + 1 < currentSentences.length && playStateRef.current === PlayState.PLAYING) {
            setTimeout(() => speakSentenceOfIndex(index + 1, 0), 150);
          } else {
            setPlayState(PlayState.STOPPED);
          }
        }
      };

      window.speechSynthesis.speak(utterance);
    }, 50);
  }, []);

  // File loading handler
  const handleFileSelected = async (selectedFile: File) => {
    // Stop any active recitation
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setLoading(true);
    setParseProgress({
      percent: 5,
      message: 'PDF 분석을 대기 중입니다...',
      stage: 'idle'
    });
    setError(null);
    setPlayState(PlayState.STOPPED);

    try {
      const extracted = await extractTextFromPdf(selectedFile, (progressObj) => {
        setParseProgress(progressObj);
      });
      const items = buildSentenceList(extracted.pages);
      
      setPages(extracted.pages);
      setSentences(items);
      setActiveIndex(0);

      // Dynamically detect dominant language of the parsed PDF file
      let totalText = '';
      extracted.pages.forEach(p => {
        totalText += (p.text || '') + '\n';
      });

      const enCharCount = (totalText.match(/[a-zA-Z]/g) || []).length;
      const koCharCount = (totalText.match(/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/g) || []).length;

      // Select premium default voice based on the calculated language proportion
      const sysVoices = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
      const mappedVoices: TTSVoiceOption[] = sysVoices.map((v) => ({
        name: v.name,
        lang: v.lang,
        voice: v
      }));

      const activeVoices = mappedVoices.length > 0 ? mappedVoices : voices;
      if (activeVoices.length > 0) {
        if (enCharCount > koCharCount) {
          const bestEn = findBestEnglishVoice(activeVoices);
          if (bestEn) {
            setSelectedVoiceName(bestEn.name);
          }
        } else {
          const bestKo = findBestKoreanVoice(activeVoices);
          if (bestKo) {
            setSelectedVoiceName(bestKo.name);
          }
        }
      }
    } catch (err: any) {
      setFile(null);
      setFileName('');
      setError(err.message || '인식할 수 없거나 분석에 실패한 PDF 파일입니다.');
    } finally {
      setLoading(false);
      setParseProgress(null);
    }
  };

  // Demo play scenario loader
  const handleLoadSample = () => {
    // Cancel active speech
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setLoading(true);
    setError(null);
    setPlayState(PlayState.STOPPED);

    setTimeout(() => {
      const samplePages: PageData[] = [
        {
          pageNum: 1,
          text: `PDF 오디오 리더 장치에 오신 것을 환영합니다! 이 프로그램은 최신 웹 스피치를 완벽하게 대응하여 귀하가 읽고 싶어하는 문서를 오디오북처럼 편안하고 완벽하게 청취할 수 있도록 어시스트 해줍니다. 사용자는 PDF 문서를 드롭하거나 업로드하는 것만으로 간단히 텍스트를 고속 추출할 수 있습니다. 추출된 본문은 인공지능 기반 세그먼트 규칙을 반영하여 문장 단위로 파싱 배열되어 관리됩니다.`
        },
        {
          pageNum: 2,
          text: `단순한 점(.) 형태의 어미 자르기 필터의 한계를 벗어나 e.g. 또는 Vol.1, p.45와 같이 독서 중 빈번히 발견되는 약어들의 중첩을 방어하도록 구현되었습니다. 재생, 일시정지, 음량 조절판 등을 지원하여 청취 편의성을 비약적으로 향상시킵니다.`
        },
        {
          pageNum: 3,
          text: `실시간 낭독 및 포커스 싱크 기술을 통하여 현재 출력되고 있는 활성 문장은 중앙 화면에 부드럽게 노출되며, 포인트 하이라이트 색상 유지를 통해 눈의 집중도 분산을 방지합니다. 또한 로비 이탈 시 자동 누적 큐 제거가 작동하여 전력 손실 및 브라우저 프리징 현상을 사전에 전차단합니다. 지금 즉시 하단 제어판을 활용하여 스마트 리딩을 테스트해 보세요!`
        }
      ];

      const built = buildSentenceList(samplePages);
      setPages(samplePages);
      setSentences(built);
      setActiveIndex(0);
      setFileName('데모_리더_가이드_문서.pdf');
      setLoading(false);

      // Detect language proportion of the sample pages to configure default TTS voice
      let totalText = '';
      samplePages.forEach(p => {
        totalText += (p.text || '') + '\n';
      });
      const enCharCount = (totalText.match(/[a-zA-Z]/g) || []).length;
      const koCharCount = (totalText.match(/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/g) || []).length;

      if (voices.length > 0) {
        if (enCharCount > koCharCount) {
          const bestEn = findBestEnglishVoice(voices);
          if (bestEn) setSelectedVoiceName(bestEn.name);
        } else {
          const bestKo = findBestKoreanVoice(voices);
          if (bestKo) setSelectedVoiceName(bestKo.name);
        }
      }
    }, 600);
  };

  // Reset workspace
  const handleResetWorkspace = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setFile(null);
    setFileName('');
    setPages([]);
    setSentences([]);
    setActiveIndex(0);
    setPlayState(PlayState.STOPPED);
    setError(null);
  };

  // Play Actions
  const handlePlayPause = () => {
    if (sentences.length === 0) return;

    if (playState === PlayState.PLAYING) {
      // Standard safe pause (restarts from current activeIndex on resume to avoid thread blockage)
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setPlayState(PlayState.PAUSED);
    } else {
      // Resume or play on currently loaded index
      setPlayState(PlayState.PLAYING);
      // Wait a tiny fraction of time so playState ref state updates
      setTimeout(() => {
        speakSentenceOfIndex(activeIndex);
      }, 50);
    }
  };

  const handleStop = () => {
    stopSpeech();
    setActiveIndex(0);
  };

  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlayState(PlayState.STOPPED);
  }, []);

  const handlePrev = () => {
    if (activeIndex > 0) {
      const prevIdx = activeIndex - 1;
      setActiveIndex(prevIdx);
      if (playState === PlayState.PLAYING) {
        speakSentenceOfIndex(prevIdx);
      }
    }
  };

  const handleNext = () => {
    if (activeIndex < sentences.length - 1) {
      const nextIdx = activeIndex + 1;
      setActiveIndex(nextIdx);
      if (playState === PlayState.PLAYING) {
        speakSentenceOfIndex(nextIdx);
      }
    }
  };

  const handleSeek = (index: number) => {
    if (index >= 0 && index < sentences.length) {
      setActiveIndex(index);
      if (playState === PlayState.PLAYING) {
        speakSentenceOfIndex(index);
      }
    }
  };

  const handleSentenceClick = (index: number) => {
    // Jump straight into the sentence and start speaking
    setActiveIndex(index);
    setPlayState(PlayState.PLAYING);
    setTimeout(() => {
      speakSentenceOfIndex(index);
    }, 50);
  };

  // When settings change while speaking, hot-reload current utterance with fresh parameters
  const triggerHotReloadSpeech = () => {
    if (playStateRef.current === PlayState.PLAYING && sentencesRef.current.length > 0) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      // 새로운 릴리즈 컨텍스트 배차를 위해 미세 간격 후 다시 현 문장 읽기 작동
      setTimeout(() => {
        if (playStateRef.current === PlayState.PLAYING) {
          speakSentenceOfIndex(activeIndexRef.current);
        }
      }, 100);
    }
  };

  // Advanced server-side TTS assembler download handler
  const handleDownloadMp3 = async () => {
    if (sentences.length === 0) return;
    setDownloadingMp3(true);
    setError(null);
    try {
      // Find the dominant language to help fetch correct Translate voices
      const totalText = sentences.map(s => s.text).join(' ');
      const enCharCount = (totalText.match(/[a-zA-Z]/g) || []).length;
      const koCharCount = (totalText.match(/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/g) || []).length;
      const dominantLang = enCharCount > koCharCount ? 'en' : 'ko';

      const response = await fetch('/api/download-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: totalText,
          lang: dominantLang
        })
      });

      if (!response.ok) {
        throw new Error('서버가 MP3 파일 합성 도중 오류를 반환했습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const cleanName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "tts_doc_reading";
      link.download = `${cleanName}_TTS.mp3`;
      
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("MP3 export failure:", err);
      setError("MP3 오디오 내보내기에 실패했습니다: " + (err.message || err.toString()));
    } finally {
      setDownloadingMp3(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between" id="app-workspace">
      
      {/* 1. Header Toolbar */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-4 md:px-8 py-4 flex items-center justify-between select-none">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/10">
            <Headphones className="w-5 h-5 font-bold animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-base md:text-lg tracking-tight flex items-center gap-1.5 text-slate-100">
              PDF 오디오 리더
              <span className="text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded leading-none uppercase">
                Pro
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">문장 하이라이트 싱크 스마트 TTS 리더기</p>
          </div>
        </div>

        {/* PWA App Installation Actions */}
        <div className="flex items-center gap-2">
          {showInstallBadge && (
            <button
              onClick={handleInstallPwa}
              className="px-3.5 py-1.5 bg-gradient-to-tr from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer active:scale-95 transition-all shadow-md shadow-amber-500/15 animate-pulse"
              title="기기에 고성능 모바일 앱 형태로 바로 설치"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>앱 설치하기</span>
            </button>
          )}
          
          <button
            type="button"
            onClick={() => {
              // Custom interactive guide modal for reliable installs
              const message = `💡 안드로이드 및 모바일 기기 설치 가이드 :\n\n` +
                `1. 모바일 크롬(Chrome)이나 삼성 인터넷 브라우저로 이 사이트에 접속합니다.\n` +
                `2. 부가 기능 메뉴(점 3개 아이콘) 또는 하단 탭 바를 터치합니다.\n` +
                `3. 메뉴 목록 중 '홈 화면에 추가' or '앱 설치' 항목을 클릭합니다.\n` +
                `4. 홈 화면에 설치된 아이콘으로 접속하면, 주소창이 사라진 초고속 독립형(standalone) 오프라인 앱으로 즉석 실행됩니다!`;
              alert(message);
            }}
            className="px-3 py-1.5 text-[11px] text-slate-400 bg-slate-900/40 hover:bg-slate-900/90 hover:text-slate-200 border border-slate-800/60 rounded-xl flex items-center gap-1 cursor-pointer transition-colors duration-150"
          >
            <span>📱 모바일 설치 안내</span>
          </button>
        </div>

        {/* Right Active File Indicators */}
        <AnimatePresence mode="wait">
          {fileName && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center space-x-3"
              id="file-active-badge"
            >
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs text-slate-200 font-medium truncate max-w-[200px] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  {fileName}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  {sentences.length} Sentences Loaded
                </span>
              </div>
              
              <button
                type="button"
                onClick={handleResetWorkspace}
                className="px-3.5 py-1.5 md:py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold border border-slate-800 rounded-lg text-xs md:text-xs flex items-center space-x-1.5 cursor-pointer hover:border-slate-700 transition-all active:scale-95 duration-100"
                id="btn-replace"
              >
                <RefreshCw className="w-3 h-3" />
                <span className="hidden sm:inline">문서 바꾸기</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 flex flex-col items-center justify-center relative overflow-hidden">
        
        {/* Glow Effects */}
        <div className="absolute top-1/2 -translate-y-1/2 left-10 w-96 h-96 bg-amber-500/[0.02] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -translate-y-1/2 right-10 w-96 h-96 bg-indigo-500/[0.01] rounded-full blur-3xl pointer-events-none" />

        <AnimatePresence mode="wait">
          {!fileName ? (
            /* A. Drop / Upload Screen */
            <motion.div 
              key="uploader"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full flex items-center justify-center p-2"
            >
              <DropZone 
                onFileSelected={handleFileSelected} 
                onLoadSample={handleLoadSample}
                onGoogleDriveClick={() => setIsDriveModalOpen(true)}
                error={error} 
                loading={loading}
                parseProgress={parseProgress}
              />
            </motion.div>
          ) : (
            /* B. Split Reading Workspace */
            <motion.div 
              key="workspace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full h-[62vh] md:h-[68vh] grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6"
            >
              {/* Left Column: Full Original Document Preview with jump hooks */}
              <FullTextView 
                file={file}
                pages={pages}
                sentences={sentences}
                activeIndex={activeIndex}
                onSentenceClick={handleSentenceClick}
              />

              {/* Right Column: Sentence List Assist View */}
              <FocusListView 
                sentences={sentences}
                activeIndex={activeIndex}
                playState={playState}
                onSentenceClick={handleSentenceClick}
                autoScrollEnabled={autoScrollEnabled}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 3. Sticky Bottom Player Deck */}
      <AnimatePresence>
        {sentences.length > 0 && (
          <motion.footer
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="sticky bottom-0 z-30"
          >
            <PlayerControls
              playState={playState}
              onPlayPause={handlePlayPause}
              onStop={handleStop}
              onPrev={handlePrev}
              onNext={handleNext}
              activeIndex={activeIndex}
              totalSentences={sentences.length}
              onSeek={handleSeek}
              voices={voices}
              selectedVoiceName={selectedVoiceName}
              onVoiceChange={(vName) => {
                setSelectedVoiceName(vName);
                setTimeout(() => triggerHotReloadSpeech(), 30);
              }}
              rate={rate}
              onRateChange={(vRate) => {
                setRate(vRate);
                setTimeout(() => triggerHotReloadSpeech(), 30);
              }}
              pitch={pitch}
              onPitchChange={(vPitch) => {
                setPitch(vPitch);
                setTimeout(() => triggerHotReloadSpeech(), 30);
              }}
              autoScrollEnabled={autoScrollEnabled}
              onToggleAutoScroll={() => setAutoScrollEnabled(!autoScrollEnabled)}
              hybridEnabled={hybridEnabled}
              onToggleHybrid={() => setHybridEnabled(!hybridEnabled)}
              onDownloadMp3={handleDownloadMp3}
              downloadingMp3={downloadingMp3}
            />
          </motion.footer>
        )}
      </AnimatePresence>

      <GoogleDriveModal 
        isOpen={isDriveModalOpen} 
        onClose={() => setIsDriveModalOpen(false)} 
        onFileDownloaded={handleFileSelected} 
      />
    </div>
  );
}
