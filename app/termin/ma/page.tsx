export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { TerminBuchung } from '../termin-buchung';

/**
 * /termin/ma?nr=2
 * Mitarbeiter-spezifische Terminbuchungsseite.
 * Laed automatisch die Kontaktdaten des Mitarbeiters anhand seiner employeeNo.
 * Ohne ?nr => Redirect auf /termin (Admin-Standard).
 */
export default async function MitarbeiterTerminPage({
  searchParams,
}: {
  searchParams: { nr?: string };
}) {
  const nr = searchParams.nr;
  if (!nr) redirect('/termin');

  const empNo = parseInt(nr, 10);
  if (isNaN(empNo)) redirect('/termin');

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const emp = await prisma.appUser.findFirst({
    where: { employeeNo: empNo, status: 'APPROVED' },
  });

  // Fallback: wenn MA nicht gefunden, zeige Admin-Daten
  const name = emp?.name || settings?.ownerName || 'IT-Hilfe Schubert';
  const phone = emp?.contactPhone || settings?.phone || '';
  const email = settings?.email || '';
  const logoUrl = settings?.logoPath ?? '';

  return (
    <TerminBuchung
      companyName={settings?.companyName || 'IT-Hilfe Schubert'}
      ownerName={name}
      phone={phone}
      email={email}
      logoUrl={logoUrl}
      employeeNo={empNo}
      employeeName={emp?.name || undefined}
    />
  );
}
