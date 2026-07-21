import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export interface AccessInfo {
  id: number;
  email: string;
  name: string;
  role: string;   // ADMIN | EMPLOYEE
  status: string; // PENDING | APPROVED | REJECTED
  employeeNo: number | null;
}

/** Kleiner Retry-Helfer: die DB hat sehr kurze Timeouts, ein Kaltstart kann
 *  den ersten Query scheitern lassen. Wir versuchen es daher kurz erneut. */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3, delayMs = 250): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * Ermittelt den aktuell eingeloggten Supabase-Nutzer und dessen
 * Freigabe-Status in der AppUser-Tabelle.
 *
 * Bootstrap: Der allererste Nutzer (keine AppUser-Datensaetze vorhanden)
 * wird automatisch zum freigegebenen Administrator mit Mitarbeiter-Nr. 1.
 *
 * Alle weiteren neuen Nutzer landen als PENDING und muessen vom Admin
 * freigeschaltet werden.
 *
 * Wirft NICHT bei fehlender Anmeldung (gibt null zurueck). DB-Fehler werden
 * per Retry abgefangen; erst wenn alle Versuche scheitern, wird geworfen.
 */
export async function getAccessForCurrentUser(): Promise<AccessInfo | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user?.email) return null;

  const email = user.email.toLowerCase();
  const metaName = (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || '';

  const record = await withRetry(async () => {
    let rec = await prisma.appUser.findUnique({ where: { email } });
    if (rec) return rec;

    const count = await prisma.appUser.count();
    if (count === 0) {
      return prisma.appUser.create({
        data: { email, name: metaName, role: 'ADMIN', status: 'APPROVED', approvedAt: new Date(), employeeNo: 1 },
      });
    }
    // Naechste freie Mitarbeiternummer bestimmen
    const max = await prisma.appUser.aggregate({ _max: { employeeNo: true } });
    const nextNo = (max._max.employeeNo || 0) + 1;
    return prisma.appUser.create({
      data: { email, name: metaName, role: 'EMPLOYEE', status: 'PENDING', employeeNo: nextNo },
    });
  });

  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    status: record.status,
    employeeNo: record.employeeNo ?? null,
  };
}

/** true, wenn der aktuelle Nutzer freigegebener Administrator ist. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const access = await getAccessForCurrentUser();
  return !!access && access.role === 'ADMIN' && access.status === 'APPROVED';
}

/** Liefert den vollen Zugriffs-Datensatz oder null (fuer API-Gating). */
export async function requireApprovedUser(): Promise<AccessInfo | null> {
  const access = await getAccessForCurrentUser();
  if (!access || access.status !== 'APPROVED') return null;
  return access;
}

/* --------------------------------------------------------------------------
 * Datentrennung (Data-Isolation)
 *
 * Jeder Kunde gehoert dem Mitarbeiter, der ihn angelegt hat (Customer.ownerId).
 * Alle Belege (Rechnungen, Angebote, Auftraege, Arbeitsberichte, Geraete,
 * Erinnerungen) haengen an einem Kunden und erben so den Besitzer.
 * Ausgaben (Expense) haben einen eigenen ownerId.
 *
 * - Admin sieht ALLES.
 * - Mitarbeiter sieht NUR eigene Daten.
 * - Nicht freigegeben / nicht eingeloggt -> sieht NICHTS.
 * ------------------------------------------------------------------------ */
export interface Scope {
  access: AccessInfo | null;
  isAdmin: boolean;
  /** where-Filter fuer Modelle mit direktem ownerId-Feld (Customer, Expense). */
  ownerWhere: Record<string, any>;
  /** where-Filter fuer Belege ueber die Kunden-Relation (customer.ownerId). */
  customerWhere: Record<string, any>;
}

export async function getScope(): Promise<Scope> {
  const access = await getAccessForCurrentUser();
  const isAdmin = !!access && access.role === 'ADMIN' && access.status === 'APPROVED';
  if (isAdmin) {
    return { access, isAdmin: true, ownerWhere: {}, customerWhere: {} };
  }
  if (access && access.status === 'APPROVED') {
    return {
      access,
      isAdmin: false,
      ownerWhere: { ownerId: access.id },
      customerWhere: { customer: { ownerId: access.id } },
    };
  }
  // Nicht freigegeben / nicht eingeloggt -> unmoeglicher Filter, damit nichts sichtbar ist.
  return { access, isAdmin: false, ownerWhere: { id: -1 }, customerWhere: { id: -1 } };
}

/** Darf der aktuelle Nutzer auf diesen Kunden zugreifen? */
export async function canAccessCustomer(customerId: number): Promise<boolean> {
  const scope = await getScope();
  if (scope.isAdmin) return true;
  if (!scope.access || scope.access.status !== 'APPROVED') return false;
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { ownerId: true } });
  return !!c && c.ownerId === scope.access.id;
}

/** Darf der aktuelle Nutzer auf diesen Beleg zugreifen? (Besitz ueber Kunden-Relation) */
export async function canAccessBeleg(
  model: 'invoice' | 'quote' | 'order' | 'workLog' | 'deviceInventory' | 'reminder',
  id: number,
): Promise<boolean> {
  const scope = await getScope();
  if (scope.isAdmin) return true;
  if (!scope.access || scope.access.status !== 'APPROVED') return false;
  const rec: any = await (prisma as any)[model].findUnique({
    where: { id },
    select: { customer: { select: { ownerId: true } } },
  });
  return !!rec && rec.customer?.ownerId === scope.access.id;
}

/** Darf der aktuelle Nutzer auf diese Ausgabe zugreifen? */
export async function canAccessExpense(id: number): Promise<boolean> {
  const scope = await getScope();
  if (scope.isAdmin) return true;
  if (!scope.access || scope.access.status !== 'APPROVED') return false;
  const rec = await prisma.expense.findUnique({ where: { id }, select: { ownerId: true } });
  return !!rec && rec.ownerId === scope.access.id;
}
