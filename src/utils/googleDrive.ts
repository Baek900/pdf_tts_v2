/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Reuse existing Firebase app instance or initialize a new one
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Drive Read-Only Scope
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.setCustomParameters({
  prompt: 'select_account'
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state and handle session cache (or refresh on load if needed)
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

// Google Sign-In Trigger
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Drive 인증 토큰을 획득하지 못했습니다.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Core Google Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Logout Trigger
export const googleSignOut = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Retrieve Cached In-Memory Access Token
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Set Cached Access Token (useful if restoring from credentials callback)
export const setAccessToken = (token: string | null): void => {
  cachedAccessToken = token;
};

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

/**
 * Lists PDF files in the user's Google Drive.
 */
export const listDrivePdfFiles = async (token: string): Promise<DriveFileItem[]> => {
  const query = encodeURIComponent("mimeType = 'application/pdf' and trashed = false");
  const fields = encodeURIComponent("files(id, name, mimeType, size, modifiedTime)");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=40`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Failed listing Drive PDFs:', errorBody);
    throw new Error('구글 드라이브 파일 목록을 조회하지 못했습니다.');
  }

  const data = await response.json();
  return data.files || [];
};

/**
 * Downloads a binary PDF file from Google Drive and converts it into a standard File object.
 */
export const downloadDriveFile = async (
  token: string,
  fileId: string,
  fileName: string
): Promise<File> => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Failed downloading Drive file:', errorBody);
    throw new Error('파일 데이터를 구글 드라이브에서 수신하지 못했습니다.');
  }

  const blob = await response.blob();
  return new File([blob], fileName, { type: 'application/pdf' });
};
