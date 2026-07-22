'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Clock, CalendarDays, Mail, Euro, AlertCircle, FileText, Bell, Users, CloudSun } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// ---- Modul-Katalog fuer das konfigurierbare Start-Widget (Item 3) ----
// kind 'core' = Teil des Hero-Kopfs (Uhr/Datum/Ticker), 'chip' = Info-Kachel.
export const WIDGET_MODULES = [
  { id: 'clock', label: 'Uhrzeit', kind: 'core' },
  { id: 'date', label: 'Datum', kind: 'core' },
  { id: 'ticker', label: 'Info-Ticker', kind: 'core' },
  { id: 'weather', label: 'Wetter', kind: 'chip' },
  { id: 'appointments', label: 'Termine (anstehend)', kind: 'chip' },
  { id: 'mails', label: 'Ungelesene Mails', kind: 'chip' },
  { id: 'revenue', label: 'Umsatz (Monat)', kind: 'chip' },
  { id: 'openAmount', label: 'Offene Beträge', kind: 'chip' },
  { id: 'openInvoices', label: 'Offene Rechnungen', kind: 'chip' },
  { id: 'reminders', label: 'Fällige Erinnerungen', kind: 'chip' },
  { id: 'customers', label: 'Kundenanzahl', kind: 'chip' },
] as const;

export type WidgetModuleId = typeof WIDGET_MODULES[number]['id'];
export interface WidgetConfig { modules: { id: string; enabled: boolean }[] }

// Standard: Uhr, Datum & Ticker an (= bisheriges Verhalten), Kacheln aus.
export const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  modules: WIDGET_MODULES.map((m) => ({ id: m.id, enabled: ['clock', 'date', 'ticker'].includes(m.id) })),
};

export interface WidgetData {
  customers?: number;
  openInvoices?: number;
  upcomingAppointments?: number;
  pendingReminders?: number;
  monthlyRevenue?: number;
  openAmount?: number;
}

/** Fuegt fehlende (neue) Module am Ende hinzu, damit Alt-Konfigs kompatibel bleiben. */
function normalizeConfig(config?: WidgetConfig | null): WidgetConfig {
  const base = config && Array.isArray(config.modules) && config.modules.length > 0 ? config : DEFAULT_WIDGET_CONFIG;
  const seen = new Set(base.modules.map((m) => m.id));
  const merged = [...base.modules];
  for (const m of WIDGET_MODULES) {
    if (!seen.has(m.id)) merged.push({ id: m.id, enabled: false });
  }
  return { modules: merged };
}

function weatherText(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: 'Klar' };
  if (code <= 2) return { icon: '🌤️', label: 'Leicht bewölkt' };
  if (code === 3) return { icon: '☁️', label: 'Bewölkt' };
  if (code <= 48) return { icon: '🌫️', label: 'Nebel' };
  if (code <= 67) return { icon: '🌧️', label: 'Regen' };
  if (code <= 77) return { icon: '🌨️', label: 'Schnee' };
  if (code <= 82) return { icon: '🌦️', label: 'Schauer' };
  if (code <= 99) return { icon: '⛈️', label: 'Gewitter' };
  return { icon: '🌡️', label: '—' };
}

/**
 * Lebendiger, pro Mitarbeiter konfigurierbarer Begruessungs-Streifen.
 * Zeigt Begruessung, optional Uhr/Datum/Ticker sowie frei waehlbare
 * Info-Kacheln (Wetter, Termine, Mails, Umsatz, ...). Vollstaendig
 * client-seitig initialisiert (keine Hydration-Konflikte).
 */
