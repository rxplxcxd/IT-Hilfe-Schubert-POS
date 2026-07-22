export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';

/**
 * GET /api/activities
 * Liefert die letzten relevanten Aktivitaeten fuer das Dashboard.
 */
export async function GET() {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json([]);
    }
    const isAdmin = access.role === 'ADMIN';
    const items: any[] = [];

    // 1) Offene Terminanfragen (admin only)
    if (isAdmin) {
      const appts = await prisma.appointment.findMany({
        where: { status: 'OFFEN' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      for (const a of appts) {
        items.push({
          type: 'appointment',
          id: `appt-${a.id}`,
          title: `Terminanfrage: ${a.customerName}`,
          subtitle: `${new Date(a.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })} ${a.startTime}-${a.endTime} Uhr`,
          time: a.createdAt,
          status: a.status,
        });
      }
    }

    // 2) Neue Registrierungsanfragen (admin only)
    if (isAdmin) {
      const pending = await prisma.appUser.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      for (const u of pending) {
        items.push({
          type: 'registration',
          id: `reg-${u.id}`,
          title: `Neue MA-Anfrage: ${u.name || u.email}`,
          subtitle: u.email,
          time: u.createdAt,
          status: 'PENDING',
        });
      }
    }

    // 3) Tickets (admin=alle, employee=eigene) - letzte 8
    const ticketWhere: any = isAdmin ? {} : { createdById: access.id };
    const tickets = await prisma.ticket.findMany({
      where: ticketWhere,
      orderBy: { updatedAt: 'desc' },
      take: 8,
      include: { _count: { select: { messages: true } } },
    });
    for (const t of tickets) {
      const unread = isAdmin ? t.adminUnread : t.employeeUnread;
      items.push({
        type: 'ticket',
        id: `ticket-${t.id}`,
        entityId: t.id,
        title: `${t.ticketNumber}: ${t.subject}`,
        subtitle: `${t.status}${t._count.messages > 0 ? ` · ${t._count.messages} Nachricht${t._count.messages === 1 ? '' : 'en'}` : ''}`,
        time: t.updatedAt,
        status: t.status,
        unread,
      });
    }

    // 4) Letzte Rechnungen (top 5)
    const invoiceWhere: any = isAdmin ? {} : { customer: { ownerId: access.id } };
    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { customer: { select: { firstName: true, lastName: true } } },
    });
    for (const inv of invoices) {
      items.push({
        type: 'invoice',
        id: `inv-${inv.id}`,
        entityId: inv.id,
        title: `Rechnung ${inv.invoiceNumber}`,
        subtitle: `${inv.customer?.firstName ?? ''} ${inv.customer?.lastName ?? ''} · ${inv.total.toFixed(2).replace('.', ',')} € · ${inv.status}`,
        time: inv.createdAt,
        status: inv.status,
      });
    }

    // Sort by time desc, take top 15
    items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return NextResponse.json(items.slice(0, 15));
  } catch (error: any) {
    console.error('activities:', error?.message);
    return NextResponse.json([]);
  }
}
