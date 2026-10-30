import React, { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../pwa/useOnlineStatus';

/**
 * Slim connectivity bar pinned to the top of the phone frame.
 * Offline: amber "showing last saved data". On reconnect: brief green
 * confirmation while AppContext reloads the session and data.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setShowBackOnline(false);
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setShowBackOnline(true);
      const timer = setTimeout(() => setShowBackOnline(false), 3200);
      return () => clearTimeout(timer);
    }
  }, [online]);

  if (!online) {
    return (
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-[70] mx-auto flex w-full max-w-[430px] items-center justify-center gap-2 bg-[#B45309] px-3 py-2 text-[12px] font-bold text-white shadow-md"
      >
        <WifiOff size={14} className="shrink-0" />
        You&apos;re offline · Showing last saved data
      </div>
    );
  }

  if (showBackOnline) {
    return (
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-[70] mx-auto flex w-full max-w-[430px] items-center justify-center gap-2 bg-[#137447] px-3 py-2 text-[12px] font-bold text-white shadow-md"
      >
        <Wifi size={14} className="shrink-0" />
        Back online · Updating…
      </div>
    );
  }

  return null;
}
