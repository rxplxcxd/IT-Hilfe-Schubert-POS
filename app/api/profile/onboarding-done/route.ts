import { NextResponse } from 'next/server';
import { getAccessForCurrentUser } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Markiert das Onboarding des aktuellen Nutzers als abgeschlossen,
 * damit die Tour kein zweites Mal startet.
 */
export async function POST() {
  try {
    const access = await getAccessForCurrentUser();
    if (!access) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    await prisma.appUser.update({
      where: { id: access.id },
      data: { onboardingDone: true },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[profile/onboarding-done] Fehler:', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
