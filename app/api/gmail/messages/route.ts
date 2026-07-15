export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

function decodeBase64(data: string) {
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function getHeader(headers: any[], name: string) {
  const h = headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

function extractBodyText(payload: any): string {
  if (!payload) return '';
  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }
  if (payload.parts) {
    // Prefer text/plain first, then text/html
    const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) return decodeBase64(textPart.body.data);
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) return decodeBase64(htmlPart.body.data);
    // Recursively check nested parts
    for (const part of payload.parts) {
      const nested = extractBodyText(part);
      if (nested) return nested;
    }
  }
  return '';
}

async function getAuthClient() {
  const token = await prisma.gmailToken.findUnique({ where: { id: 1 } });
  if (!token?.refreshToken) return null;

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
  return oauth2Client;
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthClient();
    if (!auth) return NextResponse.json({ error: 'Nicht verbunden' }, { status: 401 });

    const url = new URL(request.url);
    const messageId = url.searchParams.get('id');
    const pageToken = url.searchParams.get('pageToken') || undefined;
    const query = url.searchParams.get('q') || '';

    const gmail = google.gmail({ version: 'v1', auth });

    // Get single message detail
    if (messageId) {
      const msg = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
      const headers = msg.data.payload?.headers || [];
      const body = extractBodyText(msg.data.payload);
      return NextResponse.json({
        id: msg.data.id,
        threadId: msg.data.threadId,
        from: getHeader(headers, 'From'),
        to: getHeader(headers, 'To'),
        subject: getHeader(headers, 'Subject'),
        date: getHeader(headers, 'Date'),
        body,
        isHtml: body.includes('<') && body.includes('>'),
        labelIds: msg.data.labelIds || [],
        snippet: msg.data.snippet || '',
      });
    }

    // List messages
    const list = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 20,
      pageToken,
      q: query || undefined,
    });

    const messages = [];
    for (const m of (list.data.messages || []).slice(0, 20)) {
      try {
        const msg = await gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
        const headers = msg.data.payload?.headers || [];
        messages.push({
          id: msg.data.id,
          threadId: msg.data.threadId,
          from: getHeader(headers, 'From'),
          subject: getHeader(headers, 'Subject'),
          date: getHeader(headers, 'Date'),
          snippet: msg.data.snippet || '',
          labelIds: msg.data.labelIds || [],
          isUnread: (msg.data.labelIds || []).includes('UNREAD'),
        });
      } catch {
        // Skip broken messages
      }
    }

    return NextResponse.json({
      messages,
      nextPageToken: list.data.nextPageToken || null,
    });
  } catch (error: any) {
    console.error('Gmail messages error:', error);
    if (error?.code === 401 || error?.response?.status === 401) {
      return NextResponse.json({ error: 'Token abgelaufen. Bitte erneut verbinden.' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
