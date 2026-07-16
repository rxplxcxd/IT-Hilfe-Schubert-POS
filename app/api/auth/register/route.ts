export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { newAdminUserHtml } from '@/lib/email-templates';

/**
 * Legt nach einer Supabase-Registrierung den Freigabe-Datensatz an.
 * Der erste Nutzer wird Admin (APPROVED), alle weiteren PENDING.
 * Best-effort: Fehler werden nicht an den Client weitergegeben, damit
 * die eigentliche Registrierung nie blockiert wird.
 */
export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();
    if (!email) return NextResponse.json({ ok: false }, { status: 200 });

    const normalized = String(email).toLowerCase();
    const existing = await prisma.appUser.findUnique({ where: { email: normalized } });
    if (existing) {
      return NextResponse.json({ ok: true, status: existing.status, role: existing.role });
    }

    const count = await prisma.appUser.count();
    const isFirst = count === 0;
    const max = await prisma.appUser.aggregate({ _max: { employeeNo: true } });
    const nextNo = isFirst ? 1 : (max._max.employeeNo || 0) + 1;

    const record = await prisma.appUser.create({
      data: {
        email: normalized,
        name: name || '',
        role: isFirst ? 'ADMIN' : 'EMPLOYEE',
        status: isFirst ? 'APPROVED' : 'PENDING',
        approvedAt: isFirst ? new Date() : null,
        employeeNo: nextNo,
      },
    });

    // Admin ueber neue Anfrage informieren (nur bei PENDING)
    if (!isFirst) {
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

    return NextResponse.json({ ok: true, status: record.status, role: record.role });
  } catch (error: any) {
    console.error('auth/register:', error?.message);
    return NextResponse.json({ ok: false, error: error?.message }, { status: 200 });
  }
}
