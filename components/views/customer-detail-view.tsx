'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Shield, FileText, Wrench, Monitor, Star, Bell, Plus, Camera, Trash2, Pencil, Send, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatCurrency, formatDate, getZoneLabel } from '@/lib/utils';

interface CustomerDetailProps {
  customerId: number;
  onBack: () => void;
  onWriteEmail: (email: string) => void;
  onViewInvoice: (id: number) => void;
}

export function CustomerDetailView({ customerId, onBack, onWriteEmail, onViewInvoice }: CustomerDetailProps) {
  const [customer, setCustomer] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  // Work log form
  const [showWorkLogForm, setShowWorkLogForm] = useState(false);
  const [wlForm, setWlForm] = useState({ title: '', description: '' });
  const [savingWl, setSavingWl] = useState(false);
  // Device form
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [devForm, setDevForm] = useState({ deviceType: 'PC', brand: '', model: '', serialNr: '', password: '', wifiPassword: '', notes: '' });
  const [savingDev, setSavingDev] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  // Reminder form
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [remForm, setRemForm] = useState({ title: '', message: '', dueDate: '', type: 'FOLLOW_UP' });
  const [savingRem, setSavingRem] = useState(false);
  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, iRes, wRes, dRes, rRes] = await Promise.all([
        fetch(`/api/customers/${customerId}`),
        fetch('/api/invoices'),
        fetch(`/api/worklogs?customerId=${customerId}`),
        fetch(`/api/devices?customerId=${customerId}`),
        fetch(`/api/reminders?customerId=${customerId}`),
      ]);
      const cData = await cRes.json();
      setCustomer(cData);
      const allInvoices = await iRes.json();
      setInvoices((allInvoices || []).filter((i: any) => i.customerId === customerId));
      setWorkLogs(await wRes.json() || []);
      setDevices(await dRes.json() || []);
      setReminders(await rRes.json() || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaveWorkLog = async () => {
    if (!wlForm.title) { toast.error('Titel ist Pflicht'); return; }
    setSavingWl(true);
    try {
      const res = await fetch('/api/worklogs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, ...wlForm }),
      });
      if (!res.ok) throw new Error();
      toast.success('Protokoll erstellt');
      setShowWorkLogForm(false);
      setWlForm({ title: '', description: '' });
      fetchAll();
    } catch { toast.error('Fehler'); } finally { setSavingWl(false); }
  };

  const handlePhotoUpload = async (workLogId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = (e?.target?.files ?? [])[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const presignRes = await fetch('/api/upload/presigned', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: true }),
      });
      const { uploadUrl, cloud_storage_path } = await presignRes.json();
      const urlObj = new URL(uploadUrl);
      const signedHeaders = urlObj.searchParams.get('X-Amz-SignedHeaders') ?? '';
      const headers: Record<string, string> = { 'Content-Type': file.type };
      if (signedHeaders.includes('content-disposition')) headers['Content-Disposition'] = 'attachment';
      await fetch(uploadUrl, { method: 'PUT', headers, body: file });
      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloud_storage_path, isPublic: true }),
      });
      const { fileUrl } = await completeRes.json();
      const caption = prompt('Notiz zum Foto (optional):') || '';
      await fetch(`/api/worklogs/${workLogId}/photos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: cloud_storage_path, fileUrl, isPublic: true, caption }),
      });
      toast.success('Foto hochgeladen');
      fetchAll();
    } catch { toast.error('Upload fehlgeschlagen'); } finally { setUploadingPhoto(false); }
  };

  const handleSaveDevice = async () => {
    if (!devForm.brand && !devForm.model) { toast.error('Marke oder Modell angeben'); return; }
    setSavingDev(true);
    try {
      const res = await fetch('/api/devices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, ...devForm }),
      });
      if (!res.ok) throw new Error();
      toast.success('Gerät gespeichert');
      setShowDeviceForm(false);
      setDevForm({ deviceType: 'PC', brand: '', model: '', serialNr: '', password: '', wifiPassword: '', notes: '' });
      fetchAll();
    } catch { toast.error('Fehler'); } finally { setSavingDev(false); }
  };

  const handleSaveReminder = async () => {
    if (!remForm.title || !remForm.dueDate) { toast.error('Titel und Datum sind Pflicht'); return; }
    setSavingRem(true);
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, ...remForm }),
      });
      if (!res.ok) throw new Error();
      toast.success('Erinnerung erstellt');
      setShowReminderForm(false);
      setRemForm({ title: '', message: '', dueDate: '', type: 'FOLLOW_UP' });
      fetchAll();
    } catch { toast.error('Fehler'); } finally { setSavingRem(false); }
  };

  const handleCompleteReminder = async (id: number) => {
    try {
      await fetch(`/api/reminders/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      });
      toast.success('Erledigt!');
      fetchAll();
    } catch { toast.error('Fehler'); }
  };

  const handleDeleteDevice = async (id: number) => {
    if (!confirm('Gerät löschen?')) return;
    try {
      await fetch(`/api/devices/${id}`, { method: 'DELETE' });
      toast.success('Gelöscht');
      fetchAll();
    } catch { toast.error('Fehler'); }
  };

  const handleSendReview = async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}/review`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler');
      toast.success('Bewertungs-E-Mail gesendet!');
    } catch (e: any) { toast.error(e.message || 'Fehler beim Senden'); }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }
  if (!customer) return <div className="p-4 text-center text-muted-foreground">Kunde nicht gefunden</div>;

  const sections = [
    { id: 'overview', label: 'Info', icon: MapPin },
    { id: 'invoices', label: 'Rechnungen', icon: FileText },
    { id: 'worklogs', label: 'Protokolle', icon: Wrench },
    { id: 'devices', label: 'Geräte', icon: Monitor },
    { id: 'reminders', label: 'Erinnerungen', icon: Bell },
  ];

  const hasSchutzbrief = (customer.subscriptions || []).some((s: any) => s.active);

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h2 className="font-display font-semibold text-lg">{customer.firstName} {customer.lastName}</h2>
          <p className="text-xs text-muted-foreground">{getZoneLabel(customer.zone)}</p>
        </div>
        {hasSchutzbrief && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1"><Shield className="w-3 h-3" /> Schutzbrief</span>}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => window.open(`tel:${customer.phone}`)}>
          <Phone className="w-3.5 h-3.5" /> Anrufen
        </Button>
        {customer.email && (
          <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => onWriteEmail(customer.email)}>
            <Mail className="w-3.5 h-3.5" /> E-Mail
          </Button>
        )}
        {customer.email && (
          <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={handleSendReview}>
            <Star className="w-3.5 h-3.5" /> Bewertung
          </Button>
        )}
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 overflow-x-auto bg-muted rounded-lg p-1">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1 py-2 px-3 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                activeSection === s.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}>
              <Icon className="w-3.5 h-3.5" />{s.label}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {activeSection === 'overview' && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-2 text-sm">
            <div className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" /><div>{customer.street} {customer.houseNr}<br/>{customer.zip} {customer.city}</div></div>
            <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span>{customer.phone}</span></div>
            {customer.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><span>{customer.email}</span></div>}
            {customer.notes && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notizen</p>
                <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
              <div className="text-center"><p className="text-lg font-bold text-primary">{invoices.length}</p><p className="text-xs text-muted-foreground">Aufträge</p></div>
              <div className="text-center"><p className="text-lg font-bold text-primary">{formatCurrency(invoices.filter((i: any) => i.status === 'BEZAHLT').reduce((s: number, i: any) => s + i.total, 0))}</p><p className="text-xs text-muted-foreground">Umsatz</p></div>
              <div className="text-center"><p className="text-lg font-bold text-primary">{devices.length}</p><p className="text-xs text-muted-foreground">Geräte</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices */}
      {activeSection === 'invoices' && (
        <div className="space-y-2">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Rechnungen</p>
          ) : invoices.map((inv: any) => (
            <button key={inv.id} onClick={() => onViewInvoice(inv.id)} className="w-full text-left">
              <Card className="shadow-sm hover:bg-muted/30 transition-colors">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(inv.total)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === 'BEZAHLT' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{inv.status}</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Work Logs */}
      {activeSection === 'worklogs' && (
        <div className="space-y-3">
          <Button size="sm" onClick={() => setShowWorkLogForm(!showWorkLogForm)} className="gap-1"><Plus className="w-4 h-4" /> Neues Protokoll</Button>
          {showWorkLogForm && (
            <Card className="shadow-sm"><CardContent className="p-4 space-y-3">
              <div><Label>Titel *</Label><Input value={wlForm.title} onChange={(e: any) => setWlForm({ ...wlForm, title: e.target.value })} placeholder="z.B. WLAN eingerichtet" /></div>
              <div><Label>Beschreibung</Label><textarea value={wlForm.description} onChange={(e: any) => setWlForm({ ...wlForm, description: e.target.value })} className="w-full mt-1 p-2 text-sm border border-input rounded-md bg-background min-h-[80px] resize-y" placeholder="Was wurde gemacht?" /></div>
              <Button onClick={handleSaveWorkLog} disabled={savingWl} className="w-full">{savingWl ? 'Speichern...' : 'Protokoll speichern'}</Button>
            </CardContent></Card>
          )}
          {workLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Arbeitsprotokolle</p>
          ) : workLogs.map((wl: any) => (
            <Card key={wl.id} className="shadow-sm">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div><p className="text-sm font-medium">{wl.title}</p><p className="text-xs text-muted-foreground">{formatDate(wl.date)}</p></div>
                  <label className="cursor-pointer">
                    <Camera className={`w-5 h-5 ${uploadingPhoto ? 'text-muted-foreground animate-pulse' : 'text-primary'}`} />
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(wl.id, e)} disabled={uploadingPhoto} />
                  </label>
                </div>
                {wl.description && <p className="text-xs text-muted-foreground">{wl.description}</p>}
                {(wl.photos || []).length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pt-1">
                    {wl.photos.map((p: any) => (
                      <div key={p.id} className="shrink-0">
                        <img src={p.fileUrl} alt={p.caption || 'Foto'} className="w-20 h-20 rounded-lg object-cover border" />
                        {p.caption && <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[80px] truncate">{p.caption}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Devices */}
      {activeSection === 'devices' && (
        <div className="space-y-3">
          <Button size="sm" onClick={() => setShowDeviceForm(!showDeviceForm)} className="gap-1"><Plus className="w-4 h-4" /> Neues Gerät</Button>
          {showDeviceForm && (
            <Card className="shadow-sm"><CardContent className="p-4 space-y-3">
              <div><Label>Gerätetyp</Label>
                <select value={devForm.deviceType} onChange={(e: any) => setDevForm({ ...devForm, deviceType: e.target.value })} className="w-full mt-1 h-10 px-3 text-sm border border-input rounded-md bg-background">
                  {['PC', 'Laptop', 'Smartphone', 'Tablet', 'Drucker', 'Router', 'Smart TV', 'Sonstiges'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Marke</Label><Input value={devForm.brand} onChange={(e: any) => setDevForm({ ...devForm, brand: e.target.value })} placeholder="z.B. HP" /></div>
                <div><Label>Modell</Label><Input value={devForm.model} onChange={(e: any) => setDevForm({ ...devForm, model: e.target.value })} placeholder="z.B. DeskJet 2720" /></div>
              </div>
              <div><Label>Seriennummer</Label><Input value={devForm.serialNr} onChange={(e: any) => setDevForm({ ...devForm, serialNr: e.target.value })} /></div>
              <div><Label>Geräte-Passwort</Label><Input value={devForm.password} onChange={(e: any) => setDevForm({ ...devForm, password: e.target.value })} type="password" /></div>
              <div><Label>WLAN-Passwort</Label><Input value={devForm.wifiPassword} onChange={(e: any) => setDevForm({ ...devForm, wifiPassword: e.target.value })} type="password" /></div>
              <div><Label>Notizen</Label><textarea value={devForm.notes} onChange={(e: any) => setDevForm({ ...devForm, notes: e.target.value })} className="w-full mt-1 p-2 text-sm border border-input rounded-md bg-background min-h-[60px] resize-y" /></div>
              <Button onClick={handleSaveDevice} disabled={savingDev} className="w-full">{savingDev ? 'Speichern...' : 'Gerät speichern'}</Button>
            </CardContent></Card>
          )}
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Geräte hinterlegt</p>
          ) : devices.map((dev: any) => (
            <Card key={dev.id} className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2"><Monitor className="w-4 h-4 text-primary" /><p className="text-sm font-medium">{dev.deviceType}: {dev.brand} {dev.model}</p></div>
                    {dev.serialNr && <p className="text-xs text-muted-foreground mt-1">SN: {dev.serialNr}</p>}
                    {(dev.password || dev.wifiPassword) && (
                      <div className="mt-2 space-y-1">
                        {dev.password && (
                          <div className="flex items-center gap-1">
                            <p className="text-xs">PW: {showPasswords[dev.id] ? dev.password : '••••••'}</p>
                            <button onClick={() => setShowPasswords((p) => ({ ...p, [dev.id]: !p[dev.id] }))}>
                              {showPasswords[dev.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        )}
                        {dev.wifiPassword && (
                          <div className="flex items-center gap-1">
                            <p className="text-xs">WLAN: {showPasswords[dev.id] ? dev.wifiPassword : '••••••'}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {dev.notes && <p className="text-xs text-muted-foreground mt-1">{dev.notes}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteDevice(dev.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reminders */}
      {activeSection === 'reminders' && (
        <div className="space-y-3">
          <Button size="sm" onClick={() => setShowReminderForm(!showReminderForm)} className="gap-1"><Plus className="w-4 h-4" /> Neue Erinnerung</Button>
          {showReminderForm && (
            <Card className="shadow-sm"><CardContent className="p-4 space-y-3">
              <div><Label>Typ</Label>
                <select value={remForm.type} onChange={(e: any) => setRemForm({ ...remForm, type: e.target.value })} className="w-full mt-1 h-10 px-3 text-sm border border-input rounded-md bg-background">
                  <option value="FOLLOW_UP">Follow-up</option>
                  <option value="SCHUTZBRIEF_RENEWAL">Schutzbrief-Verlängerung</option>
                  <option value="SECURITY_CHECK">Sicherheits-Check</option>
                  <option value="CUSTOM">Sonstiges</option>
                </select>
              </div>
              <div><Label>Titel *</Label><Input value={remForm.title} onChange={(e: any) => setRemForm({ ...remForm, title: e.target.value })} placeholder="z.B. Nächster Sicherheits-Check" /></div>
              <div><Label>Nachricht</Label><textarea value={remForm.message} onChange={(e: any) => setRemForm({ ...remForm, message: e.target.value })} className="w-full mt-1 p-2 text-sm border border-input rounded-md bg-background min-h-[60px] resize-y" /></div>
              <div><Label>Fällig am *</Label><Input type="date" value={remForm.dueDate} onChange={(e: any) => setRemForm({ ...remForm, dueDate: e.target.value })} /></div>
              <Button onClick={handleSaveReminder} disabled={savingRem} className="w-full">{savingRem ? 'Speichern...' : 'Erinnerung erstellen'}</Button>
            </CardContent></Card>
          )}
          {reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Erinnerungen</p>
          ) : reminders.map((rem: any) => (
            <Card key={rem.id} className={`shadow-sm ${rem.completed ? 'opacity-50' : ''}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <button onClick={() => !rem.completed && handleCompleteReminder(rem.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${rem.completed ? 'bg-green-100 border-green-500 text-green-600' : 'border-muted-foreground/30'}`}>
                  {rem.completed && '✓'}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${rem.completed ? 'line-through' : ''}`}>{rem.title}</p>
                  {rem.message && <p className="text-xs text-muted-foreground truncate">{rem.message}</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(rem.dueDate)}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                  new Date(rem.dueDate) < new Date() && !rem.completed ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'
                }`}>
                  {rem.type === 'FOLLOW_UP' ? 'Follow-up' : rem.type === 'SCHUTZBRIEF_RENEWAL' ? 'Schutzbrief' : rem.type === 'SECURITY_CHECK' ? 'Sicherheit' : 'Sonstiges'}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
