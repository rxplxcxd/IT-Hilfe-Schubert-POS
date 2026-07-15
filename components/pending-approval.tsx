'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Clock, XCircle, AlertTriangle, LogOut, RefreshCw } from 'lucide-react';

type Status = 'PENDING' | 'REJECTED' | 'ERROR' | 'UNAUTHENTICATED' | string;

export function PendingApproval({ status, name }: { status: Status; name?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const logout = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    router.replace('/login');
    router.refresh();
  };

  let icon = <Clock className="w-8 h-8" />;
  let iconBg = 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400';
  let title = 'Warten auf Freigabe';
  let message =
    'Deine Registrierung wurde erfolgreich eingereicht und muss noch vom Administrator freigegeben werden. Du erhältst eine E-Mail, sobald dein Zugang aktiv ist.';

  if (status === 'REJECTED') {
    icon = <XCircle className="w-8 h-8" />;
    iconBg = 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400';
    title = 'Zugang abgelehnt';
    message =
      'Dein Zugang wurde vom Administrator abgelehnt. Bitte wende dich an den Inhaber, falls das ein Irrtum ist.';
  } else if (status === 'ERROR') {
    icon = <AlertTriangle className="w-8 h-8" />;
    iconBg = 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400';
    title = 'Etwas ist schiefgelaufen';
    message =
      'Dein Zugriffsstatus konnte gerade nicht geprüft werden. Bitte versuche es in einem Moment erneut oder melde dich neu an.';
  } else if (status === 'UNAUTHENTICATED') {
    icon = <LogOut className="w-8 h-8" />;
    iconBg = 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300';
    title = 'Bitte anmelden';
    message = 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.';
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-blue-700 flex items-center justify-center text-white text-2xl font-bold">
          IT
        </div>
        <div className={`mx-auto mb-5 h-16 w-16 rounded-2xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
        {name ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Hallo {name || ''}</p>
        ) : null}
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">{message}</p>

        <div className="mt-7 space-y-2">
          <button
            onClick={() => router.refresh()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 transition"
          >
            <RefreshCw className="w-4 h-4" /> Status aktualisieren
          </button>
          <button
            onClick={logout}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium py-2.5 transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            <LogOut className="w-4 h-4" /> Abmelden
          </button>
        </div>
      </div>
    </div>
  );
}
