export const dynamic = 'force-dynamic';

import { TerminBuchung } from './termin-buchung';
import { prisma } from '@/lib/prisma';

export default async function TerminPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const logoUrl = settings?.logoPath ?? '';

  return (
    <TerminBuchung
      companyName={settings?.companyName || 'IT-Hilfe Schubert'}
      ownerName={settings?.ownerName || 'Leon Schubert'}
      phone={settings?.phone || ''}
      email={settings?.email || ''}
      logoUrl={logoUrl}
    />
  );
}
