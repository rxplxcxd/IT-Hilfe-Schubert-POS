export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { ticketDeadlineReminderHtml } from '@/lib/email-templates';

/**
 * Cron-Route fuer Frist-Erinnerungen.
 * Aufruf z.B. stuendlich durch Vercel Cron oder einen externen Cron-Dienst.
 * Absicherung ueber CRON_SECRET (als ?secret=... oder Authorization: Bearer ...).
 *
 * reminderStage: 0=keine, 1=3T gesendet, 2=1T gesendet, 3=1h gesendet, 4=ueberfaellig gesendet
 */

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Wenn kein Secret gesetzt ist, erlauben (z.B. lokale Tests) - in Produktion immer setzen.
  if (!secret) return true;
  const url = new URL(req.url);
  const q = url.searchParams.get('secret');
  if (q && q === secret) return true;
  const auth = req.headers.get('authorization') || '';
  if (auth === `Bearer ${secret}`) return true;
  return false;
}

async function run() {
  const now = Date.now();
  const H = 60 * 60 * 1000;
  const D = 24 * H;

  // Alle offenen Tickets mit gesetzter Frist.
  const tickets = await prisma.ticket.findMany({
    where: {
      dueDate: { not: null },
      status: { not: 'ERLEDIGT' },
    },
  });

  if (tickets.length === 0) {
    return { checked: 0, sent: 0, details: [] as any[] };
  }

  // Admins (fuer CC-artige Info) einmal laden.
  const admins = await prisma.appUser.findMany({
    where: { role: 'ADMIN', status: 'APPROVED' },
    select: { email: true, name: true },
  });
  const adminEmails = admins.map((a) => a.email).filter(Boolean);

  let sent = 0;
  const details: any[] = [];

  for (const t of tickets) {
    if (!t.dueDate) continue;
    const dueMs = new Date(t.dueDate).getTime();
    const diff = dueMs - now; // >0 = Zukunft, <0 = ueberfaellig

    // Ziel-Stufe anhand der verbleibenden Zeit bestimmen.
    let targetStage = 0;
    if (diff <= 0) targetStage = 4;
    else if (diff <= 1 * H) targetStage = 3;
    else if (diff <= 1 * D) targetStage = 2;
    else if (diff <= 3 * D) targetStage = 1;

    // Nur senden, wenn eine hoehere Stufe erreicht wurde als bereits versendet.
    if (targetStage === 0 || targetStage <= t.reminderStage) continue;

    const stageKey = targetStage === 4 ? 'overdue' : targetStage === 3 ? 'hour1' : targetStage === 2 ? 'soon1' : 'soon3';

    // Empfaenger: Ersteller des Tickets + alle Admins.
    const recipients = new Set<string>();
    if (t.createdById) {
      const creator = await prisma.appUser.findUnique({ where: { id: t.createdById }, select: { email: true } });
      if (creator?.email) recipients.add(creator.email);
    }
    for (const e of adminEmails) recipients.add(e);

    const to = Array.from(recipients);
    if (to.length === 0) continue;

    const html = ticketDeadlineReminderHtml({
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      employeeName: t.createdByName || undefined,
      dueDate: t.dueDate,
      stage: stageKey as any,
    });
    const subject = `Frist-Erinnerung: Ticket ${t.ticketNumber} (${t.subject})`;

    try {
      // Pro Empfaenger eine eigene Mail (sendEmail nimmt einen Empfaenger).
      for (const addr of to) {
        await sendEmail({ to: addr, subject, html });
      }
      await prisma.ticket.update({ where: { id: t.id }, data: { reminderStage: targetStage } });
      sent++;
      details.push({ ticket: t.ticketNumber, stage: stageKey, to });
    } catch (err: any) {
      details.push({ ticket: t.ticketNumber, stage: stageKey, error: String(err?.message || err) });
    }
  }

  return { checked: tickets.length, sent, details };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }
  try {
    const result = await run();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
