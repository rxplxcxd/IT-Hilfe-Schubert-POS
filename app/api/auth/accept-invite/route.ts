export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { welcomeEmployeeHtml } from '@/lib/email-templates';

/**
 * POST: Eingeladener Mitarbeiter akzeptiert die Einladung (Punkt 10).
 *
 * Das Frontend erstellt den Supabase-Auth-Account (signUp) und ruft
 * danach diesen Endpoint auf, um den AppUser freizuschalten:
 * - status: INVITED -> APPROVED
 * - inviteToken + inviteExpiresAt werden geloescht
 * - Willkommens-E-Mail wird gesendet (Punkt 14)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body?.token ?? '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Kein Token angegeben.' }, { status: 400 });
    }

    const user = await prisma.appUser.findFirst({
      where: { inviteToken: token },
    });

    if (!user) {
      return NextResponse.json({ error: 'Einladung nicht gefunden oder bereits verwendet.' }, { status: 404 });
    }

    // Abgelaufen?
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      return NextResponse.json({ error: 'Die Einladung ist abgelaufen. Bitte den Administrator um eine neue.' }, { status: 410 });
    }

    // Freischalten
    const updated = await prisma.appUser.update({
      where: { id: user.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    // Willkommens-E-Mail (Punkt 14)
    try {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      const mailDomain = settings?.mailDomain || 'ithilfeschubert.xyz';
      const firmEmail = updated.emailPrefix ? `${updated.emailPrefix}@${mailDomain}` : '';

      await sendEmail({
        to: updated.email,
        subject: 'Willkommen bei IT-Hilfe Schubert!',
        html: welcomeEmployeeHtml({
          name: updated.name,
          employeeNo: updated.employeeNo,
          firmEmail,
        }),
      });
    } catch (e: any) {
      console.error('welcome email:', e?.message);
    }

    await logAudit({
      action: 'ACCEPT_INVITE',
      entity: 'USER',
      entityId: user.id,
      summary: `${updated.name || updated.email} hat Einladung angenommen`,
    });

    return NextResponse.json({ ok: true, email: updated.email });
  } catch (error: any) {
    console.error('accept-invite:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
