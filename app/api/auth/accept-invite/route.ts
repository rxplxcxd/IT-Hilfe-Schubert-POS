export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { sendEmail } from '@/lib/email';
import { welcomeEmployeeHtml } from '@/lib/email-templates';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST: Eingeladener Mitarbeiter akzeptiert die Einladung (Punkt 10).
 *
 * WICHTIG: Der Supabase-Auth-Account wird hier SERVERSEITIG ueber den
 * Admin-Client mit `email_confirm: true` angelegt. Dadurch ist keine
 * separate E-Mail-Bestaetigung noetig und der Mitarbeiter kann sich
 * SOFORT einloggen. (Client-signUp scheiterte still an der
 * Supabase-Mailbestaetigung -> Login schlug danach fehl.)
 *
 * Ablauf:
 * - Token pruefen (existiert + nicht abgelaufen)
 * - Supabase-Auth-User anlegen (oder Passwort setzen, falls schon vorhanden)
 * - AppUser: INVITED -> APPROVED, Token loeschen
 * - Willkommens-E-Mail (Punkt 14)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body?.token ?? '').trim();
    const password = String(body?.password ?? '');

    if (!token) {
      return NextResponse.json({ error: 'Kein Token angegeben.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Das Passwort muss mindestens 6 Zeichen haben.' }, { status: 400 });
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

    const email = user.email.trim();

    // 1. Supabase-Auth-Account anlegen (sofort bestaetigt).
    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      // Moeglicherweise existiert der Auth-User schon (z. B. aus einem
      // frueheren Versuch). Dann suchen wir ihn und setzen Passwort +
      // Bestaetigung neu.
      const existing = await findAuthUserByEmail(email);
      if (existing) {
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
        });
        if (updErr) {
          console.error('accept-invite update auth:', updErr.message);
          return NextResponse.json({ error: 'Konto konnte nicht aktiviert werden. Bitte erneut versuchen.' }, { status: 500 });
        }
      } else {
        console.error('accept-invite create auth:', createErr.message);
        return NextResponse.json({ error: 'Konto konnte nicht erstellt werden. Bitte erneut versuchen.' }, { status: 500 });
      }
    }

    // 2. AppUser freischalten
    const updated = await prisma.appUser.update({
      where: { id: user.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    // 3. Willkommens-E-Mail (Punkt 14)
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

/** Sucht einen Supabase-Auth-User anhand der E-Mail (paginiert). */
async function findAuthUserByEmail(email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    const found = data?.users?.find((u) => (u.email || '').toLowerCase() === target);
    if (found) return found;
    if (!data || data.users.length < 1000) break;
  }
  return null;
}
