export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';
import { getAuthedClientForUser, companyAddress, companyInboxQuery } from '@/lib/gmail';

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
    const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) return decodeBase64(textPart.body.data);
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) return decodeBase64(htmlPart.body.data);
    for (const part of payload.parts) {
      const nested = extractBodyText(part);
      if (nested) return nested;
    }
  }
  return '';
}

export async function GET(request: Request) {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }

    const auth = await getAuthedClientForUser(access.id);
    if (!auth) return NextResponse.json({ error: 'Nicht verbunden' }, { status: 401 });

    // Firmen-Adresse dieses Mitarbeiters als Filter.
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const me = await prisma.appUser.findUnique({ where: { id: access.id } });
    const domain = (settings as any)?.mailDomain || 'ithilfeschubert.xyz';
    const compAddress = companyAddress((me as any)?.emailPrefix || '', domain);

    const url = new URL(request.url);
    const messageId = url.searchParams.get('id');
    const pageToken = url.searchParams.get('pageToken') || undefined;
    const userSearch = url.searchParams.get('q') || '';

    const gmail = google.gmail({ version: 'v1', auth });

    // Einzelne Nachricht (Detail) - kein Filter noetig.
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

    // Nur die Firmen-Mails dieses Mitarbeiters auflisten.
    const query = companyInboxQuery(compAddress, userSearch);

    const list = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 20,
      pageToken,
      q: query,
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
        // defekte Nachricht ueberspringen
      }
    }

    return NextResponse.json({
      messages,
      nextPageToken: list.data.nextPageToken || null,
      companyAddress: compAddress,
      prefixSet: !!compAddress,
    });
  } catch (error: any) {
    console.error('Gmail messages error:', error);
    if (error?.code === 401 || error?.response?.status === 401) {
      return NextResponse.json({ error: 'Token abgelaufen. Bitte erneut verbinden.' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
