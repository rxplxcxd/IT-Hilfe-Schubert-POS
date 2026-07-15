export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const token = await prisma.gmailToken.findUnique({ where: { id: 1 } });
    if (!token?.refreshToken) {
      return NextResponse.json({ error: 'Nicht verbunden' }, { status: 401 });
    }

    let clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
    let clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      clientId = settings?.googleClientId || '';
      clientSecret = settings?.googleClientSecret || '';
    }
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`;
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      refresh_token: token.refreshToken,
      access_token: token.accessToken,
    });

    const { to, subject, body, inReplyTo, threadId } = await request.json();

    // Build RFC 2822 message
    const headers = [
      `To: ${to}`,
      `From: ${token.email}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
    ];
    if (inReplyTo) {
      headers.push(`In-Reply-To: ${inReplyTo}`);
      headers.push(`References: ${inReplyTo}`);
    }

    const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + body)
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
    console.error('Gmail send error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
