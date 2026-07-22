'use client';

import { useState, useEffect } from 'react';
import { Save, ChevronUp, ChevronDown, Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { WIDGET_MODULES, DEFAULT_WIDGET_CONFIG } from '@/components/live-ticker';
import type { WidgetConfig } from '@/components/live-ticker';

const LABELS: Record<string, string> = Object.fromEntries(WIDGET_MODULES.map((m) => [m.id, m.label]));

/** Fuehrt Alt-Konfig + Katalog zusammen: alle Module vorhanden, Reihenfolge erhalten. */
function merge(config: WidgetConfig | null): { id: string; enabled: boolean }[] {
  const base = config && Array.isArray(config.modules) && config.modules.length > 0 ? config.modules : DEFAULT_WIDGET_CONFIG.modules;
  const seen = new Set(base.map((m) => m.id));
  const out = base.filter((m) => LABELS[m.id]).map((m) => ({ id: m.id, enabled: !!m.enabled }));
  for (const m of WIDGET_MODULES) if (!seen.has(m.id)) out.push({ id: m.id, enabled: false });
  return out;
}

export function StartseiteSettings() {
  const [modules, setModules] = useState<{ id: string; enabled: boolean }[]>(merge(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/profile/widget');
        const j = await res.json();
        setModules(merge(j?.config ?? null));
      } catch { setModules(merge(null)); }
      finally { setLoading(false); }
    })();
  }, []);

  const toggle = (id: string) => setModules((prev) => prev.map((m) => m.id === id ? { ...m, enabled: !m.enabled } : m));
  const move = (idx: number, dir: -1 | 1) => setModules((prev) => {
    const next = [...prev];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return prev;
    [next[idx], next[j]] = [next[j], next[idx]];
    return next;
  });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile/widget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { modules } }),
      });
      if (!res.ok) throw new Error();
      toast.success('Startseite gespeichert');
    } catch { toast.error('Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const reset = () => setModules(merge(null));

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-3">
      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2">
            <LayoutDashboard className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Stelle dein persönliches Start-Widget zusammen. Aktiviere die gewünschten Bausteine und bringe sie mit den Pfeilen in deine Wunsch-Reihenfolge. Die Auswahl gilt nur für dich.
            </p>
          </div>

          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {modules.map((m, idx) => (
              <div key={m.id} className={`flex items-center gap-2 p-2.5 ${m.enabled ? 'bg-background' : 'bg-muted/40'}`}>
                <div className="flex flex-col">
                  <button type="button" aria-label="nach oben" onClick={() => move(idx, -1)} disabled={idx === 0} className="p-0.5 text-muted-foreground disabled:opacity-30 press-scale"><ChevronUp className="w-4 h-4" /></button>
                  <button type="button" aria-label="nach unten" onClick={() => move(idx, 1)} disabled={idx === modules.length - 1} className="p-0.5 text-muted-foreground disabled:opacity-30 press-scale"><ChevronDown className="w-4 h-4" /></button>
                </div>
                <span className={`flex-1 text-sm ${m.enabled ? 'font-medium' : 'text-muted-foreground'}`}>{LABELS[m.id] ?? m.id}</span>
                <button
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium press-scale ${m.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                >
                  {m.enabled ? <><Eye className="w-3.5 h-3.5" /> An</> : <><EyeOff className="w-3.5 h-3.5" /> Aus</>}
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={reset}>Standard</Button>
            <Button className="flex-1 gap-2" onClick={save} disabled={saving}><Save className="w-4 h-4" />{saving ? 'Speichert...' : 'Speichern'}</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Hinweis: „Ungelesene Mails“ benötigt eine verbundene Gmail-Verbindung. „Wetter“ zeigt die aktuelle Lage für Malschwitz.</p>
        </CardContent>
      </Card>
    </div>
  );
}
