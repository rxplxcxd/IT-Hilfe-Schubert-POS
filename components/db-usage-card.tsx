'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { notifyWarning } from '@/lib/toast';

interface DbUsage {
  usedBytes: number;
  limitBytes: number;
  freeBytes: number;
  percent: number;
  level: 'ok' | 'warn' | 'critical';
}

function fmt(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

/**
 * Zeigt die reale Speicherauslastung der Datenbank (nur fuer Admins sichtbar,
 * die API liefert fuer alle anderen 403 und die Karte bleibt verborgen).
 * Warnt automatisch per Toast, sobald es kritisch wird.
 */
export function DbUsageCard() {
  const [usage, setUsage] = useState<DbUsage | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/db-usage', { cache: 'no-store' });
        if (!res.ok) { setHidden(true); return; }
        const data: DbUsage = await res.json();
        if (cancelled) return;
        setUsage(data);
        if (data.level === 'critical') {
          notifyWarning('Speicher wird knapp', `Die Datenbank ist zu ${data.percent}% gefüllt. Bald aufräumen oder Speicher erweitern.`);
        }
      } catch {
        setHidden(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (hidden || !usage) return null;

  const barColor = usage.level === 'critical' ? 'bg-red-500' : usage.level === 'warn' ? 'bg-amber-500' : 'bg-emerald-500';
  const ringColor = usage.level === 'critical'
    ? 'border-red-200 bg-red-50/60 dark:bg-red-950/30 dark:border-red-800'
    : usage.level === 'warn'
      ? 'border-amber-200 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-800'
      : 'border-border';
  const statusText = usage.level === 'critical'
    ? 'Kritisch – bitte bald Speicher freigeben.'
    : usage.level === 'warn'
      ? 'Wird langsam voll – im Auge behalten.'
      : 'Alles im grünen Bereich.';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className={`shadow-sm ${ringColor}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Datenbank-Speicher</p>
                <p className="text-xs text-muted-foreground">{fmt(usage.usedBytes)} von {fmt(usage.limitBytes)} belegt</p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono text-lg font-bold">{usage.percent}%</span>
            </div>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${barColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(2, usage.percent)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {usage.level === 'ok'
              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              : <AlertTriangle className={`w-3.5 h-3.5 ${usage.level === 'critical' ? 'text-red-600' : 'text-amber-600'}`} />}
            <span className="text-muted-foreground">{statusText} Noch {fmt(usage.freeBytes)} frei.</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
