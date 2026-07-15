import { toast } from 'sonner';

/**
 * Zentrales, aussagekraeftiges Toast-System.
 * Baut auf sonner auf (richColors + closeButton siehe components/ui/sonner.tsx).
 * Einheitliche Titel + Beschreibungen + sinnvolle Anzeigedauern.
 */

export function notifySuccess(title: string, description?: string) {
  return toast.success(title, { description, duration: 4000 });
}

export function notifyError(title: string, description?: string) {
  return toast.error(title, {
    description: description ?? 'Bitte versuche es erneut.',
    duration: 6000,
  });
}

export function notifyInfo(title: string, description?: string) {
  return toast.info(title, { description, duration: 4500 });
}

export function notifyWarning(title: string, description?: string) {
  return toast.warning(title, { description, duration: 5000 });
}

export function notifyReminder(title: string, description?: string) {
  return toast(title, { description, duration: 6000, icon: '🔔' });
}

export function notifyLoading(title: string, description?: string) {
  return toast.loading(title, { description });
}

/** Verknuepft einen Promise mit Lade-/Erfolgs-/Fehler-Toasts. */
export function notifyPromise<T>(
  promise: Promise<T>,
  msgs: { loading: string; success: string; error: string }
) {
  return toast.promise(promise, msgs);
}

export function dismissToast(id?: string | number) {
  toast.dismiss(id);
}
