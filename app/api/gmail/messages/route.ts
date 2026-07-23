export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';
import { getAuthedClientForUser, companyAddress, companyInboxQuery, gmailErrorHint } from '@/lib/gmail';

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
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) return decodeBase64(htmlPart.body.data);
    const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) return decodeBase64(textPart.body.data);
    for (const part of payload.parts) {
      const nested = extractBodyText(part);
      if (nested) return nested;
    }
  }
  return '';
}

/**
 * Synchronisiert die neuesten Firmen-Mails aus dem verbundenen Gmail-Konto in
 * den eigenen Postfach-Speicher (Ordner INBOX). Best-effort: Fehler werden
 * geschluckt, damit die Ordner-Ansicht immer aus der Datenbank funktioniert.
 */
async function syncInbox(ownerId: number, compAddress: string | null) {
  try {
    const auth = await getAuthedClientForUser(ownerId);
    if (!auth) return { connected: false };
    const gmail = google.gmail({ version: 'v1', auth });
    // Auch den Spam-Ordner durchsuchen: ueber ImprovMX weitergeleitete Mails
    // landen bei Gmail haeufig im Spam (solange die Domain in DNS/Resend nicht
    // verifiziert ist). "in:anywhere" schliesst Spam ein, "-in:trash" laesst den
    // Papierkorb aussen vor.
    const base = companyInboxQuery(compAddress);
    const query = compAddress ? [base, 'in:anywhere', '-in:trash'].filter(Boolean).join(' ') : base;
    const list = await gmail.users.messages.list({ userId: 'me', maxResults: 25, q: query });
    for (const m of list.data.messages || []) {
      if (!m.id) continue;
      const exists = await prisma.emailMessage.findUnique({
        where: { ownerId_gmailId: { ownerId, gmailId: m.id } },
      }).catch(() => null);
      if (exists) continue;
      try {
        const msg = await gmail.users.messages.get({
          userId: 'me', id: m.id, format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date'],
        });
        const headers = msg.data.payload?.headers || [];
        const labelIds = msg.data.labelIds || [];
        const internal = msg.data.internalDate ? new Date(Number(msg.data.internalDate)) : new Date();
        await prisma.emailMessage.create({
          data: {
            ownerId,
            gmailId: m.id,
            threadId: msg.data.threadId || null,
            direction: 'INCOMING',
            folder: 'INBOX',
            fromAddr: getHeader(headers, 'From'),
            toAddr: getHeader(headers, 'To') || compAddress || '',
            subject: getHeader(headers, 'Subject'),
            snippet: msg.data.snippet || '',
            bodyHtml: '',
            bodyText: '',
            isHtml: true,
            isRead: !labelIds.includes('UNREAD'),
            isArchived: false,
            sentAt: internal,
          },
        });
      } catch {
        // einzelne defekte Nachricht ueberspringen
      }
    }
    return { connected: true };
  } catch (e) {
    console.error('Inbox-Sync Fehler:', (e as any)?.message || e);
    return { connected: false, syncError: gmailErrorHint(e).message };
  }
}

export async function GET(request: Request) {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const ownerId = access.id;

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const me = await prisma.appUser.findUnique({ where: { id: ownerId } });
    const domain = (settings as any)?.mailDomain || 'ithilfeschubert.xyz';
    const compAddress = companyAddress((me as any)?.emailPrefix || '', domain);

    const url = new URL(request.url);
    const messageId = url.searchParams.get('id');
    const folder = (url.searchParams.get('folder') || 'INBOX').toUpperCase();
    const userSearch = (url.searchParams.get('q') || '').trim();

    // ---- Detailansicht einer einzelnen Nachricht ----
    if (messageId) {
      const idNum = parseInt(messageId, 10);
      const row = Number.isNaN(idNum)
        ? null
        : await prisma.emailMessage.findFirst({ where: { id: idNum, ownerId } });
      if (!row) return NextResponse.json({ error: 'Nachricht nicht gefunden' }, { status: 404 });

      let bodyHtml = row.bodyHtml;
      let isHtml = row.isHtml;
      // Eingehende Mail: Text erst bei Bedarf aus Gmail nachladen und cachen.
      if (!bodyHtml && row.gmailId) {
        try {
          const auth = await getAuthedClientForUser(ownerId);
          if (auth) {
            const gmail = google.gmail({ version: 'v1', auth });
            const msg = await gmail.users.messages.get({ userId: 'me', id: row.gmailId, format: 'full' });
            const body = extractBodyText(msg.data.payload);
            isHtml = body.includes('<') && body.includes('>');
            bodyHtml = body;
            await prisma.emailMessage.update({
              where: { id: row.id },
              data: { bodyHtml: body, isHtml, isRead: true },
            });
          }
        } catch (e) {
          console.error('Body-Load Fehler:', (e as any)?.message || e);
        }
      } else if (!row.isRead) {
        await prisma.emailMessage.update({ where: { id: row.id }, data: { isRead: true } });
      }

      return NextResponse.json({
        id: String(row.id),
        threadId: row.threadId || '',
        from: row.fromAddr,
        to: row.toAddr,
        subject: row.subject,
        date: row.sentAt.toISOString(),
        body: bodyHtml,
        isHtml,
        folder: row.folder,
        direction: row.direction,
        isArchived: row.isArchived,
      });
    }

    // ---- Listenansicht nach Ordner ----
    let connected = true;
    let syncError: string | undefined;
    if (folder === 'INBOX') {
      const r = await syncInbox(ownerId, compAddress);
      connected = r.connected;
      syncError = (r as any).syncError;
    }

    const where: any = { ownerId };
    if (folder === 'ARCHIVE') {
      where.isArchived = true;
    } else if (folder === 'SENT') {
      where.folder = 'SENT';
      where.isArchived = false;
    } else {
      where.folder = 'INBOX';
      where.isArchived = false;
    }
    if (userSearch) {
      where.OR = [
        { subject: { contains: userSearch, mode: 'insensitive' } },
        { fromAddr: { contains: userSearch, mode: 'insensitive' } },
        { toAddr: { contains: userSearch, mode: 'insensitive' } },
        { snippet: { contains: userSearch, mode: 'insensitive' } },
      ];
    }

    const rows = await prisma.emailMessage.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: 60,
    });

    const messages = rows.map((r) => ({
      id: String(r.id),
      threadId: r.threadId || '',
      from: r.fromAddr,
      to: r.toAddr,
      subject: r.subject,
      date: r.sentAt.toISOString(),
      snippet: r.snippet,
      isUnread: !r.isRead,
      folder: r.folder,
      direction: r.direction,
    }));

    return NextResponse.json({
      messages,
      folder,
      companyAddress: compAddress,
      prefixSet: !!compAddress,
      connected,
      syncError,
    });
  } catch (error: any) {
    console.error('Mail messages error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Fehler beim Laden der E-Mails.' }, { status: 500 });
  }
}
