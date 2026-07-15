'use client';

import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  duration?: number; // ms
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  format?: (n: number) => string;
}

/**
 * Sanft hochzaehlende Zahl (requestAnimationFrame, kein externes Paket noetig).
 * SSR-sicher: startet erst nach Mount im Client.
 */
export function CountUp({ value, duration = 1200, decimals = 0, prefix = '', suffix = '', className, format }: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = Number.isFinite(value) ? value : 0;
    startRef.current = null;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      const current = from + (to - from) * easeOutCubic(t);
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  const text = format
    ? format(display)
    : `${prefix}${display.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

  return <span className={className}>{text}</span>;
}
