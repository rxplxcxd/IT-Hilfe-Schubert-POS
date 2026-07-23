'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, Send, RefreshCw, ArrowLeft, Search, Inbox, Pen, ExternalLink, Unplug, AlertCircle, Archive, ArchiveRestore, Trash2, Reply } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Folder = 'INBOX' | 'SENT' | 'ARCHIVE';

interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to?: string;
  subject: string;
  date: string;
  snippet: string;
  body?: string;
  isHtml?: boolean;
  isUnread?: boolean;
  folder?: string;
  direction?: string;
  isArchived?: boolean;
}

interface ComposeData {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

const FOLDERS: { v: Folder; l: string; icon: any }[] = [
  { v: 'INBOX', l: 'Posteingang', icon: Inbox },
  { v: 'SENT', l: 'Gesendet', icon: Send },
  { v: 'ARCHIVE', l: 'Archiv', icon: Archive },
];

export function EmailView() {
  const [connected, setConnected] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [connectedEmail, setConnectedEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<Folder>('INBOX');
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [composing, setComposing] = useState(false);
  const [compose, setCompose] = useState<ComposeData>({ to: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [configError, setConfigError] = useState('');
  const [companyAddress, setCompanyAddress] = useState<string | null>(null);
  const [prefixSet, setPrefixSet] = useState(true);

  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/auth');
      const data = await res.json();
      setConnected(data.connected || false);
      setAuthUrl(data.authUrl || null);
      setConnectedEmail(data.email || '');
      setCompanyAddress(data.companyAddress || null);
      setPrefixSet(!!data.prefixSet);
      if (data.error && !data.authUrl) setConfigError(data.error);
      else setConfigError('');
    } catch {
      setConfigError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (f: Folder, query?: string) => {
    setLoadingMessages(true);
    try {
      const params = new URLSearchParams();
      params.set('folder', f);
      if (query) params.set('q', query);
      const res = await fetch(`/api/gmail/messages?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error('E-Mails konnten nicht geladen werden', { description: data?.error, duration: 10000 });
        setMessages([]);
        return;
      }
      setMessages(data.messages || []);
      if (typeof data.connected === 'boolean') setConnected(data.connected);
      if (data.syncError && f === 'INBOX') {
        toast.error('Posteingang-Sync', { description: data.syncError, duration: 10000 });
      }
    } catch {
      toast.error('E-Mails konnten nicht geladen werden');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => { checkConnection(); }, [checkConnection]);
  useEffect(() => { if (!loading) fetchMessages(folder, searchQuery); /* eslint-disable-next-line */ }, [loading, folder]);

  const switchFolder = (f: Folder) => {
    setSelectedMessage(null);
    setSearchQuery('');
    setFolder(f);
  };

  const openMessage = async (msg: EmailMessage) => {
    setLoadingDetail(true);
    setSelectedMessage(msg);
    try {
      const res = await fetch(`/api/gmail/messages?id=${msg.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSelectedMessage(data);
      // gelesen-Markierung im Listen-State nachziehen
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isUnread: false } : m)));
    } catch {
      toast.error('E-Mail konnte nicht geladen werden');
      setSelectedMessage(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSend = async () => {
    if (!compose.to || !compose.subject) {
      toast.error('Empfänger und Betreff sind Pflichtfelder');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compose),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error('Fehler beim Senden', { description: data?.error, duration: 12000 });
        return;
      }
      toast.success('E-Mail gesendet!');
      setComposing(false);
      setCompose({ to: '', subject: '', body: '' });
      setFolder('SENT');
      fetchMessages('SENT');
    } catch {
      toast.error('Fehler beim Senden');
    } finally {
      setSending(false);
    }
  };

  const handleReply = () => {
    if (!selectedMessage) return;
    const target = selectedMessage.direction === 'OUTGOING' ? (selectedMessage.to || '') : selectedMessage.from;
    const fromMatch = target.match(/<(.+?)>/);
    const replyTo = fromMatch ? fromMatch[1] : target;
    setCompose({
      to: replyTo,
      subject: selectedMessage.subject.startsWith('Re:') ? selectedMessage.subject : `Re: ${selectedMessage.subject}`,
      body: `<br><br>---<br><b>Von:</b> ${selectedMessage.from}<br><b>Datum:</b> ${selectedMessage.date}<br><b>Betreff:</b> ${selectedMessage.subject}<br><br>${selectedMessage.body || ''}`,
      threadId: selectedMessage.threadId,
    });
    setSelectedMessage(null);
    setComposing(true);
  };

  const handleArchiveAction = async (id: string, action: 'archive' | 'unarchive' | 'delete') => {
    try {
      const res = await fetch('/api/gmail/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error();
      toast.success(action === 'delete' ? 'Gelöscht' : action === 'unarchive' ? 'Aus dem Archiv geholt' : 'Archiviert');
      setSelectedMessage(null);
      fetchMessages(folder, searchQuery);
    } catch {
      toast.error('Aktion fehlgeschlagen');
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/gmail/disconnect', { method: 'POST' });
      setConnected(false);
      setSelectedMessage(null);
      toast.success('Gmail getrennt');
      checkConnection();
    } catch {
      toast.error('Fehler beim Trennen');
    }
  };

  const handleSearch = () => { fetchMessages(folder, searchQuery); };

  const formatEmailDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const extractName = (from: string) => {
    const match = from.match(/^(.+?)\s*</);
    return match ? match[1].replace(/"/g, '').trim() : from.split('@')[0];
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  // Compose view
  if (composing) {
    return (
      <div className="p-4 space-y-4 pb-8">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setComposing(false); setCompose({ to: '', subject: '', body: '' }); }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-display font-semibold text-lg">Neue E-Mail</h2>
        </div>
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            {companyAddress && (
              <div className="text-xs bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                <span className="text-muted-foreground">Absender: </span>
                <span className="font-semibold text-primary break-all">{companyAddress}</span>
              </div>
            )}
            <div>
              <Label>An</Label>
              <Input value={compose.to} onChange={(e: any) => setCompose({ ...compose, to: e.target.value })} placeholder="email@example.com" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            </div>
            <div>
              <Label>Betreff</Label>
              <Input value={compose.subject} onChange={(e: any) => setCompose({ ...compose, subject: e.target.value })} placeholder="Betreff eingeben..." inputMode="text" autoCapitalize="sentences" autoCorrect="on" spellCheck />
            </div>
            <div>
              <Label>Nachricht</Label>
              <textarea
                value={compose.body}
                onChange={(e: any) => setCompose({ ...compose, body: e.target.value })}
                className="w-full mt-1 p-3 text-sm border border-input rounded-md bg-background min-h-[200px] resize-y"
                placeholder="Nachricht verfassen..."
                inputMode="text"
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck
              />
            </div>
            <Button onClick={handleSend} disabled={sending} className="w-full gap-2">
              <Send className="w-4 h-4" />
              {sending ? 'Wird gesendet...' : 'Senden'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Message detail view
  if (selectedMessage) {
    const inArchive = folder === 'ARCHIVE' || selectedMessage.isArchived;
    return (
      <div className="p-4 space-y-4 pb-8">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSelectedMessage(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-display font-semibold text-lg truncate flex-1">{selectedMessage.subject || '(Kein Betreff)'}</h2>
        </div>
        {loadingDetail ? (
          <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
        ) : (
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{extractName(selectedMessage.from)}</p>
                <p className="text-xs text-muted-foreground break-all">{selectedMessage.from}</p>
                {selectedMessage.to && <p className="text-xs text-muted-foreground break-all">An: {selectedMessage.to}</p>}
                <p className="text-xs text-muted-foreground">{new Date(selectedMessage.date).toLocaleString('de-DE', { timeZone: 'UTC' })}</p>
              </div>
              <div className="border-t pt-3">
                {selectedMessage.isHtml ? (
                  <div className="prose prose-sm max-w-none text-sm overflow-auto" dangerouslySetInnerHTML={{ __html: selectedMessage.body || '' }} />
                ) : (
                  <pre className="text-sm whitespace-pre-wrap font-sans">{selectedMessage.body || ''}</pre>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={handleReply} className="flex-1 gap-2 min-w-[120px]">
                  <Reply className="w-4 h-4" />
                  Antworten
                </Button>
                {inArchive ? (
                  <Button variant="outline" onClick={() => handleArchiveAction(selectedMessage.id, 'unarchive')} className="gap-2">
                    <ArchiveRestore className="w-4 h-4" />
                    Zurück
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => handleArchiveAction(selectedMessage.id, 'archive')} className="gap-2">
                    <Archive className="w-4 h-4" />
                    Archivieren
                  </Button>
                )}
                <Button variant="outline" onClick={() => handleArchiveAction(selectedMessage.id, 'delete')} className="gap-2 text-destructive">
                  <Trash2 className="w-4 h-4" />
                  Löschen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Mailbox view (folders + list)
  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg">E-Mail</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => fetchMessages(folder, searchQuery)} disabled={loadingMessages}>
            <RefreshCw className={`w-4 h-4 ${loadingMessages ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="icon" onClick={() => setComposing(true)}>
            <Pen className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Firmen-Adresse + Gmail-Status */}
      <div className="flex items-center justify-between text-xs bg-muted/50 p-2 rounded-lg">
        <div className="min-w-0">
          {companyAddress && (
            <p className="font-semibold text-primary truncate">{companyAddress}</p>
          )}
          <span className="text-muted-foreground truncate block">
            {connected ? `Gmail verbunden: ${connectedEmail}` : 'Gmail nicht verbunden'}
          </span>
        </div>
        {connected ? (
          <button onClick={handleDisconnect} className="text-destructive flex items-center gap-1 shrink-0">
            <Unplug className="w-3 h-3" />
            Trennen
          </button>
        ) : authUrl ? (
          <button onClick={() => window.open(authUrl, '_self')} className="text-primary flex items-center gap-1 shrink-0">
            <ExternalLink className="w-3 h-3" />
            Verbinden
          </button>
        ) : null}
      </div>

      {configError && (
        <div className="text-xs text-destructive flex items-center gap-2 bg-destructive/5 border border-destructive/20 rounded-lg p-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{configError}</span>
        </div>
      )}

      {!prefixSet && (
        <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded-lg p-2.5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Dir ist noch keine Firmen-E-Mail-Adresse zugewiesen. Bitte lasse dir vom Administrator eine Adresse zuweisen, damit du senden und empfangen kannst.</span>
        </div>
      )}

      {/* Ordner-Umschalter */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-lg">
        {FOLDERS.map((f) => {
          const Icon = f.icon;
          return (
            <button
              key={f.v}
              onClick={() => switchFolder(f.v)}
              className={`flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-colors ${
                folder === f.v ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {f.l}
            </button>
          );
        })}
      </div>

      {folder === 'INBOX' && !connected && (
        <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded-lg p-2.5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Empfangene Mails werden erst nach dem Verbinden mit Gmail synchronisiert. Gesendete Mails siehst du auch ohne Verbindung.</span>
        </div>
      )}

      {/* Suche */}
      <div className="flex gap-2">
        <Input
          value={searchQuery}
          onChange={(e: any) => setSearchQuery(e.target.value)}
          placeholder="E-Mails durchsuchen..."
          onKeyDown={(e: any) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <Button variant="outline" size="icon" onClick={handleSearch}>
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {/* Liste */}
      {loadingMessages ? (
        <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : messages.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-6 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Keine E-Mails in diesem Ordner</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {messages.map((msg) => (
            <button
              key={msg.id}
              onClick={() => openMessage(msg)}
              className={`w-full text-left p-3 rounded-lg transition-colors border ${
                msg.isUnread
                  ? 'bg-primary/5 border-primary/20 font-medium'
                  : 'bg-card border-border hover:bg-muted/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {msg.isUnread && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    <span className="text-sm truncate">
                      {folder === 'SENT' ? `An: ${extractName(msg.to || '')}` : extractName(msg.from)}
                    </span>
                  </div>
                  <p className="text-sm truncate mt-0.5">{msg.subject || '(Kein Betreff)'}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.snippet}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatEmailDate(msg.date)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
