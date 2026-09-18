export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';
import { logAudit } from '@/lib/audit';

/**
 * Werksreset / Belege loeschen (Batch 4, Punkt 54).
 *
 * Loescht ALLE Geschaeftsbelege (Rechnungen, Auftraege, Angebote, Ausgaben,
 * Arbeitsberichte, Erinnerungen, Abos) und setzt die Nummernkreise zurueck.
 *
 * BEHAELT bewusst: Kunden, Produkte, Einstellungen, Nutzer, Geraete,
 * Termine/Zeitfenster, Gmail-Verbindung, E-Mails, Audit-Log, Wochenaufgaben
 * und – ganz wichtig – ALLE TICKETS (Ticket/TicketAttachment/TicketMessage).
 *
 * Sicherheit: Nur freigegebener Admin, und der Text "LOESCHEN" muss zur
 * Bestaetigung mitgeschickt werden.
 */
export async function POST(request: Request) {
  const access = await getAccessForCurrentUser();
  if (!access || access.role !== 'ADMIN' || access.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const confirm = String(body?.confirm ?? '').trim().toUpperCase();
  if (confirm !== 'LÖSCHEN' && confirm !== 'LOESCHEN') {
    return NextResponse.json(
      { error: 'Bitte zur Bestätigung das Wort LÖSCHEN eingeben.' },
      { status: 400 },
    );
  }

  try {
    const counts = {
      orderPhotos: await prisma.orderPhoto.count(),
      orders: await prisma.order.count(),
      invoiceItems: await prisma.invoiceItem.count(),
      invoices: await prisma.invoice.count(),
      quoteItems: await prisma.quoteItem.count(),
      quotes: await prisma.quote.count(),
      workLogPhotos: await prisma.workLogPhoto.count(),
      workLogs: await prisma.workLog.count(),
      expenses: await prisma.expense.count(),
      reminders: await prisma.reminder.count(),
      subscriptions: await prisma.subscription.count(),
    };

    // Reihenfolge: Kinder zuerst (wie im geprueften reset-testdata-Skript).
    await prisma.orderPhoto.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.invoiceItem.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.quoteItem.deleteMany({});
    await prisma.quote.deleteMany({});
    await prisma.workLogPhoto.deleteMany({});
    await prisma.workLog.deleteMany({});
    await prisma.expense.deleteMany({});
    await prisma.reminder.deleteMany({});
    await prisma.subscription.deleteMany({});

    await prisma.settings.upsert({
      where: { id: 1 },
      update: { nextCaseNumber: 1, nextStornoNumber: 1 },
      create: { id: 1, nextCaseNumber: 1, nextStornoNumber: 1 },
    });

    const totalDeleted = Object.values(counts).reduce((a, b) => a + b, 0);

    await logAudit({
      action: 'FACTORY_RESET',
      entity: 'SYSTEM',
      summary: 'Belege gelöscht (' + totalDeleted + ' Datensätze). Kunden, Produkte, Tickets, Nutzer & Einstellungen behalten.',
      details: counts,
    });

    return NextResponse.json({ ok: true, deleted: counts, totalDeleted });
  } catch (error: any) {
    console.error('factory-reset error:', error?.message);
    return NextResponse.json({ error: 'Reset fehlgeschlagen.' }, { status: 500 });
  }
}
