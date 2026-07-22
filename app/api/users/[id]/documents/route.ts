export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCurrentUserAdmin } from '@/lib/access';
import { logAudit } from '@/lib/audit';

const CATEGORIES = [
  'AUSWEIS', 'VERTRAG', 'SV_AUSWEIS', 'KK_BESCHEINIGUNG', 'AUFENTHALT',
  'A1', 'FUEHRERSCHEIN', 'VERSICHERUNG', 'ZEUGNIS', 'SONSTIGES',
];

// GET: Dokumentenliste eines Mitarbeiters (nur Admin). Ohne Download-URLs.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }
    const userId = parseInt(params.id, 10);
    if (isNaN(userId)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const documents = await prisma.employeeDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
    });
    return NextResponse.json({ documents });
  } catch (error: any) {
    console.error('documents GET:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

// POST: Metadaten eines hochgeladenen Dokuments speichern (nur Admin).
// Der eigentliche Upload laeuft ueber /api/upload/presigned (isPublic:false).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }
    const userId = parseInt(params.id, 10);
    if (isNaN(userId)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const user = await prisma.appUser.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const fileName = String(body?.fileName ?? '').trim();
    const filePath = String(body?.filePath ?? '').trim();
    if (!fileName || !filePath) {
      return NextResponse.json({ error: 'Dateiname und Pfad erforderlich' }, { status: 400 });
    }
    const rawCat = String(body?.category ?? 'SONSTIGES').toUpperCase();
    const category = CATEGORIES.includes(rawCat) ? rawCat : 'SONSTIGES';
    let expiryDate: Date | null = null;
    if (body?.expiryDate && typeof body.expiryDate === 'string' && body.expiryDate.trim()) {
      const d = new Date(body.expiryDate);
      if (!isNaN(d.getTime())) expiryDate = d;
    }

    const doc = await prisma.employeeDocument.create({
      data: {
        userId,
        category,
        fileName,
        filePath,
        isPublic: false,
        mimeType: String(body?.mimeType ?? ''),
        size: Number.isFinite(body?.size) ? Math.max(0, Math.floor(body.size)) : 0,
        expiryDate,
      },
    });
    await logAudit({ action: 'CREATE', entity: 'DOCUMENT', entityId: userId, summary: `Dokument "${fileName}" (${category}) hochgeladen` });
    return NextResponse.json(doc);
  } catch (error: any) {
    console.error('documents POST:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
