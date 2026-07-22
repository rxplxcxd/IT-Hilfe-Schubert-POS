export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCurrentUserAdmin } from '@/lib/access';
import { sendEmail } from '@/lib/email';
import { inviteEmployeeHtml } from '@/lib/email-templates';
import { logAudit } from '@/lib/audit';
import crypto from 'crypto';

/**
 * GET: Token validieren (fuer die Einladungs-Annahme-Seite).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || '';
    if (!token) return NextResponse.json({ error: 'Kein Token.' }, { status: 400 });

    const user = await prisma.appUser.findFirst({ where: { inviteToken: token } });
    if (!user) return NextResponse.json({ error: 'Einladung nicht gefunden oder bereits verwendet.' }, { status: 404 });
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      return NextResponse.json({ error: 'Die Einladung ist abgelaufen.' }, { status: 410 });
    }

    return NextResponse.json({ email: user.email, name: user.name });
  } catch (error: any) {
    console.error('invite GET:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

/**
 * POST: Admin laedt neuen Mitarbeiter ein (Punkt 10).
 *
 * Erstellt AppUser mit status=INVITED + Einladungs-Token.
 * Generiert automatisch emailPrefix aus Vorname (Punkt 13).
 * Sendet Einladungs-E-Mail mit Link.
 */
export async function POST(request: Request) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim();
    const email = String(body?.email ?? '').trim().toLowerCase();

    if (!name || !email) {
      return NextResponse.json({ error: 'Name und E-Mail sind Pflicht.' }, { status: 400 });
    }

    // Pruefen ob E-Mail schon vergeben
    const existing = await prisma.appUser.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 409 });
    }

    // Naechste Mitarbeiternummer
    const max = await prisma.appUser.aggregate({ _max: { employeeNo: true } });
    const nextNo = (max._max.employeeNo || 0) + 1;

    // Einladungs-Token (URL-safe, 48 Zeichen)
    const token = crypto.randomBytes(36).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 Tage

    // Auto-Prefix aus Vorname (Punkt 13)
    const firstName = name.split(/\s+/)[0] || '';
    const autoPrefix = firstName
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '')
      .slice(0, 30);

    const user = await prisma.appUser.create({
      data: {
        email,
        name,
        role: 'EMPLOYEE',
        status: 'INVITED',
        employeeNo: nextNo,
        inviteToken: token,
        inviteExpiresAt: expiresAt,
        emailPrefix: autoPrefix,
      },
    });

    // Einladungs-Mail senden
    const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '';
    const inviteUrl = appUrl + '/invite/' + token;

    try {
      await sendEmail({
        to: email,
        subject: 'Einladung: IT-Hilfe Schubert',
        html: inviteEmployeeHtml({ name, inviteUrl }),
      });
    } catch (e: any) {
      console.error('invite email send:', e?.message);
      // Einladung wurde trotzdem angelegt — Admin kann Link manuell teilen
    }

    await logAudit({
      action: 'INVITE',
      entity: 'USER',
      entityId: user.id,
      summary: `${name} (${email}) eingeladen`,
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, employeeNo: user.employeeNo, emailPrefix: user.emailPrefix },
      inviteUrl,
    });
  } catch (error: any) {
    console.error('users/invite POST:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
