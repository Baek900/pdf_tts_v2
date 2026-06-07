/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Search, Cloud, LogOut, User, FileText, 
  RefreshCw, AlertCircle, Check, ArrowRight, Download 
} from 'lucide-react';
import { 
  googleSignIn, 
  googleSignOut, 
  listDrivePdfFiles, 
  downloadDriveFile, 
  getAccessToken,
  DriveFileItem 
} from '../utils/googleDrive';
import { User as FirebaseUser } from 'firebase/auth';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileDownloaded: (file: File) => void;
}

export default function GoogleDriveModal({ isOpen, onClose, onFileDownloaded }: GoogleDriveModalProps) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetchingFiles, setIsFetchingFiles] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);

  // Synchronize authentication tokens on load
  useEffect(() => {
    if (isOpen) {
      const activeToken = getAccessToken();
      if (activeToken) {
        setToken(activeToken);
        fetchDriveFiles(activeToken);
      }
    }
  }, [isOpen]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setCurrentUser(result.user);
        await fetchDriveFiles(result.accessToken);
      }
    } catch (err: any) {
      console.error('Google Sign-In integration error:', err);
      setError(err.message || '구글 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await googleSignOut();
      setToken(null);
      setCurrentUser(null);
      setFiles([]);
      setSelectedFileId(null);
    } catch (err: any) {
      console.error('Sign-out error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDriveFiles = async (authToken: string) => {
    setIsFetchingFiles(true);
    setError(null);
    try {
      const driveList = await listDrivePdfFiles(authToken);
      setFiles(driveList);
    } catch (err: any) {
      console.error('Drive listing error:', err);
      setError('구글 드라이브에서 PDF 파일을 가저올 수 없었습니다. 인증 권한을 새로고침 해주세요.');
      // If unauthorized token, invalidate local state
      setToken(null);
    } finally {
      setIsFetchingFiles(false);
    }
  };

  const handleSelectFile = async (fileItem: DriveFileItem) => {
    if (!token) return;
    setSelectedFileId(fileItem.id);
    setDownloadProgress('구글 클라우드에서 다이렉트 파일 전송을 개시합니다...');
    setError(null);

    try {
      const downloadedFile = await downloadDriveFile(token, fileItem.id, fileItem.name);
      setDownloadProgress('전송 완수 및 라이브 로드 완료!');
      setTimeout(() => {
        onFileDownloaded(downloadedFile);
        onClose();
        // Reset states
        setSelectedFileId(null);
        setDownloadProgress(null);
      }, 500);
    } catch (err: any) {
      console.error('Drive fetching transfer failed:', err);
      setError(err.message || '파일 전송에 실패하였습니다.');
      setSelectedFileId(null);
      setDownloadProgress(null);
    }
  };

  // Helper to format file sizes nicely
  const formatBytes = (bytesStr?: string) => {
    if (!bytesStr) return '크기 미상';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return '크기 미상';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Filter lists based on search parameter
  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-amber-500/5 flex flex-col max-h-[82vh] overflow-hidden z-10"
        id="google-drive-dialog"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base md:text-lg flex items-center gap-1.5">
                구글 드라이브 연동 리더
              </h3>
              <p className="text-xs text-slate-400">Google Drive에서 원하는 PDF 문서를 직접 로드합니다.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col">
          {!token ? (
            /* A. Require Connection screen */
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center space-y-6">
              <div className="p-5 bg-amber-500/5 border border-amber-500/10 text-amber-500 rounded-full animate-bounce">
                <Cloud className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-slate-200">구글 계정 연결이 필요합니다</h4>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  구글 드라이브의 PDF 문서를 직접 분석하기 위해 안전한 Google OAuth 보안 인증 단계를 진행합니다.
                </p>
              </div>

              {/* GSI style styled button */}
              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="gsi-material-button hover:shadow-lg transition-all active:scale-98 cursor-pointer"
                id="btn-drive-login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'white',
                  borderRadius: '12px',
                  border: 'none',
                  padding: '12px 24px',
                  color: '#1e293b',
                  fontSize: '14px',
                  fontWeight: '600',
                  gap: '12px',
                  fontFamily: 'system-ui'
                }}
              >
                <div style={{ display: 'flex', width: '20px', height: '20px' }}>
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span>Google 계정으로 계속하기</span>
              </button>

              {isLoading && (
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                  <span>인증 자격 검수중...</span>
                </div>
              )}
            </div>
          ) : (
            /* B. Browse Documents screen */
            <div className="flex-1 flex flex-col space-y-4 min-h-0">
              {/* Profile Bar */}
              <div className="bg-slate-950 px-4 py-3 rounded-xl flex items-center justify-between border border-slate-800 text-xs text-slate-300">
                <div className="flex items-center space-x-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-slate-950 font-bold font-mono text-[10px]">
                    G
                  </div>
                  <span className="font-medium text-slate-200">구글 드라이브와 안전하게 연동되었습니다</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 hover:text-rose-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>연동 해제</span>
                </button>
              </div>

              {/* Search Control Box */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="PDF 파일 제목 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              {/* File Browser Grid */}
              <div className="flex-1 border border-slate-800 rounded-xl overflow-hidden bg-slate-950 flex flex-col min-h-[300px]">
                {isFetchingFiles ? (
                  <div className="flex-grow flex flex-col items-center justify-center p-8 text-slate-400 space-y-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                    <span className="text-xs">드라이브에서 PDF 파일을 검토하고 있습니다...</span>
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="flex-grow flex flex-col items-center justify-center p-8 text-center space-y-3 text-slate-500">
                    <BookOpenIcon />
                    <div>
                      <p className="text-sm font-medium text-slate-300">표시할 PDF가 없습니다</p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                        {searchQuery ? '검색어와 부합하는 PDF가 드라이브 안에 발견되지 않았습니다.' : '구글 드라이브에 등록된 PDF 파일이 없거나 검색 권한 요구 단계입니다.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-y-auto divide-y divide-slate-900 max-h-[360px]">
                    {filteredFiles.map((fileItem) => {
                      const isDownloadingThis = selectedFileId === fileItem.id;
                      return (
                        <div 
                          key={fileItem.id}
                          className="px-4 py-3.5 hover:bg-slate-900/60 transition-colors flex items-center justify-between group cursor-pointer text-left"
                          onClick={() => {
                            if (!selectedFileId) handleSelectFile(fileItem);
                          }}
                        >
                          <div className="flex items-center space-x-3.5 min-w-0 pr-4">
                            <div className="w-8.5 h-8.5 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400 shrink-0">
                              <FileText className="w-4.5 h-4.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-slate-200 font-semibold truncate group-hover:text-amber-400 transition-colors">
                                {fileItem.name}
                              </p>
                              <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5 font-mono">
                                <span>{formatBytes(fileItem.size)}</span>
                                <span className="text-slate-750">•</span>
                                <span>
                                  {fileItem.modifiedTime 
                                    ? new Date(fileItem.modifiedTime).toLocaleDateString('ko-KR', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                      })
                                    : '날짜 알 수 없음'
                                  }
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 pl-2">
                            {isDownloadingThis ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                            ) : (
                              <button
                                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-amber-400 group-hover:border-amber-500/20 group-hover:bg-amber-500/5 transition-all text-xs"
                                title="다운로드"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Download Loader Info Banner */}
          {downloadProgress && (
            <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-between text-xs text-amber-300">
              <div className="flex items-center space-x-2.5">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
                <span className="font-semibold">{downloadProgress}</span>
              </div>
              <span className="text-[10px] font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400">
                PDF STREAMING
              </span>
            </div>
          )}

          {/* General Errors block */}
          {error && (
            <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/15 text-rose-300 text-xs font-semibold flex items-start space-x-2.5">
              <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 text-right">
          <p className="text-[10px] text-slate-500 select-none">
            모든 파일 트래픽은 Google API의 엔드투엔드 암호화 흐름을 장착하여 철저하게 격리 수송됩니다.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function BookOpenIcon() {
  return (
    <svg className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}
