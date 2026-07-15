'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.');
        setLoading(false);
        return;
      }

      // Freigabe-Status prüfen. Nicht freigegebene Konten werden sofort abgemeldet.
      try {
        const res = await fetch('/api/auth/access', { cache: 'no-store' });
        const j = await res.json();
        if (j?.authenticated && j?.status && j.status !== 'APPROVED') {
          await supabase.auth.signOut();
          if (j.status === 'REJECTED') {
            setError('Dein Zugang wurde abgelehnt. Bitte kontaktiere den Administrator.');
          } else {
            setError('Dein Konto wartet noch auf die Freigabe durch den Administrator.');
          }
          setLoading(false);
          return;
        }
      } catch {
        /* im Zweifel Anmeldung zulassen; die Startseite prüft den Status erneut */
      }

      router.replace(redirectTo);
      router.refresh();
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">IT-Hilfe Schubert</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Bitte anmelden, um fortzufahren</p>
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
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 transition disabled:opacity-60"
          >
            {loading ? 'Anmelden …' : 'Anmelden'}
          </button>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Noch kein Konto?{' '}
            <Link href="/register" className="text-blue-700 dark:text-blue-400 font-medium hover:underline">Registrieren</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950" />}>
      <LoginForm />
    </Suspense>
  );
}
