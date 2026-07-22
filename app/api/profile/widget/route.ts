import { NextResponse } from 'next/server';
import { getAccessForCurrentUser } from '@/lib/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Persoenliche Konfiguration des Start-Hero-Widgets ("Guten Tag"-Streifen).
 * Jeder Mitarbeiter kann seine eigenen Module waehlen & sortieren.
 * Gespeichert als JSON-String in AppUser.dashboardConfig.
 */
export async function GET() {
  try {
    const access = await getAccessForCurrentUser();
    if (!access) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    const user = await prisma.appUser.findUnique({
      where: { id: access.id },
      select: { dashboardConfig: true },
    });
    let config: any = null;
    if (user?.dashboardConfig && user.dashboardConfig.trim().length > 0) {
      try { config = JSON.parse(user.dashboardConfig); } catch { config = null; }
    }
    return NextResponse.json({ config });
  } catch (e) {
    console.error('[profile/widget] GET Fehler:', e);
    return NextResponse.json({ config: null });
  }
}

export async function PUT(request: Request) {
  try {
    const access = await getAccessForCurrentUser();
    if (!access) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    const body = await request.json();
    const config = body?.config ?? null;
    // Defensive: nur ein kompaktes, valides Objekt speichern.
    const serialized = config ? JSON.stringify(config).slice(0, 4000) : '';
    await prisma.appUser.update({
      where: { id: access.id },
      data: { dashboardConfig: serialized },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[profile/widget] PUT Fehler:', e);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
