export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';

export async function POST() {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    // Nur das eigene Token entfernen.
    await prisma.gmailToken.deleteMany({ where: { userId: access.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Gmail disconnect error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
