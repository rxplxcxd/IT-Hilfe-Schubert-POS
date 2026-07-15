import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Admin-Client mit Service-Role-Key.
 * NUR serverseitig verwenden (z. B. fuer Storage-Uploads).
 * Umgeht Row-Level-Security - niemals im Browser einbinden!
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
