'use client';

import { useEffect, useRef } from 'react';
import { APP_VERSION } from '@/lib/version';
import { notifyVersionUpdate } from '@/lib/toast';

/**
 * Prueft im Hintergrund, ob auf dem Server eine neuere App-Version laeuft
 * als die aktuell im Browser geladene. Falls ja, erscheint ein persistenter
 * Hinweis mit "Jetzt neu laden" - auch fuer Mitarbeiter.
 */
export function VersionWatcher() {
  const notifiedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (notifiedRef.current) return;
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const serverVersion = String(data?.version || '').trim();
        if (!serverVersion) return;
        if (serverVersion !== APP_VERSION && !cancelled && !notifiedRef.current) {
          notifiedRef.current = true;
          notifyVersionUpdate(() => window.location.reload());
        }
      } catch {
        // still, kein Netz o.ae. - einfach beim naechsten Mal erneut versuchen.
      }
    }

    // Direkt nach dem Laden und danach alle 3 Minuten pruefen.
    const first = setTimeout(check, 8000);
    const interval = setInterval(check, 3 * 60 * 1000);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return null;
}
