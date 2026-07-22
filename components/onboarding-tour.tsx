'use client';

import { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { buildTourSteps, TourStep } from '@/lib/nav-config';

interface Rect { top: number; left: number; width: number; height: number; }

/**
 * Dynamische, versionssichere Onboarding-Tour.
 *
 * Die Schritte kommen aus lib/nav-config (buildTourSteps). Wird ein Tab
 * umbenannt, traegt die Tour automatisch den neuen Namen, weil die
 * Beschriftung live aus NAV_TABS gelesen wird. Fehlende Ziele (z.B. Tabs,
 * die auf dem aktuellen Geraet im "Mehr"-Menue stecken) werden uebersprungen.
 *
 * Das hervorgehobene Element bleibt scharf, der Rest wird kraeftig
 * weichgezeichnet. Die Sprechblase erscheint je nach Platz ueber oder
 * unter dem Ziel.
 */
export function OnboardingTour({ onFinish }: { onFinish?: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => setMounted(true), []);

  // Nur Schritte behalten, deren Ziel es im aktuellen DOM auch gibt.
  useEffect(() => {
    if (!mounted) return;
    const all = buildTourSteps();
    const visible = all.filter((s) => document.querySelector(s.selector));
    setSteps(visible);
  }, [mounted]);

  const current = steps[index];

  const measure = useCallback(() => {
    if (!current) return;
    const el = document.querySelector(current.selector) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    const pad = 6;
    setRect({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
  }, [current]);

  useLayoutEffect(() => {
    if (!current) return;
    const el = document.querySelector(current.selector) as HTMLElement | null;
    if (el) {
      try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch {}
    }
    measure();
    const onScroll = () => measure();
    const onResize = () => measure();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    const t = setTimeout(measure, 120);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      clearTimeout(t);
    };
  }, [current, measure]);

  const finish = useCallback(() => {
    if (done) return;
    setDone(true);
    fetch('/api/profile/onboarding-done', { method: 'POST' }).catch(() => {});
    onFinish?.();
  }, [done, onFinish]);

  const next = () => {
    if (index >= steps.length - 1) { finish(); return; }
    setIndex((i) => i + 1);
  };
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  if (!mounted || done || steps.length === 0 || !current) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;

  // Sprechblasen-Position bestimmen (ueber oder unter dem Ziel).
  const tooltipWidth = Math.min(340, vw - 24);
  let tipTop = 0;
  let placeBelow = true;
  if (rect) {
    const estHeight = 210;
    placeBelow = rect.top + rect.height + estHeight + 16 < vh;
    tipTop = placeBelow ? rect.top + rect.height + 12 : Math.max(12, rect.top - estHeight - 12);
  } else {
    tipTop = vh / 2 - 100;
  }
  let tipLeft = rect ? rect.left + rect.width / 2 - tooltipWidth / 2 : vw / 2 - tooltipWidth / 2;
  tipLeft = Math.max(12, Math.min(tipLeft, vw - tooltipWidth - 12));

  const blurPanel = 'fixed bg-background/45 backdrop-blur-md';

  return createPortal(
    <div className="fixed inset-0 z-[200]" aria-live="polite">
      {/* Vier weichgezeichnete Flaechen rund um das Ziel. Das Ziel selbst
          bleibt frei und damit scharf. */}
      {rect ? (
        <>
          <div className={blurPanel} style={{ top: 0, left: 0, width: '100%', height: Math.max(0, rect.top) }} />
          <div className={blurPanel} style={{ top: rect.top + rect.height, left: 0, width: '100%', height: Math.max(0, vh - (rect.top + rect.height)) }} />
          <div className={blurPanel} style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }} />
          <div className={blurPanel} style={{ top: rect.top, left: rect.left + rect.width, width: Math.max(0, vw - (rect.left + rect.width)), height: rect.height }} />
          {/* Klick-Sperre ueber dem Ziel, damit die Tour nicht ungewollt wegspringt. */}
          <div className="fixed" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, cursor: 'default' }} />
          {/* Markierungsring */}
          <div
            className="fixed rounded-xl ring-2 ring-primary pointer-events-none"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: '0 0 0 4px rgba(30,64,175,0.25)' }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-background/45 backdrop-blur-md" />
      )}

      {/* Sprechblase */}
      <div
        className="fixed rounded-2xl bg-card text-card-foreground shadow-2xl border border-border p-4"
        style={{ top: tipTop, left: tipLeft, width: tooltipWidth }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-primary">{index + 1} von {steps.length}</span>
          <button onClick={finish} className="text-xs text-muted-foreground hover:text-foreground">Überspringen
          </button>
        </div>
        <h3 className="font-display text-base font-bold mb-1">{current.label}</h3>
        <p className="text-sm text-foreground/90 mb-1">{current.what}</p>
        <p className="text-sm text-muted-foreground mb-1">{current.where}</p>
        <p className="text-sm text-foreground/90">{current.benefit}</p>
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={prev}
            disabled={index === 0}
            className="text-sm px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >Zurück
          </button>
          <button
            onClick={next}
            className="text-sm px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90"
          >{index >= steps.length - 1 ? 'Fertig' : 'Weiter'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
