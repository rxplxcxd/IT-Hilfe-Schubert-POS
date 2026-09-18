export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';
import { logAudit } from '@/lib/audit';
import { APP_VERSION } from '@/lib/version';

/**
 * Voll-Backup (Batch 4, Punkt 52/53).
 *
 * Exportiert alle wichtigen Tabellen als eine JSON-Datei zum Download.
 * Nur fuer freigegebene Administratoren.
 *
 * Hinweis Datenschutz: Sensible Personalfelder (IBAN, SV-Nummer, Steuer-ID,
 * Geraete-Passwoerter) liegen in der Datenbank verschluesselt (Marker enc::)
 * und werden hier UNVERAENDERT, also weiterhin verschluesselt, exportiert.
 */
export async function GET() {
  const access = await getAccessForCurrentUser();
  if (!access || access.role !== 'ADMIN' || access.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
  }

  try {
    const [
      customers,
      products,
      invoices,
      quotes,
      orders,
      expenses,
      subscriptions,
      workLogs,
      reminders,
      deviceInventory,
      settings,
      appUsers,
      employeeDocuments,
      auditLog,
      tickets,
      appointments,
      timeSlots,
      emailMessages,
      weeklyTasks,
    ] = await Promise.all([
      prisma.customer.findMany(),
      prisma.product.findMany(),
      prisma.invoice.findMany({ include: { items: true } }),
      prisma.quote.findMany({ include: { items: true } }),
      prisma.order.findMany({ include: { photos: true } }),
      prisma.expense.findMany(),
      prisma.subscription.findMany(),
      prisma.workLog.findMany({ include: { photos: true } }),
      prisma.reminder.findMany(),
      prisma.deviceInventory.findMany(),
      prisma.settings.findMany(),
      prisma.appUser.findMany(),
      prisma.employeeDocument.findMany(),
      prisma.auditLog.findMany(),
      prisma.ticket.findMany({ include: { attachments: true, messages: true } }),
      prisma.appointment.findMany(),
      prisma.timeSlot.findMany(),
      prisma.emailMessage.findMany(),
      prisma.weeklyTask.findMany(),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      version: APP_VERSION,
      note: 'Sensible Felder (IBAN, SV-Nr, Steuer-ID, Geraete-Passwoerter) sind verschluesselt (enc::) exportiert.',
      tables: {
        customers,
        products,
        invoices,
        quotes,
        orders,
        expenses,
        subscriptions,
        workLogs,
        reminders,
        deviceInventory,
        settings,
        appUsers,
        employeeDocuments,
        auditLog,
        tickets,
        appointments,
        timeSlots,
        emailMessages,
        weeklyTasks,
      },
    };

    await logAudit({ action: 'EXPORT', entity: 'BACKUP', summary: 'Voll-Backup exportiert' });

    const now = new Date();
    const stamp = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="backup-' + stamp + '.json"',
      },
    });
  } catch (error: any) {
    console.error('backup error:', error?.message);
    return NextResponse.json({ error: 'Backup fehlgeschlagen.' }, { status: 500 });
  }
}
