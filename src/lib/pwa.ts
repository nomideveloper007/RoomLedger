import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Registers the Service Worker for offline capability & PWA installability
 */
export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
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
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect if already installed (standalone mode)
    const checkInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsInstalled(checkInstalled);

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isAppleDevice);

    // If deferredPrompt was already captured globally
    if (deferredInstallPrompt) {
      setIsInstallable(true);
    }

    // Listen for beforeinstallprompt event (Chrome, Android, Edge, etc.)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredInstallPrompt = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      deferredInstallPrompt = null;
      console.log('[PWA] App successfully installed on device!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = async (): Promise<boolean> => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return false;
    }

    if (!deferredInstallPrompt) {
      // Fallback for browsers that support install without beforeinstallprompt
      alert("To install RoomLedger on your phone:\n\n1. Tap your browser's menu (⋮ or Share icon)\n2. Select 'Install App' or 'Add to Home Screen'");
      return false;
    }

    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        deferredInstallPrompt = null;
        return true;
      }
    } catch (err) {
      console.error('[PWA] Install prompt error:', err);
    }
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

