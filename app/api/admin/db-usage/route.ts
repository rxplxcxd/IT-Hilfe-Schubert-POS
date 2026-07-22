export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCurrentUserAdmin } from '@/lib/access';

/**
 * Intelligente Speicher-Uebersicht der Datenbank (nur Admins).
 * Liest die reale Groesse der Datenbank via pg_database_size und
 * schaetzt den freien Speicher gegen das Free-Limit (~500 MB bei Supabase).
 */

const LIMIT_BYTES = 500 * 1024 * 1024; // Supabase Free ~500 MB

export async function GET() {
  try {
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Nur fuer Admins' }, { status: 403 });
    }

    // Reale Groesse der aktuellen Datenbank in Bytes.
    const rows = await prisma.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`;
    const usedBytes = rows && rows[0] ? Number(rows[0].size) : 0;

    const percent = Math.min(100, Math.round((usedBytes / LIMIT_BYTES) * 1000) / 10);
    const freeBytes = Math.max(0, LIMIT_BYTES - usedBytes);

    let level: 'ok' | 'warn' | 'critical' = 'ok';
    if (percent >= 90) level = 'critical';
    else if (percent >= 75) level = 'warn';

    return NextResponse.json({
      usedBytes,
      limitBytes: LIMIT_BYTES,
      freeBytes,
      percent,
      level,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
