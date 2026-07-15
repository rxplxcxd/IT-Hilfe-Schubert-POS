export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { newAdminUserHtml } from '@/lib/email-templates';

// POST: Benachrichtigt den Inhaber ueber einen neu registrierten Benutzer.
// Fehler blockieren die Registrierung nie (Aufruf ist best-effort).
export async function POST(request: Request) {
  try {
    const { name, email } = await request.json();
    if (!email) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const adminEmail = settings?.email;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `Neuer Benutzer registriert: ${email}`,
        html: newAdminUserHtml({ name: name || '(kein Name)', email }),
      }).catch((e) => console.error('New-user-E-Mail fehlgeschlagen:', e?.message));
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('notify/new-user:', error?.message);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
