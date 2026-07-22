'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Lock, User, FileText, Trash2, Download, Upload, Search, History, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { notifySuccess, notifyError } from '@/lib/toast';

const MOBILE_TEXT =
  'Diese Mitarbeiterverwaltungszentrale ist aus Gründen der Datensicherheit und Übersicht nur auf dem Desktop verfügbar. Bitte logge dich an einem PC ein.';

// Alle wählbaren Dokumentkategorien (Upload-Auswahl)
const DOC_CATEGORIES = [
  { value: 'AUSWEIS', label: 'Personalausweis' },
  { value: 'VERTRAG', label: 'Arbeitsvertrag' },
  { value: 'SV_AUSWEIS', label: 'SV-Ausweis' },
  { value: 'KK_BESCHEINIGUNG', label: 'Krankenkassen-Bescheinigung' },
  { value: 'AUFENTHALT', label: 'Aufenthalts-/Arbeitserlaubnis' },
  { value: 'A1', label: 'A1-Bescheinigung' },
  { value: 'FUEHRERSCHEIN', label: 'Führerschein' },
  { value: 'VERSICHERUNG', label: 'Versicherung' },
  { value: 'ZEUGNIS', label: 'Zeugnis' },
  { value: 'SONSTIGES', label: 'Sonstiges' },
];

// Pflicht-Dokumente für die Checkliste (Punkt 3)
const REQUIRED_DOCS = [
  { value: 'AUSWEIS', label: 'Personalausweis' },
  { value: 'VERTRAG', label: 'Arbeitsvertrag' },
  { value: 'SV_AUSWEIS', label: 'SV-Ausweis' },
  { value: 'KK_BESCHEINIGUNG', label: 'Krankenkassen-Bescheinigung' },
  { value: 'FUEHRERSCHEIN', label: 'Führerschein (für Außendienst)' },
];

const MARITAL = ['', 'ledig', 'verheiratet', 'geschieden', 'verwitwet', 'eingetr. Lebenspartnerschaft'];
const TAX_CLASSES = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
const EMPLOYMENT_TYPES = [
  { value: '', label: '—' },
  { value: 'MINIJOB', label: 'Minijob' },
  { value: 'TEILZEIT', label: 'Teilzeit' },
  { value: 'VOLLZEIT', label: 'Vollzeit' },
  { value: 'WERKSTUDENT', label: 'Werkstudent' },
  { value: 'AUSBILDUNG', label: 'Ausbildung' },
];
const EMPLOYMENT_STATUS = [
  { value: 'AKTIV', label: 'Aktiv' },
  { value: 'INAKTIV', label: 'Inaktiv' },
  { value: 'AUSGESCHIEDEN', label: 'Ausgeschieden' },
];

interface EmployeeDoc {
  id: number; category: string; fileName: string; mimeType: string; size: number; uploadedAt: string; expiryDate: string | null;
}

interface Employee {
  id: number; email: string; name: string; role: string; status: string; employeeNo: number | null;
  contactStreet: string; contactZip: string; contactCity: string; contactPhone: string;
  position: string; personalEmail: string; birthDate: string | null; startDate: string | null;
  emergencyContact: string; emergencyPhone: string; iban: string; taxId: string;
  socialSecurityNo: string; healthInsurance: string; internalNotes: string;
  birthPlace: string; nationality: string; maritalStatus: string; religion: string; taxClass: string;
  childAllowances: number | null; severelyDisabled: boolean; employmentType: string;
  weeklyHours: number | null; hourlyWage: number | null; monthlySalary: number | null;
  vacationDays: number | null; exitDate: string | null; employmentStatus: string;
}

