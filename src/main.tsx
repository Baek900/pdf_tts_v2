// Polyfill Promise.withResolvers for older browser (e.g. older Safari/iOS) compatibility
if (typeof (Promise as any).withResolvers === 'undefined') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Polyfill URL.canParse for platforms lacking it (e.g., Safari/iOS < 17.0)
if (typeof (URL as any).canParse === 'undefined') {
  (URL as any).canParse = function (url: string | URL, base?: string | URL) {
    try {
      new URL(url as string, base);
      return true;
    } catch {
      return false;
    }
  };
}

// Polyfill ReadableStream Symbol.asyncIterator for systems lacking native async stream iteration (Safari < 17.0)
if (typeof ReadableStream !== 'undefined' && !ReadableStream.prototype[Symbol.asyncIterator]) {
  ReadableStream.prototype[Symbol.asyncIterator] = function () {
    const reader = this.getReader();
    return {
      async next() {
        try {
          const { done, value } = await reader.read();
          return { done, value };
        } catch (e) {
          reader.releaseLock();
          throw e;
        }
      },
      async return() {
        reader.releaseLock();
        return { done: true, value: undefined };
      }
    };
  };
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register standard mobile Progressive Web App service worker in production
if ('serviceWorker' in navigator) {
  if ((import.meta as any).env?.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker successfully registered layout:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err));
    });
  } else {
    // Unregister any active service worker in development sandbox to prevent aggressive stale caching
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) console.log('Dev sandbox service worker successfully unregistered');
        });
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
