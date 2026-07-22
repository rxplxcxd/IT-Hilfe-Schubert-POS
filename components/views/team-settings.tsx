'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X, Clock, Shield, User as UserIcon, Trash2, RefreshCw, Mail, ArrowLeft, ChevronRight, Phone, MapPin, Users, FileText, ShoppingCart, Euro, Loader2, AtSign, Save } from 'lucide-react';
import { notifySuccess, notifyError } from '@/lib/toast';
import { useNotifications } from '@/components/notification-provider';
import { employeeCode, formatCurrency } from '@/lib/utils';

interface AppUserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  employeeNo?: number | null;
  emailPrefix?: string;
  contactStreet?: string;
  contactZip?: string;
  contactCity?: string;
  contactPhone?: string;
  approvedAt?: string | null;
  createdAt: string;
}

interface MemberDetail {
  user: AppUserRow;
  customers: { id: number; firstName: string; lastName: string; city: string; phone: string }[];
  stats: { customerCount: number; invoiceCount: number; orderCount: number; revenue: number };
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
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mailDomain, setMailDomain] = useState('ithilfeschubert.xyz');
  const [prefixInput, setPrefixInput] = useState('');
  const [savingPrefix, setSavingPrefix] = useState(false);

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.mailDomain) setMailDomain(d.mailDomain); })
      .catch(() => {});
  }, []);

  const openDetail = useCallback(async (id: number) => {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/users/${id}`, { cache: 'no-store' });
      if (!res.ok) { notifyError('Details konnten nicht geladen werden'); setDetailId(null); return; }
      const data = await res.json();
      setDetail(data);
      setPrefixInput((data?.user?.emailPrefix || '').trim());
    } catch {
      notifyError('Fehler beim Laden');
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

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

  const savePrefix = async () => {
    if (detailId == null) return;
    setSavingPrefix(true);
    try {
      const clean = prefixInput.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      const res = await fetch(`/api/users/${detailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prefix', emailPrefix: clean }),
      });
      if (!res.ok) throw new Error();
      setPrefixInput(clean);
      setDetail((prev) => (prev ? { ...prev, user: { ...prev.user, emailPrefix: clean } } : prev));
      notifySuccess('Firmen-Adresse gespeichert', clean ? `${clean}@${mailDomain}` : 'Zuordnung entfernt.');
      await load();
    } catch {
      notifyError('Speichern fehlgeschlagen', 'Die Firmen-Adresse konnte nicht gespeichert werden.');
    } finally {
      setSavingPrefix(false);
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

  // --- Mitarbeiter-Detailansicht ---
  if (detailId != null) {
    const u = detail?.user;
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setDetailId(null); setDetail(null); }} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Zurück zum Team
        </Button>

        {detailLoading || !detail || !u ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <Card className="shadow-sm"><CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {(u.name || u.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{u.name || u.email}</p>
                    {u.role === 'ADMIN' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 px-2 py-0.5 text-[11px] font-semibold"><Shield className="w-3 h-3" />Admin</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300 px-2 py-0.5 text-[11px] font-semibold">{employeeCode(u.employeeNo) || 'Mitarbeiter'}</span>
                    )}
                    {statusBadge(u.status)}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</p>
                </div>
              </div>
              {(u.contactPhone || u.contactStreet || u.contactCity) && (
                <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border">
                  {u.contactPhone && <p className="flex items-center gap-1.5 pt-2"><Phone className="w-3 h-3" />{u.contactPhone}</p>}
                  {(u.contactStreet || u.contactCity) && <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{[u.contactStreet, [u.contactZip, u.contactCity].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>}
                </div>
              )}
            </CardContent></Card>

            {/* Firmen-E-Mail-Adresse zuweisen */}
            <Card className="shadow-sm"><CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AtSign className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Firmen-E-Mail-Adresse</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Lege den vorderen Teil der Firmen-Adresse fest. Eingehende Mails an diese Adresse werden per Weiterleitung an das private Gmail dieses Mitarbeiters zugestellt und in der App nur ihm angezeigt.
              </p>
              <div className="flex items-stretch gap-2">
                <div className="flex items-center flex-1 rounded-md border border-input bg-background overflow-hidden">
                  <Input
                    value={prefixInput}
                    onChange={(e: any) => setPrefixInput(e.target.value)}
                    placeholder="z.B. max"
                    className="border-0 focus-visible:ring-0 flex-1 min-w-0"
                    inputMode="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <span className="px-2 text-xs text-muted-foreground shrink-0 whitespace-nowrap">@{mailDomain}</span>
                </div>
                <Button onClick={savePrefix} disabled={savingPrefix} className="gap-1.5 shrink-0">
                  {savingPrefix ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Speichern
                </Button>
              </div>
              {(u.emailPrefix || '').trim() ? (
                <p className="text-xs text-muted-foreground">Aktuelle Adresse: <span className="font-semibold text-primary">{u.emailPrefix}@{mailDomain}</span></p>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">Noch keine Adresse zugewiesen.</p>
              )}
            </CardContent></Card>

            {/* Kennzahlen (vorbereitet fuer spaetere Auswertungen) */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={<Users className="w-4 h-4" />} label="Kunden" value={String(detail.stats.customerCount)} />
              <StatCard icon={<FileText className="w-4 h-4" />} label="Rechnungen" value={String(detail.stats.invoiceCount)} />
              <StatCard icon={<ShoppingCart className="w-4 h-4" />} label="Aufträge" value={String(detail.stats.orderCount)} />
              <StatCard icon={<Euro className="w-4 h-4" />} label="Umsatz (bezahlt)" value={formatCurrency(detail.stats.revenue)} />
            </div>

            <Card className="shadow-sm"><CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3">Zugeordnete Kunden ({detail.customers.length})</h3>
              {detail.customers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Noch keine Kunden zugeordnet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.customers.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {(c.firstName?.[0] ?? '')}{(c.lastName?.[0] ?? '')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{c.firstName} {c.lastName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{c.phone || '-'}</span>
                          {(c.city || '').trim() && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{c.city}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </>
        )}
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
                  <button onClick={() => openDetail(u.id)} className="min-w-0 flex items-center gap-2 text-left flex-1 group">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{u.name || u.email}</p>
                        {u.role === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 px-2 py-0.5 text-[11px] font-semibold"><Shield className="w-3 h-3" />Admin</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300 px-2 py-0.5 text-[11px] font-semibold"><UserIcon className="w-3 h-3" />{employeeCode(u.employeeNo) || 'Mitarbeiter'}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
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
        Neue Mitarbeiter können sich über die Registrierung anmelden. Erst nach deiner Freigabe hier erhalten sie Zugriff auf das Kassensystem. Tippe auf ein Mitglied, um dessen Kunden und Kennzahlen zu sehen.
      </p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3 bg-card">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">{icon}<span>{label}</span></div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
