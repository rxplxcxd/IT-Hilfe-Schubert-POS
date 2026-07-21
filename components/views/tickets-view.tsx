'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, ArrowLeft, Send, Paperclip, X, LifeBuoy, Image as ImageIcon,
  Video as VideoIcon, Loader2, ShieldCheck, User as UserIcon, Search, Filter,
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
  createdAt: string;
}
interface Ticket {
  id: number;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdById: number;
  createdByName: string;
  createdByNo: number | null;
  adminUnread: boolean;
  employeeUnread: boolean;
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

export function TicketsView({ isAdmin }: { isAdmin: boolean }) {
  const { refresh } = useNotifications();
  const [mode, setMode] = useState<'list' | 'new' | 'detail'>('list');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filter tickets
  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const haystack = `${t.ticketNumber} ${t.subject} ${t.createdByName}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
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

        {/* Search + Status Filter */}
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

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filteredTickets.length === 0 ? (
          <Card><CardContent className="py-14 text-center text-muted-foreground">
            <LifeBuoy className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{tickets.length === 0 ? 'Noch keine Tickets vorhanden.' : 'Keine Tickets f\u00fcr diesen Filter.'}</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2.5">
            {filteredTickets.map((t) => {
              const st = STATUS_META[t.status] || STATUS_META.OFFEN;
              const pr = PRIO_META[t.priority] || PRIO_META.NORMAL;
              const unread = isAdmin ? t.adminUnread : t.employeeUnread;
              return (
                <Card key={t.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => openDetail(t.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {unread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-label="ungelesen" />}
                          <span className="font-mono text-xs text-muted-foreground">{t.ticketNumber}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${pr.cls}`}>{pr.label}</span>
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

// =============================== NEW TICKET ===============================
function NewTicket({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('NORMAL');
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
        const file = files[i];
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
        setAttachments((prev) => [...prev, { url: fileUrl, filePath: cloud_storage_path, kind: isVideo ? 'video' : 'image' }]);
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
        body: JSON.stringify({ subject: subject.trim(), description: description.trim(), priority, attachments }),
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
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Kurze Zusammenfassung" maxLength={140} />
        </div>
        <div className="space-y-1.5">
          <Label>Priorität</Label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <option value="NIEDRIG">Niedrig</option>
            <option value="NORMAL">Normal</option>
            <option value="HOCH">Hoch</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Beschreibung</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Problem beschreiben..." className="min-h-[120px]" />
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

  const sendReply = async () => {
    if (!ticket || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (!res.ok) { toast.error('Nachricht konnte nicht gesendet werden'); return; }
      const msg = await res.json();
      onChanged({ ...ticket, messages: [...(ticket.messages || []), msg] });
      setReply('');
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
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="OFFEN">Offen</option>
              <option value="IN_BEARBEITUNG">In Bearbeitung</option>
              <option value="ERLEDIGT">Erledigt</option>
            </select>
            {statusSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}
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
              return (
                <div key={m.id} className={`flex ${adminMsg ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${adminMsg ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                    <div className={`text-[11px] font-semibold mb-0.5 flex items-center gap-1 ${adminMsg ? 'text-muted-foreground' : 'text-primary-foreground/80'}`}>
                      {adminMsg ? <ShieldCheck className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                      {m.authorName}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                    <div className={`text-[10px] mt-1 ${adminMsg ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>{formatDateTime(m.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-end gap-2">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Antwort schreiben..." className="min-h-[52px]" />
          <Button onClick={sendReply} disabled={sending || !reply.trim()} className="gap-1.5 shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent></Card>
    </div>
  );
}
