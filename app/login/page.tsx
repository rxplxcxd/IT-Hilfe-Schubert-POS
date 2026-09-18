'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

// Butterweiche Ease-Out-Kurve für das Hereinfahren der Hände.
const EASE_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1];

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
    <div className="relative min-h-screen overflow-hidden bg-[#0a0f1e] flex items-center justify-center px-4">
      {/* Obere Hand: fährt langsam und weich von rechts oben herein, über dem Login-Feld. */}
      <div className="pointer-events-none select-none absolute top-0 inset-x-0 flex justify-center">
        <motion.img
          src="/login-logo-top.png"
          alt=""
          aria-hidden="true"
          className="w-[125%] max-w-xl h-auto"
          initial={{ x: '58%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 1.7, ease: EASE_SOFT, delay: 0.15 }}
        />
      </div>

      {/* Untere Hand: fährt langsam und weich von links unten herein, unter dem Login-Feld. */}
      <div className="pointer-events-none select-none absolute bottom-0 inset-x-0 flex justify-center">
        <motion.img
          src="/login-logo-bottom.png"
          alt="IT-Hilfe Schubert"
          className="w-[125%] max-w-xl h-auto"
          initial={{ x: '-58%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 1.7, ease: EASE_SOFT, delay: 0.35 }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <motion.div
            className="mx-auto mb-4 w-24 h-24 rounded-2xl bg-white p-2 flex items-center justify-center shadow-lg shadow-blue-950/40"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE_SOFT, delay: 0.5 }}
          >
            <img src="/login-logo-full.png" alt="IT-Hilfe Schubert Logo" className="w-full h-full object-contain" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">IT-Hilfe Schubert</h1>
          <p className="text-sm text-slate-400 mt-1">Bitte anmelden, um fortzufahren</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900/80 backdrop-blur rounded-2xl shadow-xl border border-slate-800 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">E-Mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="name@beispiel.de"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Passwort</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="••••••••"
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 transition disabled:opacity-60"
          >
            {loading ? 'Anmelden …' : 'Anmelden'}
          </button>

          <p className="text-center text-sm text-slate-400">
            Noch kein Konto?{' '}
            <Link href="/register" className="text-blue-400 font-medium hover:underline">Registrieren</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]" />}>
      <LoginForm />
    </Suspense>
  );
}
