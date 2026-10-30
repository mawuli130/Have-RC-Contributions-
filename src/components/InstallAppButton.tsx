import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, Download, Share } from 'lucide-react';
import { useInstallPrompt } from '../pwa/useInstallPrompt';

/**
 * "Install App" entry point.
 * - Android/Chrome: triggers the real install prompt when available,
 *   otherwise explains the ⋮ menu route.
 * - iPhone: explains Share → Add to Home Screen.
 * - Already installed: shows a quiet confirmation (row variant only).
 */
export function InstallAppButton({ variant = 'row' }: { variant?: 'welcome' | 'row' }) {
  const { canInstall, promptInstall, installed, isIOS } = useInstallPrompt();
  const [showHint, setShowHint] = useState(false);

  if (installed) {
    if (variant === 'welcome') return null;
    return (
      <div className="list-row" aria-label="App installed">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E7F5EE] text-[#137447]">
          <CheckCircle2 size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold text-navy-950">App installed</p>
          <p className="truncate text-[11.5px] text-slate-500">Have R/C 2022 is on your home screen</p>
        </div>
      </div>
    );
  }

  const handleClick = async () => {
    if (canInstall) {
      await promptInstall();
      return;
    }
    setShowHint((s) => !s);
  };

  const hint = isIOS ? (
    <>
      Tap the <Share size={12} className="inline -mt-0.5" /> Share button in Safari, then choose{' '}
      <strong>Add to Home Screen</strong>. The school crest will appear on your home screen like a
      normal app.
    </>
  ) : (
    <>
      Open the Chrome <strong>⋮ menu</strong> and tap <strong>Install app</strong> (or{' '}
      <strong>Add to Home screen</strong>). The school crest will appear on your home screen like a
      normal app.
    </>
  );

  if (variant === 'welcome') {
    return (
      <div className="shrink-0">
        <button
          type="button"
          onClick={handleClick}
          className="btn min-h-[46px] w-full border border-navy-200 bg-white text-[14.5px] font-bold text-navy-800"
          data-testid="install-app-button"
        >
          <Download size={17} />
          Install the App
        </button>
        {showHint ? (
          <p className="mt-2 rounded-xl border border-[#E3ECF7] bg-white px-3 py-2 text-[12px] leading-relaxed text-slate-600">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={handleClick} className="list-row" data-testid="install-app-button">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
          <Download size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold text-navy-950">Install App</p>
          <p className="truncate text-[11.5px] text-slate-500">Add Have R/C 2022 to your home screen</p>
        </div>
        <ChevronRight size={17} className="shrink-0 text-slate-300" />
      </button>
      {showHint ? (
        <p className="border-t border-[#EEF3FA] px-3.5 py-2.5 text-[12px] leading-relaxed text-slate-600">
          {hint}
        </p>
      ) : null}
    </>
  );
}
