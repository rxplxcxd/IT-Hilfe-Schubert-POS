'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, Circle, Mail, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { notifySuccess, notifyError } from '@/lib/toast';
import { OnboardingTour } from './onboarding-tour';

interface ProfileStatus {
  name: string;
  hasName: boolean;
  hasAddress: boolean;
  hasPhone: boolean;
  gmailConnected: boolean;
  complete: boolean;
  onboardingDone: boolean;
  isAdmin: boolean;
  failOpen?: boolean;
}

/**
 * Globale Zugangssperre fuer neue Mitarbeiter.
 *
 * Solange Name, Anschrift, Telefon und die Gmail-Verbindung nicht komplett
 * sind, ist die App gesperrt und es erscheint nur das Setup-Fenster. Der
 * Administrator (Leon) umgeht die Sperre immer.
 *
 * Fail-open: Wenn der Status nicht geladen werden kann, wird NICHT gesperrt,
 * damit im Stoerungsfall niemand ausgesperrt bleibt.
 */
export function EmployeeGate({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ProfileStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/status', { cache: 'no-store' });
      if (!res.ok) throw new Error('status');
      const data = (await res.json()) as ProfileStatus;
      setStatus(data);
    } catch {
      // Fail-open: nicht sperren
      setStatus({
        name: '', hasName: true, hasAddress: true, hasPhone: true,
        gmailConnected: true, complete: true, onboardingDone: true,
        isAdmin, failOpen: true,
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const unlocked = isAdmin || !!status?.complete;

  if (!unlocked && status) {
    return <ProfileSetup status={status} onComplete={load} />;
  }

  return (
    <>
      {children}
      {status && !status.onboardingDone && <OnboardingTour onFinish={() => setStatus({ ...status, onboardingDone: true })} />}
    </>
  );
}

function Requirement({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-500 shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
      <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}

/** Nicht wegklickbares Setup-Fenster fuer kritische Profildaten. */
function ProfileSetup({ status, onComplete }: { status: ProfileStatus; onComplete: () => void }) {
  const [name, setName] = useState(status.name || '');
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Vorhandene Kontaktdaten laden, damit der Mitarbeiter nur Luecken fuellt.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        if (res.ok) {
          const s = await res.json();
          setName((prev) => prev || s?.ownerName || '');
          setStreet(s?.street || '');
          setZip(s?.zip || '');
          setCity(s?.city || '');
          setPhone(s?.phone || '');
        }
      } catch {}
      finally { setLoadingData(false); }
    })();
  }, []);

  const saveData = async () => {
    if (!name.trim() || !street.trim() || !zip.trim() || !city.trim() || !phone.trim()) {
      notifyError('Bitte alles ausfüllen', 'Name, Anschrift und Telefon sind Pflicht.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName: name.trim(), street: street.trim(), zip: zip.trim(), city: city.trim(), phone: phone.trim() }),
      });
      if (!res.ok) throw new Error('save');
      notifySuccess('Gespeichert', 'Deine Daten wurden übernommen.');
      onComplete();
    } catch {
      notifyError('Fehler', 'Deine Daten konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const connectGmail = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/gmail/auth', { cache: 'no-store' });
      const data = await res.json();
      if (data?.connected) {
        notifySuccess('Verbunden', 'Dein Postfach ist verknüpft.');
        onComplete();
        return;
      }
      if (data?.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      notifyError('Nicht möglich', data?.error || 'Die Verbindung konnte nicht gestartet werden.');
    } catch {
      notifyError('Fehler', 'Die Gmail-Verbindung konnte nicht gestartet werden.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-background">
      <div className="min-h-full flex items-start sm:items-center justify-center p-4">
        <div className="w-full max-w-md bg-card text-card-foreground rounded-2xl shadow-xl border border-border p-5 my-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h1 className="font-display text-lg font-bold">Kritische Profildaten vervollständigen</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Bevor es losgeht, brauchen wir noch ein paar Angaben von dir. Erst danach schaltet sich die App komplett frei.
          </p>

          <div className="space-y-1.5 mb-4 rounded-lg bg-muted/50 p-3">
            <Requirement ok={status.hasName} label="Name" />
            <Requirement ok={status.hasAddress} label="Anschrift (Straße, PLZ, Ort)" />
            <Requirement ok={status.hasPhone} label="Telefonnummer" />
            <Requirement ok={status.gmailConnected} label="Gmail-Postfach verbunden" />
          </div>

          {loadingData ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Dein Name</Label>
                <Input value={name} onChange={(e: any) => setName(e.target.value)} autoCapitalize="words" placeholder="Max Mustermann" />
              </div>
              <div>
                <Label>Straße und Hausnummer</Label>
                <Input value={street} onChange={(e: any) => setStreet(e.target.value)} autoCapitalize="words" placeholder="Musterstraße 1" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>PLZ</Label>
                  <Input value={zip} onChange={(e: any) => setZip(e.target.value)} inputMode="numeric" autoCapitalize="none" autoCorrect="off" placeholder="02694" />
                </div>
                <div className="col-span-2">
                  <Label>Ort</Label>
                  <Input value={city} onChange={(e: any) => setCity(e.target.value)} autoCapitalize="words" placeholder="Malschwitz" />
                </div>
              </div>
              <div>
                <Label>Telefon</Label>
                <Input value={phone} onChange={(e: any) => setPhone(e.target.value)} inputMode="tel" autoCapitalize="none" autoCorrect="off" placeholder="0170 1234567" />
              </div>

              <Button onClick={saveData} loading={saving} className="w-full">Daten speichern</Button>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Gmail-Postfach</span>
                  {status.gmailConnected && <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-500" />}
                </div>
                {status.gmailConnected ? (
                  <p className="text-sm text-muted-foreground">Dein Postfach ist bereits verbunden.</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-2">
                      Verbinde dein Postfach, damit du direkt aus der App heraus mit Kunden schreiben kannst.
                    </p>
                    <Button variant="outline" onClick={connectGmail} loading={connecting} className="w-full">
                      Mit Gmail verbinden
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
