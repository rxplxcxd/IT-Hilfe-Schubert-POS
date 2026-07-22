'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

/**
 * Lebendiger Begruessungs-Streifen fuer den Start-Bildschirm.
 * Zeigt eine tageszeitabhaengige Begruessung, eine live tickende Uhr
 * und rotierende, wechselnde Kurz-Infos, damit sich die App aktiv anfuehlt.
 * Vollstaendig client-seitig initialisiert (keine Hydration-Konflikte).
 */
export function LiveTicker({ items }: { items?: string[] }) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  const pool = (items && items.length > 0 ? items : [
    'Alles läuft rund. Schön, dass du da bist.',
    'Dein System ist auf dem neuesten Stand.',
    'Bereit für den nächsten Auftrag.',
    'Behalte deine Fristen im Blick, dann bleibt alles entspannt.',
    'Neue Tickets und Termine erscheinen automatisch hier.',
  ]);

  useEffect(() => {
    if (!mounted) return;
    const rot = setInterval(() => setIdx((i) => (i + 1) % pool.length), 5000);
    return () => clearInterval(rot);
  }, [mounted, pool.length]);

  if (!mounted || !now) {
    // Platzhalter mit gleicher Hoehe, um Layout-Spruenge zu vermeiden.
    return <div className="h-[92px] rounded-2xl shimmer" />;
  }

  const h = now.getHours();
  const greeting = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : h < 22 ? 'Guten Abend' : 'Gute Nacht';
  const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
  const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg"
      style={{ background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%)' }}
    >
      {/* animierte, weiche Lichtflaechen im Hintergrund */}
      <motion.div
        aria-hidden
        className="absolute -top-10 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl"
        animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-12 -left-6 w-36 h-36 rounded-full bg-sky-300/10 blur-2xl"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-blue-100 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span>Live</span>
            <span className="opacity-60">·</span>
            <span className="capitalize truncate">{dateStr}</span>
          </div>
          <h2 className="mt-1 text-xl font-bold leading-tight">{greeting}</h2>
          <div className="mt-1 h-5 relative">
            <AnimatePresence mode="wait">
              <motion.p
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 text-sm text-blue-50/90 truncate"
              >
                {pool[idx]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-2xl font-bold tabular-nums leading-none">{timeStr}</div>
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-100">
            <Sparkles className="w-3 h-3" /> heute aktiv
          </div>
        </div>
      </div>
    </motion.div>
  );
}
