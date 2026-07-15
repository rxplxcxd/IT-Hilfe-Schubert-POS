import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase Client fuer den Browser (Client Components).
 * Nutzt den oeffentlichen Anon-Key.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
