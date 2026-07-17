export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withRetry } from '@/lib/access';
import { sendEmail } from '@/lib/email';
import { newAdminUserHtml } from '@/lib/email-templates';

/**
 * Legt nach einer Supabase-Registrierung den Freigabe-Datensatz an.
 * Der erste Nutzer wird Admin (APPROVED), alle weiteren PENDING.
 *
 * Wichtig: Die DB (Supabase) hat sehr kurze Timeouts, ein Kaltstart kann den
 * ersten Query scheitern lassen. Deshalb wird das Anlegen per withRetry
 * mehrfach versucht. Schlaegt es endgueltig fehl, meldet die Route ok:false
 * mit created:false zurueck, damit der Client das erkennen und den Nutzer
 * bitten kann, sich einmal anzumelden (die Login-Route ist selbstheilend).
 */
export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();
    if (!email) return NextResponse.json({ ok: false, created: false }, { status: 200 });

    const normalized = String(email).toLowerCase();

    const { record, isFirst } = await withRetry(async () => {
      const existing = await prisma.appUser.findUnique({ where: { email: normalized } });
      if (existing) return { record: existing, isFirst: false };

      const count = await prisma.appUser.count();
      const first = count === 0;
      const max = await prisma.appUser.aggregate({ _max: { employeeNo: true } });
      const nextNo = first ? 1 : (max._max.employeeNo || 0) + 1;

      const created = await prisma.appUser.create({
        data: {
          email: normalized,
          name: name || '',
          role: first ? 'ADMIN' : 'EMPLOYEE',
          status: first ? 'APPROVED' : 'PENDING',
          approvedAt: first ? new Date() : null,
          employeeNo: nextNo,
        },
      });
      return { record: created, isFirst: first };
    });

    // Admin ueber neue Anfrage informieren (nur bei PENDING)
    if (!isFirst && record.status === 'PENDING') {
      try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (settings?.email) {
          await sendEmail({
            to: settings.email,
            subject: `Neue Registrierungsanfrage: ${normalized}`,
            html: newAdminUserHtml({ name: name || '(kein Name)', email: normalized }),
          }).catch((e) => console.error('Admin-Benachrichtigung fehlgeschlagen:', e?.message));
        }
      } catch (e: any) {
        console.error('register notify:', e?.message);
      }
    }

    return NextResponse.json({ ok: true, created: true, status: record.status, role: record.role });
  } catch (error: any) {
    console.error('auth/register:', error?.message);
    // created:false signalisiert dem Client, dass der Warte-Datensatz noch fehlt.
    return NextResponse.json({ ok: false, created: false, error: error?.message }, { status: 200 });
  }
}
