'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message || 'Registrierung fehlgeschlagen.');
        setLoading(false);
        return;
      }
      // Falls E-Mail-Bestätigung aktiv ist, gibt es noch keine Session.
      if (data.session) {
        router.replace('/');
        router.refresh();
      } else {
        setInfo('Konto erstellt. Bitte bestätige deine E-Mail-Adresse und melde dich anschließend an.');
        setLoading(false);
      }
    } catch {
      setError('Ein Fehler ist aufgetreten.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-blue-700 flex items-center justify-center text-white text-2xl font-bold">IT</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Konto erstellen</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Der erste registrierte Nutzer wird automatisch Administrator.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-Mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="name@beispiel.de"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Passwort</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Mindestens 6 Zeichen"
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
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {info ? <p className="text-sm text-green-600">{info}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 transition disabled:opacity-60"
          >
            {loading ? 'Konto wird erstellt …' : 'Registrieren'}
          </button>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Bereits ein Konto?{' '}
            <Link href="/login" className="text-blue-700 dark:text-blue-400 font-medium hover:underline">Anmelden</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
