export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';
import { getAuthedClientForUser, getUserToken, companyAddress, gmailErrorHint } from '@/lib/gmail';
import { outgoingEmailHtml } from '@/lib/email-templates';

function encodeHeader(value: string) {
  // RFC 2047 Encoding fuer Nicht-ASCII-Zeichen im Header (z.B. Umlaute).
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return '=?UTF-8?B?' + Buffer.from(value, 'utf-8').toString('base64') + '?=';
}

export async function POST(request: Request) {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }

    const oauth2Client = await getAuthedClientForUser(access.id);
    if (!oauth2Client) {
      return NextResponse.json({ error: 'Nicht verbunden' }, { status: 401 });
    }

    const token = await getUserToken(access.id);

    // Absender = Firmen-Adresse (setzt den in Gmail eingerichteten "Senden als"
    // Alias voraus). Ohne Prefix wird das verbundene Gmail-Konto genutzt.
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const me = await prisma.appUser.findUnique({ where: { id: access.id } });
    const domain = (settings as any)?.mailDomain || 'ithilfeschubert.xyz';
    const compAddress = companyAddress((me as any)?.emailPrefix || '', domain);
    const companyName = settings?.companyName || 'IT-Hilfe Schubert';
    const fromAddress = compAddress || token?.email || '';
    // Anzeigename = voller Name des Mitarbeiters (Leon moechte den Namen behalten,
    // nur die Gmail-Adresse soll durch die Firmen-Adresse ersetzt werden).
    const senderDisplay = (me as any)?.name || settings?.ownerName || companyName;
    const fromHeader = compAddress
      ? `${encodeHeader(senderDisplay)} <${fromAddress}>`
      : fromAddress;

    const { to, subject, body, inReplyTo, threadId } = await request.json();

    // Gebrandeter Header + Footer (Signatur aus Kontaktdaten) um den Text legen.
    const wrappedBody = outgoingEmailHtml(body || '', {
      senderName: senderDisplay,
      position: (me as any)?.position || ((me as any)?.role === 'ADMIN' ? 'Inhaber' : ''),
      phone: (me as any)?.contactPhone || settings?.phone || '',
      email: fromAddress,
      companyName,
      street: (me as any)?.contactStreet || settings?.street || '',
      zip: (me as any)?.contactZip || settings?.zip || '',
      city: (me as any)?.contactCity || settings?.city || '',
      website: domain ? 'www.' + domain : '',
    });

    const headers = [
      `To: ${to}`,
      `From: ${fromHeader}`,
      `Subject: ${encodeHeader(subject || '')}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
    ];
    if (inReplyTo) {
      headers.push(`In-Reply-To: ${inReplyTo}`);
      headers.push(`References: ${inReplyTo}`);
    }

    const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + wrappedBody)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, threadId: threadId || undefined },
    });

    return NextResponse.json({ success: true, messageId: result.data.id });
  } catch (error: any) {
    console.error('Gmail send error:', error?.response?.data || error?.message || error);
    const hint = gmailErrorHint(error);
    return NextResponse.json({ error: hint.message }, { status: hint.status });
  }
}