export function LiveTicker({ items, config, data, mailsUnread }: {
  items?: string[];
  config?: WidgetConfig | null;
  data?: WidgetData;
  mailsUnread?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [idx, setIdx] = useState(0);
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);

  const cfg = normalizeConfig(config);
  const enabled = (id: string) => cfg.modules.find((m) => m.id === id)?.enabled ?? false;
  const showClock = enabled('clock');
  const showDate = enabled('date');
  const showTicker = enabled('ticker');
  const showWeather = enabled('weather');

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  // Wetter laden – standortabhaengig anhand der PLZ des Mitarbeiters.
  // Die PLZ wird ueber /api/profile/status geladen, per zippopotam.us in
  // Koordinaten umgewandelt und dann bei open-meteo abgefragt. Faellt eine
  // Stufe aus, wird auf Malschwitz (~51.29 / 14.55) zurueckgegriffen.
  useEffect(() => {
    if (!mounted || !showWeather) return;
    let cancelled = false;

    const fetchWeather = async (lat: number, lon: number) => {
      const base = 'https' + '://api.open-meteo.com/v1/forecast';
      const url = base + '?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,weather_code';
      const res = await fetch(url);
      const j = await res.json();
      if (!cancelled && j?.current) {
        setWeather({ temp: Math.round(j.current.temperature_2m), code: j.current.weather_code });
      }
    };

    const resolveCoords = async (): Promise<{ lat: number; lon: number }> => {
      try {
        const sRes = await fetch('/api/profile/status');
        const s = await sRes.json();
        const zip = (s?.contactZip || '').toString().trim();
        if (zip) {
          const geoUrl = 'https' + '://api.zippopotam.us/de/' + encodeURIComponent(zip);
          const gRes = await fetch(geoUrl);
          if (gRes.ok) {
            const g = await gRes.json();
            const place = g?.places?.[0];
            const lat = parseFloat(place?.latitude);
            const lon = parseFloat(place?.longitude);
            if (isFinite(lat) && isFinite(lon)) return { lat, lon };
          }
        }
      } catch { /* ignorieren, Fallback unten */ }
      return { lat: 51.29, lon: 14.55 };
    };

    const load = async () => {
      try {
        const { lat, lon } = await resolveCoords();
        await fetchWeather(lat, lon);
      } catch { /* still ignorieren */ }
    };
    load();
    const iv = setInterval(load, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [mounted, showWeather]);

  const pool = (items && items.length > 0 ? items : [
    'Alles läuft rund. Schön, dass du da bist.',
    'Dein System ist auf dem neuesten Stand.',
    'Bereit für den nächsten Auftrag.',
    'Behalte deine Fristen im Blick, dann bleibt alles entspannt.',
    'Neue Tickets und Termine erscheinen automatisch hier.',
  ]);

  useEffect(() => {
    if (!mounted || !showTicker) return;
    const rot = setInterval(() => setIdx((i) => (i + 1) % pool.length), 5000);
    return () => clearInterval(rot);
  }, [mounted, showTicker, pool.length]);

  if (!mounted || !now) {
    return <div className="h-[92px] rounded-2xl shimmer" />;
  }

  const h = now.getHours();
  const greeting = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : h < 22 ? 'Guten Abend' : 'Gute Nacht';
  const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
  const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  // ---- Info-Kacheln in konfigurierter Reihenfolge aufbauen ----
  const chips: { key: string; icon: any; label: string; value: string }[] = [];
  for (const m of cfg.modules) {
    if (!m.enabled) continue;
    switch (m.id) {
      case 'weather':
        chips.push({ key: 'weather', icon: CloudSun, label: weather ? weatherText(weather.code).label : 'Wetter', value: weather ? `${weather.temp}°C ${weatherText(weather.code).icon}` : '…' });
        break;
      case 'appointments':
        chips.push({ key: 'appointments', icon: CalendarDays, label: 'Termine', value: `${data?.upcomingAppointments ?? 0}` });
        break;
      case 'mails':
        chips.push({ key: 'mails', icon: Mail, label: 'Ungelesen', value: mailsUnread == null ? '…' : `${mailsUnread}` });
        break;
      case 'revenue':
        chips.push({ key: 'revenue', icon: Euro, label: 'Umsatz', value: formatCurrency(data?.monthlyRevenue ?? 0) });
        break;
      case 'openAmount':
        chips.push({ key: 'openAmount', icon: AlertCircle, label: 'Offen', value: formatCurrency(data?.openAmount ?? 0) });
        break;
      case 'openInvoices':
        chips.push({ key: 'openInvoices', icon: FileText, label: 'Rechnungen', value: `${data?.openInvoices ?? 0}` });
        break;
      case 'reminders':
        chips.push({ key: 'reminders', icon: Bell, label: 'Erinnerungen', value: `${data?.pendingReminders ?? 0}` });
        break;
      case 'customers':
        chips.push({ key: 'customers', icon: Users, label: 'Kunden', value: `${data?.customers ?? 0}` });
        break;
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg"
      style={{ background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%)' }}
    >
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
            {showDate && <><span className="opacity-60">·</span><span className="capitalize truncate">{dateStr}</span></>}
          </div>
          <h2 className="mt-1 text-xl font-bold leading-tight">{greeting}</h2>
          {showTicker && (
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
          )}
        </div>
        {showClock && (
          <div className="text-right shrink-0">
            <div className="font-mono text-2xl font-bold tabular-nums leading-none">{timeStr}</div>
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-100">
              <Sparkles className="w-3 h-3" /> heute aktiv
            </div>
          </div>
        )}
      </div>

      {/* Konfigurierbare Info-Kacheln */}
      {chips.length > 0 && (
        <div className="relative mt-3 flex flex-wrap gap-2">
          {chips.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.key} className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-sm px-2.5 py-1.5">
                <Icon className="w-3.5 h-3.5 text-blue-50 shrink-0" />
                <span className="text-[13px] font-semibold tabular-nums">{c.value}</span>
                <span className="text-[11px] text-blue-100/80">{c.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
