export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';

/**
 * Verschiebt eine Nachricht ins Archiv bzw. wieder zurueck, oder loescht sie
 * endgueltig aus dem eigenen Postfach-Speicher. Wirkt nur auf die App-Kopie,
 * nicht auf das Gmail-Konto.
 */
export async function POST(request: Request) {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const { id, action } = await request.json();
    const idNum = parseInt(String(id), 10);
    if (Number.isNaN(idNum)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const row = await prisma.emailMessage.findFirst({ where: { id: idNum, ownerId: access.id } });
    if (!row) return NextResponse.json({ error: 'Nachricht nicht gefunden' }, { status: 404 });

    if (action === 'delete') {
      await prisma.emailMessage.delete({ where: { id: row.id } });
      return NextResponse.json({ success: true, deleted: true });
    }

    const archive = action !== 'unarchive';
    await prisma.emailMessage.update({
      where: { id: row.id },
      data: { isArchived: archive },
    });
    return NextResponse.json({ success: true, isArchived: archive });
  } catch (error: any) {
    console.error('Mail archive error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Fehler bei der Archivierung.' }, { status: 500 });
  }
}