function toDateInput(v: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function numStr(v: number | null | undefined): string {
  return v == null ? '' : String(v);
}

function fmtSize(n: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function expiryInfo(v: string | null): { level: 'ok' | 'soon' | 'expired'; days: number } | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return { level: 'expired', days };
  if (days <= 30) return { level: 'soon', days };
  return { level: 'ok', days };
}

/** Mitarbeiterverwaltungszentrale (nur Admin, nur Desktop). */
export function EmployeeManagement() {
  return (
    <>
      {/* Mobile-Sperre: nicht wegklickbar */}
      <div className="lg:hidden">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="font-display text-lg font-bold mb-2">Nur am Desktop</h2>
          <p className="text-sm text-muted-foreground">{MOBILE_TEXT}</p>
        </div>
      </div>

      {/* Desktop-Zentrale */}
      <div className="hidden lg:block">
        <ManagementDesktop />
      </div>
    </>
  );
}

function ManagementDesktop() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch {
      notifyError('Fehler', 'Die Mitarbeiterliste konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const filtered = employees.filter((e) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${e.name} ${e.email}`.toLowerCase().includes(q);
  });

  const selected = employees.find((e) => e.id === selectedId) || null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
      {/* Liste */}
      <Card className="shadow-sm h-fit">
        <CardContent className="p-3">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={(e: any) => setQuery(e.target.value)} placeholder="Suchen" className="pl-8" />
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Keine Mitarbeiter gefunden.</p>
          ) : (
            <div className="space-y-1 max-h-[70vh] overflow-y-auto">
              {filtered.map((e) => (
                <button key={e.id} onClick={() => setSelectedId(e.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${selectedId === e.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">
                        {e.name || e.email}
                        {e.employmentStatus && e.employmentStatus !== 'AKTIV' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                            {e.employmentStatus === 'AUSGESCHIEDEN' ? 'Ausgeschieden' : 'Inaktiv'}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {e.role === 'ADMIN' ? 'Administrator' : 'Mitarbeiter'}
                        {e.employeeNo ? ` · Nr. ${String(e.employeeNo).padStart(3, '0')}` : ''}
                        {e.status !== 'APPROVED' ? ` · ${e.status}` : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail */}
      <div>
        {selected ? (
          <EmployeeEditor key={selected.id} employee={selected} onSaved={loadEmployees} />
        ) : (
          <Card className="shadow-sm">
            <CardContent className="p-10 text-center text-muted-foreground">
              <User className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Wähle links einen Mitarbeiter aus, um seine Daten zu verwalten.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function EmployeeEditor({ employee, onSaved }: { employee: Employee; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: employee.name || '',
    position: employee.position || '',
    contactStreet: employee.contactStreet || '',
    contactZip: employee.contactZip || '',
    contactCity: employee.contactCity || '',
    contactPhone: employee.contactPhone || '',
    personalEmail: employee.personalEmail || '',
    birthDate: toDateInput(employee.birthDate),
    startDate: toDateInput(employee.startDate),
    exitDate: toDateInput(employee.exitDate),
    employmentStatus: employee.employmentStatus || 'AKTIV',
    birthPlace: employee.birthPlace || '',
    nationality: employee.nationality || '',
    maritalStatus: employee.maritalStatus || '',
    religion: employee.religion || '',
    taxClass: employee.taxClass || '',
    childAllowances: numStr(employee.childAllowances),
    severelyDisabled: !!employee.severelyDisabled,
    employmentType: employee.employmentType || '',
    weeklyHours: numStr(employee.weeklyHours),
    hourlyWage: numStr(employee.hourlyWage),
    monthlySalary: numStr(employee.monthlySalary),
    vacationDays: numStr(employee.vacationDays),
    emergencyContact: employee.emergencyContact || '',
    emergencyPhone: employee.emergencyPhone || '',
    iban: employee.iban || '',
    taxId: employee.taxId || '',
    socialSecurityNo: employee.socialSecurityNo || '',
    healthInsurance: employee.healthInsurance || '',
    internalNotes: employee.internalNotes || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const emailValid = !form.personalEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personalEmail);
  const ibanValid = !form.iban || form.iban.replace(/\s/g, '').length >= 15;

  const save = async () => {
    if (!form.name.trim()) { notifyError('Name fehlt', 'Der Name darf nicht leer sein.'); return; }
    if (!emailValid) { notifyError('E-Mail ungültig', 'Bitte eine gültige private E-Mail eingeben.'); return; }
    if (!ibanValid) { notifyError('IBAN prüfen', 'Die IBAN sieht zu kurz aus.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${employee.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'profile', ...form }),
      });
      if (!res.ok) throw new Error('save');
      notifySuccess('Gespeichert', 'Die Personaldaten wurden aktualisiert.');
      onSaved();
    } catch {
      notifyError('Fehler', 'Die Daten konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-display text-base font-bold mb-3">Stammdaten</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={set('name')} autoCapitalize="words" /></div>
            <div><Label>Funktion / Position</Label><Input value={form.position} onChange={set('position')} placeholder="z.B. Techniker" /></div>
            <div className="sm:col-span-2"><Label>Straße und Hausnummer</Label><Input value={form.contactStreet} onChange={set('contactStreet')} autoCapitalize="words" /></div>
            <div><Label>PLZ</Label><Input value={form.contactZip} onChange={set('contactZip')} inputMode="numeric" autoCorrect="off" /></div>
            <div><Label>Ort</Label><Input value={form.contactCity} onChange={set('contactCity')} autoCapitalize="words" /></div>
            <div><Label>Telefon</Label><Input value={form.contactPhone} onChange={set('contactPhone')} inputMode="tel" autoCorrect="off" /></div>
            <div>
              <Label>Private E-Mail</Label>
              <Input value={form.personalEmail} onChange={set('personalEmail')} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              {!emailValid && <p className="text-xs text-red-500 mt-1">Ungültige E-Mail.</p>}
            </div>
            <div><Label>Geburtsdatum</Label><Input type="date" value={form.birthDate} onChange={set('birthDate')} /></div>
            <div><Label>Geburtsort</Label><Input value={form.birthPlace} onChange={set('birthPlace')} autoCapitalize="words" /></div>
            <div><Label>Staatsangehörigkeit</Label><Input value={form.nationality} onChange={set('nationality')} autoCapitalize="words" placeholder="z.B. deutsch" /></div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-display text-base font-bold mb-3">Beschäftigung &amp; Vergütung</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Beschäftigungsart</Label>
              <select value={form.employmentType} onChange={set('employmentType')} className="w-full mt-1 h-10 px-2 text-sm border border-input rounded-md bg-background">
                {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select value={form.employmentStatus} onChange={set('employmentStatus')} className="w-full mt-1 h-10 px-2 text-sm border border-input rounded-md bg-background">
                {EMPLOYMENT_STATUS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><Label>Eintrittsdatum</Label><Input type="date" value={form.startDate} onChange={set('startDate')} /></div>
            <div><Label>Austrittsdatum</Label><Input type="date" value={form.exitDate} onChange={set('exitDate')} /></div>
            <div><Label>Wochenstunden</Label><Input value={form.weeklyHours} onChange={set('weeklyHours')} inputMode="decimal" autoCorrect="off" placeholder="z.B. 40" /></div>
            <div><Label>Urlaubsanspruch (Tage/Jahr)</Label><Input value={form.vacationDays} onChange={set('vacationDays')} inputMode="numeric" autoCorrect="off" placeholder="z.B. 24" /></div>
            <div><Label>Stundenlohn brutto (€)</Label><Input value={form.hourlyWage} onChange={set('hourlyWage')} inputMode="decimal" autoCorrect="off" /></div>
            <div><Label>Monatsgehalt brutto (€)</Label><Input value={form.monthlySalary} onChange={set('monthlySalary')} inputMode="decimal" autoCorrect="off" /></div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-display text-base font-bold mb-3">Steuer und Sozialversicherung</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Steuerklasse</Label>
              <select value={form.taxClass} onChange={set('taxClass')} className="w-full mt-1 h-10 px-2 text-sm border border-input rounded-md bg-background">
                {TAX_CLASSES.map((t) => <option key={t} value={t}>{t || '—'}</option>)}
              </select>
            </div>
            <div>
              <Label>Familienstand</Label>
              <select value={form.maritalStatus} onChange={set('maritalStatus')} className="w-full mt-1 h-10 px-2 text-sm border border-input rounded-md bg-background">
                {MARITAL.map((m) => <option key={m} value={m}>{m || '—'}</option>)}
              </select>
            </div>
            <div><Label>Konfession (Kirchensteuer)</Label><Input value={form.religion} onChange={set('religion')} placeholder="z.B. rk, ev, keine" /></div>
            <div><Label>Kinderfreibeträge</Label><Input value={form.childAllowances} onChange={set('childAllowances')} inputMode="decimal" autoCorrect="off" placeholder="z.B. 1 oder 0.5" /></div>
            <div><Label>Steuer-ID</Label><Input value={form.taxId} onChange={set('taxId')} inputMode="numeric" autoCorrect="off" /></div>
            <div><Label>Sozialversicherungsnummer</Label><Input value={form.socialSecurityNo} onChange={set('socialSecurityNo')} autoCorrect="off" /></div>
            <div><Label>Krankenkasse</Label><Input value={form.healthInsurance} onChange={set('healthInsurance')} autoCapitalize="words" /></div>
            <div>
              <Label>IBAN (für Lohn)</Label>
              <Input value={form.iban} onChange={set('iban')} autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="DE00 0000 0000 0000 0000 00" />
              {!ibanValid && <p className="text-xs text-red-500 mt-1">IBAN sieht zu kurz aus.</p>}
            </div>
            <label className="flex items-center gap-2 sm:col-span-2 mt-1 cursor-pointer select-none">
              <input type="checkbox" checked={form.severelyDisabled}
                onChange={(e) => setForm((f) => ({ ...f, severelyDisabled: e.target.checked }))}
                className="w-4 h-4 rounded border-input accent-primary" />
              <span className="text-sm">Schwerbehinderung vorhanden</span>
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            IBAN, Steuer-ID und SV-Nummer werden verschlüsselt gespeichert.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-display text-base font-bold mb-3">Notfallkontakt</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.emergencyContact} onChange={set('emergencyContact')} autoCapitalize="words" /></div>
            <div><Label>Telefon</Label><Input value={form.emergencyPhone} onChange={set('emergencyPhone')} inputMode="tel" autoCorrect="off" /></div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-display text-base font-bold mb-2">Interne Notizen</h3>
          <textarea value={form.internalNotes} onChange={set('internalNotes')}
            className="w-full p-2 text-sm border border-input rounded-md bg-background min-h-[90px] resize-y"
            placeholder="Nur für den Administrator sichtbar" />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>Personaldaten speichern</Button>
      </div>

      <DocumentsPanel userId={employee.id} />
      <AuditPanel userId={employee.id} />
    </div>
  );
}

function DocumentsPanel({ userId }: { userId: number }) {
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('AUSWEIS');
  const [expiry, setExpiry] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/documents`, { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      const data = await res.json();
      setDocs(Array.isArray(data?.documents) ? data.documents : []);
    } catch {
      notifyError('Fehler', 'Dokumente konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      notifyError('Zu groß', 'Die Datei darf höchstens 100 MB haben.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const presignRes = await fetch('/api/upload/presigned', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: `personal-${userId}-${Date.now()}-${file.name}`, contentType: file.type, isPublic: false }),
      });
      if (!presignRes.ok) throw new Error('presign');
      const { uploadUrl, cloud_storage_path } = await presignRes.json();
      const putRes = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream', 'Content-Disposition': 'attachment' } });
      if (!putRes.ok) throw new Error('put');
      const metaRes = await fetch(`/api/users/${userId}/documents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, fileName: file.name, filePath: cloud_storage_path, mimeType: file.type, size: file.size, expiryDate: expiry || null }),
      });
      if (!metaRes.ok) throw new Error('meta');
      notifySuccess('Hochgeladen', 'Das Dokument wurde gespeichert.');
      setExpiry('');
      load();
    } catch {
      notifyError('Fehler', 'Der Upload ist fehlgeschlagen.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const download = async (docId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/documents/${docId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('url');
      const { url } = await res.json();
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', '');
      a.setAttribute('target', '_blank');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      notifyError('Fehler', 'Der Download konnte nicht gestartet werden.');
    }
  };

  const remove = async (docId: number) => {
    if (!window.confirm('Dieses Dokument wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/users/${userId}/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('del');
      notifySuccess('Gelöscht', 'Das Dokument wurde entfernt.');
      setDocs((d) => d.filter((x) => x.id !== docId));
    } catch {
      notifyError('Fehler', 'Das Dokument konnte nicht gelöscht werden.');
    }
  };

  const catLabel = (v: string) => DOC_CATEGORIES.find((c) => c.value === v)?.label || 'Sonstiges';

  // Checklisten-Status je Pflicht-Dokument
  const checklist = REQUIRED_DOCS.map((req) => {
    const items = docs.filter((d) => d.category === req.value);
    if (items.length === 0) return { ...req, state: 'missing' as const };
    let worst: 'ok' | 'soon' | 'expired' = 'ok';
    for (const it of items) {
      const info = expiryInfo(it.expiryDate);
      if (info?.level === 'expired') worst = 'expired';
      else if (info?.level === 'soon' && worst !== 'expired') worst = 'soon';
    }
    return { ...req, state: worst === 'expired' ? ('expired' as const) : worst === 'soon' ? ('soon' as const) : ('present' as const) };
  });
  const doneCount = checklist.filter((c) => c.state === 'present').length;

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="font-display text-base font-bold">Sensible Dokumente</h3>
        </div>

        {/* Pflicht-Checkliste */}
        <div className="mb-4 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Pflicht-Checkliste</span>
            <span className="text-xs text-muted-foreground">{doneCount}/{REQUIRED_DOCS.length} vollständig</span>
          </div>
          <div className="space-y-1.5">
            {checklist.map((c) => (
              <div key={c.value} className="flex items-center gap-2 text-sm">
                {c.state === 'present' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                ) : c.state === 'soon' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                ) : c.state === 'expired' ? (
                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                )}
                <span className={c.state === 'missing' ? 'text-muted-foreground' : ''}>{c.label}</span>
                <span className="ml-auto text-xs">
                  {c.state === 'present' && <span className="text-green-600">vorhanden</span>}
                  {c.state === 'soon' && <span className="text-amber-500">läuft bald ab</span>}
                  {c.state === 'expired' && <span className="text-red-600">abgelaufen</span>}
                  {c.state === 'missing' && <span className="text-muted-foreground">fehlt</span>}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          Verträge, Versicherungen, Ausweise und mehr. Dateien werden verschlüsselt und privat gespeichert.
        </p>

        <div className="flex flex-wrap items-end gap-2 mb-4 p-3 rounded-lg bg-muted/50">
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs">Kategorie</Label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full mt-1 h-10 px-2 text-sm border border-input rounded-md bg-background">
              {DOC_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="min-w-[150px]">
            <Label className="text-xs">Ablaufdatum (optional)</Label>
            <Input type="date" value={expiry} onChange={(e: any) => setExpiry(e.target.value)} className="mt-1" />
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={onFilePicked} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} loading={uploading}>
            <Upload className="w-4 h-4" /> Datei hochladen
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Noch keine Dokumente hinterlegt.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => {
              const info = expiryInfo(d.expiryDate);
              return (
                <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">{catLabel(d.category)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtSize(d.size)}{d.size ? ' · ' : ''}{new Date(d.uploadedAt).toLocaleDateString('de-DE', { timeZone: 'UTC' })}
                      {d.expiryDate && (
                        <span className={info?.level === 'expired' ? ' text-red-600' : info?.level === 'soon' ? ' text-amber-500' : ''}>
                          {' · gültig bis '}{new Date(d.expiryDate).toLocaleDateString('de-DE', { timeZone: 'UTC' })}
                          {info?.level === 'expired' ? ' (abgelaufen)' : info?.level === 'soon' ? ` (in ${info.days} T.)` : ''}
                        </span>
                      )}
                    </p>
                  </div>
                  <button onClick={() => download(d.id)} title="Herunterladen" className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(d.id)} title="Löschen" className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AuditEntry {
  id: number; actorName: string; action: string; entity: string; summary: string; createdAt: string;
}

function AuditPanel({ userId }: { userId: number }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/audit-log?entityId=${userId}&limit=30`, { cache: 'no-store' });
        if (!res.ok) throw new Error('load');
        const data = await res.json();
        if (active) setLogs(Array.isArray(data?.logs) ? data.logs : []);
      } catch {
        if (active) setLogs([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [userId]);

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-primary" />
          <h3 className="font-display text-base font-bold">Änderungsprotokoll</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">Noch keine Änderungen protokolliert.</p>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="flex items-start gap-2 text-sm border-b border-border/60 pb-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{l.summary || `${l.action} ${l.entity}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.actorName || 'System'} · {new Date(l.createdAt).toLocaleString('de-DE', { timeZone: 'UTC' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
