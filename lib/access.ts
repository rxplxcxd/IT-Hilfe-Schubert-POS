import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export interface AccessInfo {
  email: string;
  name: string;
  role: string;   // ADMIN | EMPLOYEE
  status: string; // PENDING | APPROVED | REJECTED
}

/**
 * Ermittelt den aktuell eingeloggten Supabase-Nutzer und dessen
 * Freigabe-Status in der AppUser-Tabelle.
 *
 * Bootstrap: Der allererste Nutzer (keine AppUser-Datensaetze vorhanden)
 * wird automatisch zum freigegebenen Administrator. So wird das bereits
 * bestehende Inhaber-Konto beim ersten Login zum Admin.
 *
 * Alle weiteren neuen Nutzer landen als PENDING und muessen vom Admin
 * freigeschaltet werden.
 */
export async function getAccessForCurrentUser(): Promise<AccessInfo | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user?.email) return null;

  const email = user.email.toLowerCase();
  const metaName = (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || '';

  let record = await prisma.appUser.findUnique({ where: { email } });

  if (!record) {
    const count = await prisma.appUser.count();
    if (count === 0) {
      record = await prisma.appUser.create({
        data: { email, name: metaName, role: 'ADMIN', status: 'APPROVED', approvedAt: new Date() },
      });
    } else {
      record = await prisma.appUser.create({
        data: { email, name: metaName, role: 'EMPLOYEE', status: 'PENDING' },
      });
    }
  }

  return { email: record.email, name: record.name, role: record.role, status: record.status };
}

/** true, wenn der aktuelle Nutzer freigegebener Administrator ist. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const access = await getAccessForCurrentUser();
  return !!access && access.role === 'ADMIN' && access.status === 'APPROVED';
}
