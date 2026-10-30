import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectStandalone(): boolean {
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {
    // jsdom / older browsers: fall through
  }
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export interface InstallPromptState {
  /** Chrome/Android fired beforeinstallprompt — we can show a real install button. */
  canInstall: boolean;
  promptInstall: () => Promise<boolean>;
  /** Already running as the installed app. */
  installed: boolean;
  /** iPhone/iPad Safari (manual Share → Add to Home Screen flow). */
  isIOS: boolean;
}

export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => detectStandalone());
  const [isIOS] = useState<boolean>(() => detectIOS());

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferred(null);
      return true;
    }
    return false;
  }, [deferred]);

  return { canInstall: Boolean(deferred), promptInstall, installed, isIOS };
}
