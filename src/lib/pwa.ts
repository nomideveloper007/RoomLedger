import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

/**
 * Registers the Service Worker & global beforeinstallprompt listener immediately on boot
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined') return;

  // Capture beforeinstallprompt globally as early as possible (even on Login screen)
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    notifyListeners();
    console.log('[PWA] App successfully installed on device!');
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[PWA] Service Worker registered successfully with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }
}

/**
 * Hook to manage PWA Installation state and prompt
 */
export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState<boolean>(() => Boolean(deferredInstallPrompt));
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect if already installed (standalone mode)
    const checkInstalled = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsInstalled(checkInstalled());

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isAppleDevice);

    const syncState = () => {
      setIsInstallable(Boolean(deferredInstallPrompt));
      setIsInstalled(checkInstalled());
    };

    syncState();
    listeners.add(syncState);

    return () => {
      listeners.delete(syncState);
    };
  }, []);

  const triggerInstall = async (): Promise<boolean> => {
    if (deferredInstallPrompt) {
      try {
        await deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setIsInstallable(false);
          deferredInstallPrompt = null;
          notifyListeners();
          return true;
        }
        return false;
      } catch (err) {
        console.error('[PWA] Install prompt error:', err);
      }
    }

    // If native prompt is not ready (e.g. iOS Safari or browser requires manual menu install), show visual guide modal
    setShowIOSInstructions(true);
    return false;
  };

  return {
    isInstallable,
    isInstalled,
    isIOS,
    showIOSInstructions,
    setShowIOSInstructions,
    triggerInstall,
  };
}
