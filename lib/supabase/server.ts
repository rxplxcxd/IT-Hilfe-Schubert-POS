import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase Client fuer Server Components / Route Handler.
 * Liest & schreibt die Auth-Cookies der aktuellen Anfrage.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // In Server Components kann set() fehlschlagen - wird von der
            // Middleware aufgefangen, die die Session ohnehin aktualisiert.
          }
        },
      },
    }
  );
}
