export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCurrentUserAdmin } from '@/lib/access';
import { getFileUrl, deleteFile } from '@/lib/s3';

// GET: Frische signierte Download-URL fuer ein Dokument (nur Admin).
// Signierte URLs werden NIE gespeichert, sondern bei Bedarf erzeugt.
export async function GET(_request: Request, { params }: { params: { id: string; docId: string } }) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }
    const userId = parseInt(params.id, 10);
    const docId = parseInt(params.docId, 10);
    if (isNaN(userId) || isNaN(docId)) {
      return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
    }
    const doc = await prisma.employeeDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.userId !== userId) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    }
    const url = await getFileUrl(doc.filePath, false);
    return NextResponse.json({ url, fileName: doc.fileName });
  } catch (error: any) {
    console.error('document GET:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

// DELETE: Dokument entfernen (Storage + Datensatz, nur Admin).
export async function DELETE(_request: Request, { params }: { params: { id: string; docId: string } }) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }
    const userId = parseInt(params.id, 10);
    const docId = parseInt(params.docId, 10);
    if (isNaN(userId) || isNaN(docId)) {
      return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
    }
    const doc = await prisma.employeeDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.userId !== userId) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    }
    if (doc.filePath) {
      try { await deleteFile(doc.filePath); } catch (e: any) { console.error('deleteFile:', e?.message); }
    }
    await prisma.employeeDocument.delete({ where: { id: docId } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('document DELETE:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
