'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Einladungs-Annahme-Seite (Punkt 10).
 *
 * Der eingeladene Mitarbeiter oeffnet den Link aus der E-Mail, setzt
 * sein Passwort und wird sofort freigeschaltet (kein Warten auf Admin).
 */
export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [step, setStep] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');

  // Token validieren
  useEffect(() => {
    if (!token) { setStep('error'); setErrorMsg('Kein Einladungs-Token gefunden.'); return; }

    (async () => {
      try {
        // Einfach pruefen ob das Token existiert (GET /api/users/invite?token=...)
        const res = await fetch('/api/users/invite?token=' + encodeURIComponent(token), { cache: 'no-store' });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setErrorMsg(j?.error || 'Einladung ungültig oder abgelaufen.');
          setStep('error');
          return;
        }
        const data = await res.json();
        setEmail(data?.email || '');
        setUserName(data?.name || '');
        setStep('form');
      } catch {
        setErrorMsg('Verbindungsfehler. Bitte versuche es erneut.');
        setStep('error');
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setErrorMsg('Mindestens 6 Zeichen.'); return; }
    if (password !== confirm) { setErrorMsg('Passwörter stimmen nicht überein.'); return; }
    setErrorMsg('');
    setSaving(true);

    try {
      // 1. Konto serverseitig anlegen & freischalten (sofort bestaetigt,
      //    keine separate E-Mail-Bestaetigung noetig).
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrorMsg(j?.error || 'Freischaltung fehlgeschlagen.');
        setSaving(false);
        return;
      }

      // 2. Einloggen
      const supabase = createClient();
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
      if (loginErr) {
        // Einloggen fehlgeschlagen -> trotzdem Erfolg anzeigen, Login geht manuell
        setStep('success');
        setSaving(false);
        return;
      }

      // Erfolg -> zur App
      setStep('success');
      setTimeout(() => {
        router.replace('/');
        router.refresh();
      }, 2000);
    } catch {
      setErrorMsg('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-blue-700 flex items-center justify-center text-white text-2xl font-bold">IT</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Willkommen im Team!</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {step === 'form' && userName ? `Hallo ${userName}! Erstelle jetzt dein Passwort.` : 'Einladung wird geprüft…'}
          </p>
        </div>

        {step === 'loading' && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-700" />
          </div>
        )}

        {step === 'error' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-sm text-slate-700 dark:text-slate-300">{errorMsg}</p>
            <a href="/login" className="inline-block text-sm text-blue-700 dark:text-blue-400 font-medium hover:underline">
              Zur Anmeldung
            </a>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deine E-Mail</label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-slate-600 dark:text-slate-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Passwort festlegen</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Mindestens 6 Zeichen"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Passwort bestätigen</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 transition disabled:opacity-60"
            >
              {saving ? 'Konto wird erstellt…' : 'Konto erstellen & loslegen'}
            </button>
          </form>
        )}

        {step === 'success' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Geschafft!</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Dein Konto ist aktiv. Du wirst gleich weitergeleitet…
            </p>
            <Loader2 className="w-5 h-5 animate-spin text-blue-700 mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
}
