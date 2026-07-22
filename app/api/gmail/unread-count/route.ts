export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';
import { getAuthedClientForUser, companyAddress, companyInboxQuery } from '@/lib/gmail';
import { google } from 'googleapis';

/**
 * Leichtgewichtige, best-effort Anzahl ungelesener Firmen-Mails fuer das
 * Start-Widget. Faellt bei fehlender Verbindung/Fehler still auf 0 zurueck,
 * damit das Dashboard nie blockiert.
 */
export async function GET() {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') return NextResponse.json({ count: 0, connected: false });

    const auth = await getAuthedClientForUser(access.id);
    if (!auth) return NextResponse.json({ count: 0, connected: false });

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const me = await prisma.appUser.findUnique({ where: { id: access.id } });
    const domain = (settings as any)?.mailDomain || 'ithilfeschubert.xyz';
    const compAddress = companyAddress((me as any)?.emailPrefix || '', domain);
    const q = [companyInboxQuery(compAddress), 'is:unread', 'in:inbox'].filter(Boolean).join(' ');

    const gmail = google.gmail({ version: 'v1', auth });
    const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 1 });
    const count = list.data.resultSizeEstimate ?? 0;
    return NextResponse.json({ count, connected: true });
  } catch (e) {
    console.error('[gmail/unread-count] Fehler:', e);
    return NextResponse.json({ count: 0, connected: false });
  }
}
