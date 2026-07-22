import { NextResponse } from 'next/server';
import { getAccessForCurrentUser } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Liefert den Vollstaendigkeits-Status des aktuellen Nutzerprofils.
 * Wird vom EmployeeGate genutzt, um die App zu sperren, bis alle
 * kritischen Profildaten vorhanden sind.
 *
 * Admins umgehen das Gate immer (complete = true).
 *
 * Fail-open: Bei Fehlern geben wir complete = true zurueck, damit im
 * Stoerungsfall niemand ausgesperrt wird.
 */
export async function GET() {
  try {
    const access = await getAccessForCurrentUser();
    if (!access) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const isAdmin = access.role === 'ADMIN';

    // Vollstaendige Nutzerdaten laden
    const user = await prisma.appUser.findUnique({
      where: { id: access.id },
      select: {
        name: true,
        contactStreet: true,
        contactZip: true,
        contactCity: true,
        contactPhone: true,
        onboardingDone: true,
      },
    });

    // Gmail-Verbindung pruefen: Token mit nicht-leerem refreshToken
    const token = await prisma.gmailToken.findUnique({ where: { userId: access.id } });
    const gmailConnected = !!(token && token.refreshToken && token.refreshToken.trim().length > 0);

    const hasName = !!(user?.name && user.name.trim().length > 0);
    const hasAddress = !!(
      user?.contactStreet && user.contactStreet.trim() &&
      user?.contactZip && user.contactZip.trim() &&
      user?.contactCity && user.contactCity.trim()
    );
    const hasPhone = !!(user?.contactPhone && user.contactPhone.trim().length > 0);

    // Admin umgeht das Gate komplett
    const complete = isAdmin ? true : (hasName && hasAddress && hasPhone && gmailConnected);

    return NextResponse.json({
      name: user?.name || access.name || '',
      hasName,
      hasAddress,
      hasPhone,
      gmailConnected,
      complete,
      onboardingDone: !!user?.onboardingDone,
      isAdmin,
    });
  } catch (e) {
    console.error('[profile/status] Fehler:', e);
    // Fail-open: niemanden aussperren
    return NextResponse.json({
      name: '',
      hasName: true,
      hasAddress: true,
      hasPhone: true,
      gmailConnected: true,
      complete: true,
      onboardingDone: true,
      isAdmin: false,
      failOpen: true,
    });
  }
}
