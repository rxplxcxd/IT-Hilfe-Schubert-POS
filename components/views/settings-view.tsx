'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Upload, Building2, CreditCard, Mail, FileText, Image as ImageIcon, CheckCircle2, Globe, Sun, Moon, Monitor, ClipboardList, MapPin, Users } from 'lucide-react';
import { TeamSettings } from './team-settings';
import { useTheme } from 'next-themes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface SettingsData {
  companyName: string;
  ownerName: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  taxInfo: string;
  invoiceHeader: string;
  logoUrl: string;
  resendApiKey: string;
  bankName: string;
  iban: string;
  bic: string;
  googleClientId: string;
  googleClientSecret: string;
  disclaimerDefaultText: string;
  hqStreet: string;
  hqZip: string;
  hqCity: string;
}

export function SettingsView({ isAdmin = false, initialSection }: { isAdmin?: boolean; initialSection?: string } = {}) {
  const [settings, setSettings] = useState<SettingsData>({
    companyName: 'IT-Hilfe Schubert', ownerName: 'Leon Schubert',
    street: '', zip: '', city: '', phone: '', email: '',
    taxInfo: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
    invoiceHeader: '', logoUrl: '', resendApiKey: '',
    bankName: '', iban: '', bic: '',
    googleClientId: '', googleClientSecret: '',
    disclaimerDefaultText: 'Der Kunde bestätigt, dass ein aktuelles Backup aller relevanten Daten existiert. Für etwaige Datenverluste während der Reparatur/Wartung wird keine Haftung übernommen. Der Kunde trägt das volle Risiko für nicht gesicherte Daten.',
    hqStreet: 'Alte Schulstr 4', hqZip: '02694', hqCity: 'Malschwitz',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(initialSection || 'company');

  useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
  }, [initialSection]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data) setSettings(data);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      toast.success('Einstellungen gespeichert');
    } catch {
      toast.error('Fehler beim Speichern');
    } finally { setSaving(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = (e?.target?.files ?? [])[0];
    if (!file) return;
    setUploading(true);
    try {
      // Get presigned URL
      const presignRes = await fetch('/api/upload/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: true }),
      });
      const { uploadUrl, cloud_storage_path } = await presignRes.json();

      // Check if content-disposition is in signed headers
      const url = new URL(uploadUrl);
      const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders') ?? '';
      const headers: Record<string, string> = { 'Content-Type': file.type };
      if (signedHeaders.includes('content-disposition')) {
        headers['Content-Disposition'] = 'attachment';
      }

      // Upload zu Supabase Storage
      await fetch(uploadUrl, { method: 'PUT', headers, body: file });

      // Complete upload
      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloud_storage_path, isPublic: true }),
      });
      const { fileUrl } = await completeRes.json();

      setSettings((prev: SettingsData) => ({ ...(prev ?? {} as SettingsData), logoUrl: fileUrl ?? '' }));
      toast.success('Logo hochgeladen');
    } catch (e: any) {
      console.error(e);
      toast.error('Logo-Upload fehlgeschlagen');
    } finally { setUploading(false); }
  };

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  const sections = [
    { id: 'company', label: 'Firma', icon: Building2 },
    { id: 'invoice', label: 'Rechnung', icon: FileText },
    { id: 'order', label: 'Auftrag', icon: ClipboardList },
    { id: 'bank', label: 'Bank', icon: CreditCard },
    { id: 'gmail', label: 'Gmail', icon: Globe },
    ...(isAdmin ? [{ id: 'team', label: 'Team', icon: Users }] : []),
    { id: 'theme', label: 'Design', icon: Sun },
  ];

  return (
    <div className="p-4 space-y-4 pb-8">
      <h2 className="font-display font-semibold text-lg">Einstellungen</h2>

      {/* Section Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-medium transition-colors ${
                activeSection === s.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Company Section */}
      {activeSection === 'company' && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div><Label>Firmenname</Label><Input value={settings?.companyName ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), companyName: e?.target?.value ?? ''})} /></div>
            <div><Label>Inhaber</Label><Input value={settings?.ownerName ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), ownerName: e?.target?.value ?? ''})} /></div>
            <div><Label>Straße</Label><Input value={settings?.street ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), street: e?.target?.value ?? ''})} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>PLZ</Label><Input value={settings?.zip ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), zip: e?.target?.value ?? ''})} /></div>
              <div className="col-span-2"><Label>Ort</Label><Input value={settings?.city ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), city: e?.target?.value ?? ''})} /></div>
            </div>
            <div><Label>Telefon</Label><Input value={settings?.phone ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), phone: e?.target?.value ?? ''})} /></div>
            <div><Label>E-Mail</Label><Input value={settings?.email ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), email: e?.target?.value ?? ''})} type="email" /></div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Section */}
      {activeSection === 'invoice' && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div>
              <Label>Steuerhinweis</Label>
              <Input value={settings?.taxInfo ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), taxInfo: e?.target?.value ?? ''})} />
              <p className="text-xs text-muted-foreground mt-1">Wird auf jeder Rechnung angezeigt</p>
            </div>
            <div>
              <Label>Rechnungs-Header (Zusatztext)</Label>
              <textarea
                value={settings?.invoiceHeader ?? ''}
                onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), invoiceHeader: e?.target?.value ?? ''})}
                className="w-full mt-1 p-2 text-sm border border-input rounded-md bg-background min-h-[100px] resize-y"
                placeholder="Optionaler Kopftext für Rechnungen. Sie können HTML verwenden für Formatierung (z.B. <b>fett</b>, <i>kursiv</i>)..."
              />
              <p className="text-xs text-muted-foreground mt-1">HTML-Formatierung möglich: &lt;b&gt;fett&lt;/b&gt;, &lt;i&gt;kursiv&lt;/i&gt;, &lt;u&gt;unterstrichen&lt;/u&gt;</p>
            </div>
            <div>
              <Label className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Firmenlogo</Label>
              {(settings?.logoUrl ?? '').trim() ? (
                <div className="mt-2 flex items-center gap-3">
                  <div className="w-20 h-20 rounded-lg border overflow-hidden bg-muted flex items-center justify-center">
                    <img src={settings?.logoUrl ?? ''} alt="Firmenlogo" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div>
                    <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Logo hochgeladen</p>
                    <label className="text-xs text-primary cursor-pointer hover:underline mt-1 inline-block">
                      Ändern
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="mt-2 flex items-center justify-center w-full h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <div className="text-center">
                    <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">{uploading ? 'Wird hochgeladen...' : 'Logo hochladen'}</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                </label>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order / Auftrag Section */}
      {activeSection === 'order' && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div>
              <Label>Haftungsausschluss-Text</Label>
              <textarea
                value={settings?.disclaimerDefaultText ?? ''}
                onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), disclaimerDefaultText: e?.target?.value ?? ''})}
                className="w-full mt-1 p-2 text-sm border border-input rounded-md bg-background min-h-[100px] resize-y"
                placeholder="Standard-Haftungsausschluss für Aufträge..."
              />
              <p className="text-xs text-muted-foreground mt-1">Wird automatisch in neue Aufträge übernommen. Der Kunde muss diesen vor Arbeitsbeginn unterschreiben.</p>
            </div>
            <div className="pt-2 border-t">
              <Label className="flex items-center gap-1 mb-2"><MapPin className="w-3.5 h-3.5" /> Firmensitz (für Zonenberechnung)</Label>
              <div><Label className="text-xs">Straße</Label><Input value={settings?.hqStreet ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), hqStreet: e?.target?.value ?? ''})} placeholder="Alte Schulstr 4" /></div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div><Label className="text-xs">PLZ</Label><Input value={settings?.hqZip ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), hqZip: e?.target?.value ?? ''})} placeholder="02694" /></div>
                <div className="col-span-2"><Label className="text-xs">Ort</Label><Input value={settings?.hqCity ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), hqCity: e?.target?.value ?? ''})} placeholder="Malschwitz" /></div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Dient als Startpunkt für die automatische Anfahrtszonenberechnung (Zone 1: 0-15km, Zone 2: 15-30km, Zone 3: 30-50km, Zone 4: 50+km).</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bank Section */}
      {activeSection === 'bank' && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div><Label>Bankname</Label><Input value={settings?.bankName ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), bankName: e?.target?.value ?? ''})} placeholder="z.B. Sparkasse Dresden" /></div>
            <div><Label>IBAN</Label><Input value={settings?.iban ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), iban: e?.target?.value ?? ''})} placeholder="DE..." className="font-mono" /></div>
            <div><Label>BIC</Label><Input value={settings?.bic ?? ''} onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), bic: e?.target?.value ?? ''})} placeholder="XXXDEFF" className="font-mono" /></div>
          </CardContent>
        </Card>
      )}

      {/* Gmail API Section */}
      {activeSection === 'gmail' && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs space-y-1">
              <p className="font-semibold">Gmail-Integration einrichten:</p>
              <ol className="list-decimal ml-4 space-y-0.5">
                <li>Gehe zu <a href="https://console.cloud.google.com" target="_blank" className="underline">Google Cloud Console</a></li>
                <li>Erstelle ein neues Projekt oder wähle ein bestehendes</li>
                <li>Aktiviere die <strong>Gmail API</strong></li>
                <li>Unter "Anmeldedaten" → "OAuth 2.0-Client-ID" erstellen</li>
                <li>Wähle "Webanwendung" als Typ</li>
                <li>Füge als Redirect-URI hinzu: <code className="bg-blue-100 px-1 rounded">{'<deine-app-url>'}/api/gmail/callback</code></li>
                <li>Kopiere Client-ID und Secret hierher</li>
              </ol>
            </div>
            <div>
              <Label>Google Client-ID</Label>
              <Input
                value={settings?.googleClientId ?? ''}
                onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), googleClientId: e?.target?.value ?? ''})}
                placeholder="xxxx.apps.googleusercontent.com"
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label>Google Client-Secret</Label>
              <Input
                value={settings?.googleClientSecret ?? ''}
                onChange={(e: any) => setSettings({...(settings ?? {} as SettingsData), googleClientSecret: e?.target?.value ?? ''})}
                placeholder="GOCSPX-..."
                type="password"
                className="font-mono text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">Nach dem Speichern gehe zum E-Mail-Tab, um dein Google-Konto zu verbinden.</p>
          </CardContent>
        </Card>
      )}

      {activeSection === 'team' && isAdmin && <TeamSettings />}

      {activeSection === 'theme' && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">Wähle das Erscheinungsbild der App.</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'system', label: 'System', icon: Monitor },
                { value: 'light', label: 'Hell', icon: Sun },
                { value: 'dark', label: 'Dunkel', icon: Moon },
              ].map((opt) => {
                const Icon = opt.icon;
                const isActive = mounted && theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      isActive
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {mounted && theme === 'system'
                ? 'Folgt automatisch den Einstellungen deines Geräts.'
                : mounted && theme === 'dark'
                ? 'Dunkles Design ist aktiviert.'
                : 'Helles Design ist aktiviert.'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {activeSection !== 'theme' && activeSection !== 'team' && (
        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Save className="w-4 h-4" />
        {saving ? 'Wird gespeichert...' : 'Einstellungen speichern'}
      </Button>
      )}
    </div>
  );
}
