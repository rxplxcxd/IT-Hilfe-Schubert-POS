'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, ArrowLeft, Send, Paperclip, X, LifeBuoy, Image as ImageIcon,
  Video as VideoIcon, Loader2, ShieldCheck, User as UserIcon, Search, Filter,
  Clock, CalendarClock, Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatDateTime, employeeCode } from '@/lib/utils';
import { useNotifications } from '@/components/notification-provider';

interface Attachment {
  id?: number;
  url: string;
  filePath?: string;
  kind: string; // image | video
  caption?: string;
}
interface Message {
  id: number;
  authorId: number;
  authorName: string;
  authorRole: string;
  body: string;
  attachments?: string; // JSON-String
  createdAt: string;
}
interface Ticket {
  id: number;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdById: number;
  createdByName: string;
  createdByNo: number | null;
  adminUnread: boolean;
  employeeUnread: boolean;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
  messages?: Message[];
  _count?: { messages: number };
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  OFFEN: { label: 'Offen', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  IN_BEARBEITUNG: { label: 'In Bearbeitung', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  ERLEDIGT: { label: 'Erledigt', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
};
const PRIO_META: Record<string, { label: string; cls: string }> = {
  NIEDRIG: { label: 'Niedrig', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300' },
  NORMAL: { label: 'Normal', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  HOCH: { label: 'Hoch', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
};
const PRIO_RANK: Record<string, number> = { HOCH: 0, NORMAL: 1, NIEDRIG: 2 };

// 10 Kategorien inkl. "Sonstiges".
const CATEGORY_META: Record<string, { label: string; cls: string }> = {
  HARDWARE: { label: 'Hardware', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' },
  SOFTWARE: { label: 'Software', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  NETZWERK: { label: 'Netzwerk', cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300' },
  ABRECHNUNG: { label: 'Abrechnung', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  KUNDE: { label: 'Kunde', cls: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300' },
  TERMIN: { label: 'Termin', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' },
  ZUGANG: { label: 'Zugang / Passwort', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  APP: { label: 'App / System', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  MATERIAL: { label: 'Material / Bestellung', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  SONSTIGES: { label: 'Sonstiges', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300' },
};
const CATEGORY_ORDER = ['HARDWARE', 'SOFTWARE', 'NETZWERK', 'ABRECHNUNG', 'KUNDE', 'TERMIN', 'ZUGANG', 'APP', 'MATERIAL', 'SONSTIGES'];

const selectCls = 'h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// ---- Frist-Logik: Countdown + rote Markierung bei Ueberschreitung ----
interface DeadlineInfo {
  label: string;
  short: string;
  isOverdue: boolean;
  cls: string; // Badge-Klassen
}
function getDeadlineInfo(dueDate?: string | null, status?: string): DeadlineInfo | null {
  if (!dueDate) return null;
  const due = new Date(dueDate).getTime();
  if (isNaN(due)) return null;
  const done = status === 'ERLEDIGT';
  const diff = due - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const human = mins < 60 ? `${Math.max(mins, 1)} Min` : hours < 24 ? `${hours} Std` : `${days} Tag${days === 1 ? '' : 'e'}`;

  if (done) {
    return { label: 'Frist erledigt', short: 'Erledigt', isOverdue: false,
      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' };
  }
  if (diff < 0) {
    return { label: `Überfällig seit ${human}`, short: `Überfällig · ${human}`, isOverdue: true,
      cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' };
  }
  // Dringlich: weniger als 24 Std
  if (diff < 86400000) {
    return { label: `Fällig in ${human}`, short: `Noch ${human}`, isOverdue: false,
      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' };
  }
  return { label: `Fällig in ${human}`, short: `Noch ${human}`, isOverdue: false,
    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' };
}

// Wandelt ein Date in den Wert fuer <input type="datetime-local"> (lokale Zeit) um.
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Anhaenge sicher aus dem JSON-Feld einer Nachricht lesen.
function parseMsgAttachments(raw?: string): Attachment[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function TicketsView({ isAdmin }: { isAdmin: boolean }) {
  const { refresh } = useNotifications();
  const [mode, setMode] = useState<'list' | 'new' | 'detail'>('list');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [prioFilter, setPrioFilter] = useState('ALL');
  const [employeeFilter, setEmployeeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('PRIO'); // PRIO | NEUESTE | AELTESTE | ALTER

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tickets', { cache: 'no-store' });
      const json = await res.json();
      setTickets(Array.isArray(json) ? json : []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const openDetail = useCallback(async (id: number) => {
    setMode('detail');
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/tickets/${id}`, { cache: 'no-store' });
      if (!res.ok) { toast.error('Ticket konnte nicht geladen werden'); setMode('list'); return; }
      const json = await res.json();
      setDetail(json);
      refresh();
    } catch (e) { console.error(e); toast.error('Fehler beim Laden'); setMode('list'); }
    finally { setDetailLoading(false); }
  }, [refresh]);

  // Mitarbeiter-Liste fuer den Filter (nur Admin) aus vorhandenen Tickets ableiten.
  const employeeOptions = (() => {
    const map = new Map<string, string>();
    tickets.forEach((t) => {
      const key = String(t.createdById);
      if (!map.has(key)) {
        const code = t.createdByNo ? ` (${employeeCode(t.createdByNo)})` : '';
        map.set(key, `${t.createdByName}${code}`);
      }
    });
    return Array.from(map.entries());
  })();

  // Filter + Sortierung
  const filteredTickets = tickets
    .filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && (t.category || 'SONSTIGES') !== categoryFilter) return false;
      if (prioFilter !== 'ALL' && t.priority !== prioFilter) return false;
      if (isAdmin && employeeFilter !== 'ALL' && String(t.createdById) !== employeeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const haystack = `${t.ticketNumber} ${t.subject} ${t.createdByName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'NEUESTE') return +new Date(b.createdAt) - +new Date(a.createdAt);
      if (sortBy === 'AELTESTE' || sortBy === 'ALTER') return +new Date(a.createdAt) - +new Date(b.createdAt);
      // PRIO (Standard): hoechste Dringlichkeit zuerst, dann neueste zuerst.
      const pr = (PRIO_RANK[a.priority] ?? 1) - (PRIO_RANK[b.priority] ?? 1);
      if (pr !== 0) return pr;
      return +new Date(b.updatedAt) - +new Date(a.updatedAt);
    });

  // ---- LIST ----
  if (mode === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <LifeBuoy className="h-6 w-6 text-primary" /> Tickets
            </h2>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'Support-Anfragen deiner Mitarbeiter' : 'Deine Support-Anfragen an den Admin'}
            </p>
          </div>
          <Button onClick={() => setMode('new')} className="gap-1.5">
            <Plus className="h-4 w-4" /> Neu
          </Button>
        </div>

        {/* Suche + Status */}
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 relative min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Ticket suchen..." value={searchQuery} onChange={(e: any) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {['ALL', 'OFFEN', 'IN_BEARBEITUNG', 'ERLEDIGT'].map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`py-1.5 px-3 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  statusFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                {f === 'ALL' ? 'Alle' : (STATUS_META[f]?.label || f)}
              </button>
            ))}
          </div>
        </div>

        {/* Filter + Sortierung */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Filter className="h-3.5 w-3.5" /> Filter:</span>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectCls} aria-label="Kategorie">
            <option value="ALL">Alle Kategorien</option>
            {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
          </select>
          <select value={prioFilter} onChange={(e) => setPrioFilter(e.target.value)} className={selectCls} aria-label="Dringlichkeit">
            <option value="ALL">Alle Dringlichkeiten</option>
            <option value="HOCH">Hoch</option>
            <option value="NORMAL">Normal</option>
            <option value="NIEDRIG">Niedrig</option>
          </select>
          {isAdmin && employeeOptions.length > 0 && (
            <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={selectCls} aria-label="Mitarbeiter">
              <option value="ALL">Alle Mitarbeiter</option>
              {employeeOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          )}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectCls} aria-label="Sortierung">
            <option value="PRIO">Sortieren: Dringlichkeit</option>
            <option value="NEUESTE">Sortieren: Neueste zuerst</option>
            <option value="ALTER">Sortieren: Alter (älteste zuerst)</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filteredTickets.length === 0 ? (
          <Card><CardContent className="py-14 text-center text-muted-foreground">
            <LifeBuoy className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{tickets.length === 0 ? 'Noch keine Tickets vorhanden.' : 'Keine Tickets für diesen Filter.'}</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2.5">
            {filteredTickets.map((t) => {
              const st = STATUS_META[t.status] || STATUS_META.OFFEN;
              const pr = PRIO_META[t.priority] || PRIO_META.NORMAL;
              const cat = CATEGORY_META[t.category] || CATEGORY_META.SONSTIGES;
              const unread = isAdmin ? t.adminUnread : t.employeeUnread;
              const dl = getDeadlineInfo(t.dueDate, t.status);
              return (
                <Card key={t.id} onClick={() => openDetail(t.id)}
                  className={`cursor-pointer transition-shadow hover:shadow-md ${dl?.isOverdue ? 'border-red-300 dark:border-red-500/40 ring-1 ring-red-200 dark:ring-red-500/20 bg-red-50/40 dark:bg-red-500/5' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {unread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-label="ungelesen" />}
                          <span className="font-mono text-xs text-muted-foreground">{t.ticketNumber}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${pr.cls}`}>{pr.label}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cat.cls}`}>{cat.label}</span>
                          {dl && (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${dl.cls}`}>
                              <Clock className="h-3 w-3" />{dl.short}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold mt-1.5 truncate">{t.subject}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {isAdmin && (
                            <span className="inline-flex items-center gap-1">
                              <UserIcon className="h-3 w-3" />
                              {t.createdByName}{t.createdByNo ? ` (${employeeCode(t.createdByNo)})` : ''}
                            </span>
                          )}
                          <span>{formatDateTime(t.updatedAt)}</span>
                          {(t._count?.messages ?? 0) > 0 && <span>{t._count?.messages} Nachricht(en)</span>}
                          {(t.attachments?.length ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{t.attachments?.length}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---- NEW ----
  if (mode === 'new') {
    return <NewTicket onCancel={() => setMode('list')} onCreated={() => { setMode('list'); fetchList(); refresh(); }} />;
  }

  // ---- DETAIL ----
  return (
    <TicketDetail
      isAdmin={isAdmin}
      ticket={detail}
      loading={detailLoading}
      onBack={() => { setMode('list'); setDetail(null); fetchList(); refresh(); }}
      onChanged={(t) => setDetail(t)}
      afterMutate={() => { fetchList(); refresh(); }}
    />
  );
}

// Gemeinsamer Datei-Upload (Foto/Video) -> gibt Attachment zurueck.
async function uploadFile(file: File): Promise<Attachment> {
  const isVideo = file.type.startsWith('video/');
  const presignRes = await fetch('/api/upload/presigned', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: `ticket-${Date.now()}-${file.name}`, contentType: file.type, isPublic: true }),
  });
  const { uploadUrl, cloud_storage_path } = await presignRes.json();
  await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type, 'Content-Disposition': 'attachment' } });
  const completeRes = await fetch('/api/upload/complete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cloud_storage_path, isPublic: true }),
  });
  const { fileUrl } = await completeRes.json();
  return { url: fileUrl, filePath: cloud_storage_path, kind: isVideo ? 'video' : 'image' };
}

// =============================== NEW TICKET ===============================
function NewTicket({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [category, setCategory] = useState('SONSTIGES');
  const [newDue, setNewDue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const a = await uploadFile(files[i]);
        setAttachments((prev) => [...prev, a]);
      }
      toast.success('Anhang hochgeladen');
    } catch (err) { console.error(err); toast.error('Upload fehlgeschlagen'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const removeAttachment = (idx: number) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!subject.trim()) { toast.error('Bitte einen Betreff eingeben'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), description: description.trim(), priority, category, attachments, dueDate: newDue ? new Date(newDue).toISOString() : null }),
      });
      if (!res.ok) { toast.error('Ticket konnte nicht erstellt werden'); return; }
      toast.success('Ticket erstellt');
      onCreated();
    } catch (e) { console.error(e); toast.error('Fehler beim Erstellen'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Zurück</Button>
        <h2 className="text-xl font-bold">Neues Ticket</h2>
      </div>
      <Card><CardContent className="p-5 space-y-4">
        <div className="space-y-1.5">
          <Label>Betreff *</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Kurze Zusammenfassung" maxLength={140}
            inputMode="text" autoCorrect="on" autoCapitalize="sentences" spellCheck />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Kategorie</Label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Priorität</Label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <option value="NIEDRIG">Niedrig</option>
              <option value="NORMAL">Normal</option>
              <option value="HOCH">Hoch</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-muted-foreground" /> Frist (optional)</Label>
          <Input type="datetime-local" value={newDue} min={toLocalInputValue(new Date())} onChange={(e) => setNewDue(e.target.value)}
            className="h-10" />
          <p className="text-xs text-muted-foreground">Kann jederzeit überschritten werden. Bei Überschreitung wird das Ticket rot markiert und es gehen Erinnerungen raus.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Beschreibung</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Problem beschreiben..." className="min-h-[120px]"
            inputMode="text" autoCorrect="on" autoCapitalize="sentences" spellCheck />
        </div>
        <div className="space-y-2">
          <Label>Fotos & Videos</Label>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFiles} />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />} Anhang hinzufügen
          </Button>
          {attachments.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
              {attachments.map((a, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted border">
                  {a.kind === 'video' ? (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground"><VideoIcon className="h-7 w-7" /></div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={a.url} alt="Anhang" className="h-full w-full object-cover" />
                  )}
                  <button type="button" onClick={() => removeAttachment(i)}
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <Button onClick={submit} disabled={saving || uploading} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Ticket absenden
          </Button>
          <Button variant="ghost" onClick={onCancel}>Abbrechen</Button>
        </div>
      </CardContent></Card>
    </div>
  );
}

// =============================== DETAIL ===============================
function TicketDetail({ isAdmin, ticket, loading, onBack, onChanged, afterMutate }: {
  isAdmin: boolean;
  ticket: Ticket | null;
  loading: boolean;
  onBack: () => void;
  onChanged: (t: Ticket) => void;
  afterMutate: () => void;
}) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [dueSaving, setDueSaving] = useState(false);
  const [dueEditing, setDueEditing] = useState(false);
  const [replyAttachments, setReplyAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const a = await uploadFile(files[i]);
        setReplyAttachments((prev) => [...prev, a]);
      }
      toast.success('Anhang hochgeladen');
    } catch (err) { console.error(err); toast.error('Upload fehlgeschlagen'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const removeReplyAttachment = (idx: number) => setReplyAttachments((prev) => prev.filter((_, i) => i !== idx));

  const sendReply = async () => {
    if (!ticket) return;
    if (!reply.trim() && replyAttachments.length === 0) return;
    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim(), attachments: replyAttachments }),
      });
      if (!res.ok) { toast.error('Nachricht konnte nicht gesendet werden'); return; }
      const msg = await res.json();
      onChanged({ ...ticket, messages: [...(ticket.messages || []), msg] });
      setReply('');
      setReplyAttachments([]);
      afterMutate();
    } catch (e) { console.error(e); toast.error('Fehler beim Senden'); }
    finally { setSending(false); }
  };

  const changeStatus = async (status: string) => {
    if (!ticket) return;
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { toast.error('Status konnte nicht geändert werden'); return; }
      const updated = await res.json();
      onChanged({ ...ticket, status: updated.status });
      toast.success('Status aktualisiert');
      afterMutate();
    } catch (e) { console.error(e); toast.error('Fehler'); }
    finally { setStatusSaving(false); }
  };

  const saveDeadline = async (value: string | null) => {
    if (!ticket) return;
    setDueSaving(true);
    try {
      // datetime-local -> ISO. Leerer Wert loescht die Frist.
      const iso = value ? new Date(value).toISOString() : null;
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: iso }),
      });
      if (!res.ok) { toast.error('Frist konnte nicht gespeichert werden'); return; }
      const updated = await res.json();
      onChanged({ ...ticket, dueDate: updated.dueDate ?? null });
      setDueEditing(false);
      toast.success(iso ? 'Frist gesetzt' : 'Frist entfernt');
      afterMutate();
    } catch (e) { console.error(e); toast.error('Fehler'); }
    finally { setDueSaving(false); }
  };

  if (loading || !ticket) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Zurück</Button>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  const st = STATUS_META[ticket.status] || STATUS_META.OFFEN;
  const pr = PRIO_META[ticket.priority] || PRIO_META.NORMAL;
  const cat = CATEGORY_META[ticket.category] || CATEGORY_META.SONSTIGES;
  const dl = getDeadlineInfo(ticket.dueDate, ticket.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Zurück</Button>
      </div>

      <Card><CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${pr.cls}`}>{pr.label}</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cat.cls}`}>{cat.label}</span>
          {dl && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${dl.cls}`}>
              <Clock className="h-3 w-3" />{dl.label}
            </span>
          )}
        </div>
        <h2 className="text-xl font-bold">{ticket.subject}</h2>
        <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" />
            {ticket.createdByName}{ticket.createdByNo ? ` (${employeeCode(ticket.createdByNo)})` : ''}
          </span>
          <span>Erstellt: {formatDateTime(ticket.createdAt)}</span>
        </div>
        {ticket.description && (
          <p className="text-sm whitespace-pre-wrap text-foreground/90 pt-1">{ticket.description}</p>
        )}

        {isAdmin && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">Status ändern:</span>
            <select value={ticket.status} disabled={statusSaving} onChange={(e) => changeStatus(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="OFFEN">Offen</option>
              <option value="IN_BEARBEITUNG">In Bearbeitung</option>
              <option value="ERLEDIGT">Erledigt</option>
            </select>
            {statusSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}

        {/* Frist / Deadline (Admin + Ersteller) */}
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" /> Frist
            </span>
            {!dueEditing && (
              <div className="flex items-center gap-2">
                {ticket.dueDate ? (
                  <span className="text-xs font-medium">{formatDateTime(ticket.dueDate)}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Keine Frist gesetzt</span>
                )}
                <Button variant="outline" size="sm" className="h-8" disabled={dueSaving}
                  onClick={() => setDueEditing(true)}>
                  {ticket.dueDate ? 'Ändern' : 'Setzen'}
                </Button>
                {ticket.dueDate && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600"
                    disabled={dueSaving} onClick={() => saveDeadline(null)} aria-label="Frist entfernen">
                    {dueSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            )}
          </div>
          {dueEditing && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="datetime-local" defaultValue={ticket.dueDate ? toLocalInputValue(new Date(ticket.dueDate)) : ''}
                min={toLocalInputValue(new Date())}
                onChange={(e) => { (e.currentTarget as any)._val = e.target.value; }}
                id={`due-${ticket.id}`}
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <Button size="sm" className="h-9" disabled={dueSaving}
                onClick={() => {
                  const el = document.getElementById(`due-${ticket.id}`) as HTMLInputElement | null;
                  const v = el?.value || '';
                  if (!v) { toast.error('Bitte Datum und Uhrzeit wählen'); return; }
                  saveDeadline(v);
                }}>
                {dueSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
              </Button>
              <Button variant="ghost" size="sm" className="h-9" disabled={dueSaving} onClick={() => setDueEditing(false)}>Abbrechen</Button>
            </div>
          )}
          {dl && !dueEditing && (
            <p className={`text-xs font-medium ${dl.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{dl.label}</p>
          )}
        </div>
      </CardContent></Card>

      {(ticket.attachments?.length ?? 0) > 0 && (
        <Card><CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Paperclip className="h-4 w-4" /> Anhänge</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ticket.attachments?.map((a, i) => (
              <div key={a.id ?? i} className="rounded-lg overflow-hidden border bg-muted">
                {a.kind === 'video' ? (
                  <video src={a.url} controls className="w-full h-40 object-cover bg-black" />
                ) : (
                  <a href={a.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt="Anhang" className="w-full h-40 object-cover" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-5">
        <h3 className="text-sm font-semibold mb-3">Verlauf</h3>
        {(ticket.messages?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Nachrichten.</p>
        ) : (
          <div className="space-y-3">
            {ticket.messages?.map((m) => {
              const adminMsg = m.authorRole === 'ADMIN';
              const msgAtt = parseMsgAttachments(m.attachments);
              return (
                <div key={m.id} className={`flex ${adminMsg ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${adminMsg ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                    <div className={`text-[11px] font-semibold mb-0.5 flex items-center gap-1 ${adminMsg ? 'text-muted-foreground' : 'text-primary-foreground/80'}`}>
                      {adminMsg ? <ShieldCheck className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                      {m.authorName}
                    </div>
                    {m.body && <p className="text-sm whitespace-pre-wrap">{m.body}</p>}
                    {msgAtt.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {msgAtt.map((a, i) => (
                          <div key={i} className="rounded-lg overflow-hidden border border-black/10 bg-black/5">
                            {a.kind === 'video' ? (
                              <video src={a.url} controls className="w-full h-28 object-cover bg-black" />
                            ) : (
                              <a href={a.url} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={a.url} alt="Anhang" className="w-full h-28 object-cover" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={`text-[10px] mt-1 ${adminMsg ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>{formatDateTime(m.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Vorschau der Anhaenge fuer die naechste Nachricht */}
        {replyAttachments.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
            {replyAttachments.map((a, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted border">
                {a.kind === 'video' ? (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground"><VideoIcon className="h-7 w-7" /></div>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={a.url} alt="Anhang" className="h-full w-full object-cover" />
                )}
                <button type="button" onClick={() => removeReplyAttachment(i)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFiles} />
          <Button type="button" variant="outline" size="icon" onClick={() => fileRef.current?.click()} disabled={uploading} className="shrink-0" aria-label="Anhang hinzufügen">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Antwort schreiben..." className="min-h-[52px]"
            inputMode="text" autoCorrect="on" autoCapitalize="sentences" spellCheck />
          <Button onClick={sendReply} disabled={sending || uploading || (!reply.trim() && replyAttachments.length === 0)} className="gap-1.5 shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent></Card>
    </div>
  );
}
