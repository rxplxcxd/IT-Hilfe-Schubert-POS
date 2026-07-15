'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, Clock, Shield, User as UserIcon, Trash2, RefreshCw, Mail } from 'lucide-react';
import { notifySuccess, notifyError } from '@/lib/toast';
import { useNotifications } from '@/components/notification-provider';

interface AppUserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  approvedAt?: string | null;
  createdAt: string;
}

function statusBadge(status: string) {
  if (status === 'APPROVED')
    return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400 px-2 py-0.5 text-[11px] font-semibold"><Check className="w-3 h-3" />Freigegeben</span>;
  if (status === 'REJECTED')
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 px-2 py-0.5 text-[11px] font-semibold"><X className="w-3 h-3" />Abgelehnt</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 px-2 py-0.5 text-[11px] font-semibold"><Clock className="w-3 h-3" />Wartet</span>;
}

export function TeamSettings() {
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const { refresh } = useNotifications();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch {
      /* still */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: number, action: string, extra?: Record<string, any>) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(extra || {}) }),
      });
      if (!res.ok) throw new Error();
      if (action === 'approve')
        notifySuccess('Zugang freigegeben', 'Der Mitarbeiter wurde per E-Mail benachrichtigt und kann sich jetzt anmelden.');
      else if (action === 'reject')
        notifySuccess('Anfrage abgelehnt', 'Der Zugang wurde abgelehnt.');
      else notifySuccess('Aktualisiert', 'Die Änderung wurde gespeichert.');
      await load();
      refresh();
    } catch {
      notifyError('Aktion fehlgeschlagen', 'Die Änderung konnte nicht gespeichert werden.');
    } finally {
      setBusy(null);
    }
  };

  const del = async (id: number) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      notifySuccess('Benutzer entfernt', 'Der Zugang wurde gelöscht.');
      await load();
      refresh();
    } catch {
      notifyError('Löschen fehlgeschlagen');
    } finally {
      setBusy(null);
    }
  };

  const pending = users.filter((u) => u.status === 'PENDING');
  const others = users.filter((u) => u.status !== 'PENDING');

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Offene Anfragen */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Offene Registrierungsanfragen</h3>
              {pending.length > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {pending.length}
                </span>
              )}
            </div>
            <button onClick={load} className="text-muted-foreground hover:text-foreground transition-colors" title="Aktualisieren">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Keine offenen Anfragen. Alles erledigt.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.name || u.email}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" disabled={busy === u.id} onClick={() => act(u.id, 'approve')} className="gap-1 bg-green-600 hover:bg-green-700 text-white h-8 px-2.5">
                      <Check className="w-4 h-4" />Freigeben
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => act(u.id, 'reject')} className="gap-1 h-8 px-2.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alle Mitglieder */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3">Team-Mitglieder</h3>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Noch keine weiteren Mitglieder.</p>
          ) : (
            <div className="space-y-2">
              {others.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{u.name || u.email}</p>
                      {u.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 px-2 py-0.5 text-[11px] font-semibold"><Shield className="w-3 h-3" />Admin</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300 px-2 py-0.5 text-[11px] font-semibold"><UserIcon className="w-3 h-3" />Mitarbeiter</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(u.status)}
                    {u.status === 'REJECTED' && (
                      <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => act(u.id, 'approve')} className="h-8 px-2.5 gap-1 text-green-700 border-green-200 hover:bg-green-50 dark:border-green-900/50">
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    <button disabled={busy === u.id} onClick={() => del(u.id)} className="text-muted-foreground hover:text-red-600 transition-colors p-1" title="Entfernen">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground px-1 leading-relaxed">
        Neue Mitarbeiter können sich über die Registrierung anmelden. Erst nach deiner Freigabe hier erhalten sie Zugriff auf das Kassensystem.
      </p>
    </div>
  );
}
