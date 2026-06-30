// NoteForge — 在线状态检测 Hook

import { useState, useEffect, useCallback } from 'react';

type OnlineStatus = 'online' | 'offline' | 'unknown';

export function useOnlineStatus() {
  const [status, setStatus] = useState<OnlineStatus>(
    typeof navigator !== 'undefined' ? (navigator.onLine ? 'online' : 'offline') : 'unknown'
  );

  const goOnline = useCallback(() => setStatus('online'), []);
  const goOffline = useCallback(() => setStatus('offline'), []);

  useEffect(() => {
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [goOnline, goOffline]);

  return {
    isOnline: status === 'online',
    isOffline: status === 'offline',
    status,
  };
}
