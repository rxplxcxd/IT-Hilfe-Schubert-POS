export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';
import { companyAddress } from '@/lib/gmail';
import { outgoingEmailHtml } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';

function stripHtml(html: string): string {
  return (html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Versendet eine E-Mail ueber Resend von der FIRMEN-Adresse des Mitarbeiters
 * (z.B. leon@ithilfeschubert.xyz). Antworten laufen per Reply-To ebenfalls
 * ueber die Firmen-Adresse (ImprovMX leitet sie ans Gmail-Postfach weiter).
 *
 * Jede gesendete Mail wird zusaetzlich im eigenen Postfach-Speicher abgelegt,
 * damit sie IMMER im Ordner "Gesendet" erscheint - unabhaengig von Gmail.
 */
export async function POST(request: Request) {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const me = await prisma.appUser.findUnique({ where: { id: access.id } });
    const domain = (settings as any)?.mailDomain || 'ithilfeschubert.xyz';
    const compAddress = companyAddress((me as any)?.emailPrefix || '', domain);
    const companyName = settings?.companyName || 'IT-Hilfe Schubert';

    if (!compAddress) {
      return NextResponse.json({
        error: 'Dir ist noch keine Firmen-E-Mail-Adresse zugewiesen. Bitte lasse dir vom Administrator eine Adresse (z.B. dein-name@' + domain + ') zuweisen.',
      }, { status: 400 });
    }

    const senderDisplay = (me as any)?.name || settings?.ownerName || companyName;
    const fromHeader = senderDisplay + ' <' + compAddress + '>';

    const { to, subject, body, threadId } = await request.json();
    if (!to || !subject) {
      return NextResponse.json({ error: 'Empfänger und Betreff sind Pflichtfelder' }, { status: 400 });
    }

    // Gebrandeter Header + Signatur um den Text legen.
    const wrappedBody = outgoingEmailHtml(body || '', {
      senderName: senderDisplay,
      position: (me as any)?.position || ((me as any)?.role === 'ADMIN' ? 'Inhaber' : ''),
      phone: (me as any)?.contactPhone || settings?.phone || '',
      email: compAddress,
      companyName,
      street: (me as any)?.contactStreet || settings?.street || '',
      zip: (me as any)?.contactZip || settings?.zip || '',
      city: (me as any)?.contactCity || settings?.city || '',
      website: domain ? 'www.' + domain : '',
    });

    // Versand ueber Resend von der Firmen-Domain; Antworten ans Firmen-Postfach.
    await sendEmail({
      to,
      subject,
      html: wrappedBody,
      from: fromHeader,
      replyTo: compAddress,
    });

    // Im eigenen Postfach-Speicher als "Gesendet" ablegen.
    const stored = await prisma.emailMessage.create({
      data: {
        ownerId: access.id,
        gmailId: null,
        threadId: threadId || null,
        direction: 'OUTGOING',
        folder: 'SENT',
        fromAddr: fromHeader,
        toAddr: to,
        subject: subject || '',
        snippet: stripHtml(wrappedBody).slice(0, 160),
        bodyHtml: wrappedBody,
        bodyText: '',
        isHtml: true,
        isRead: true,
        isArchived: false,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, id: stored.id });
  } catch (error: any) {
    console.error('Mail send error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Fehler beim Senden der E-Mail.' }, { status: 500 });
  }
}
