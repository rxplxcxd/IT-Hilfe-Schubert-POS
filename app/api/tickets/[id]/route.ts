export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';

// GET: Detail eines Tickets inkl. Anhaenge und Nachrichten.
// Nebeneffekt: markiert das Ticket fuer den lesenden Nutzer als gelesen.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Nicht freigegeben' }, { status: 403 });
    }
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Ungueltige ID' }, { status: 400 });

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        attachments: { orderBy: { createdAt: 'asc' } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!ticket) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    const isAdmin = access.role === 'ADMIN';
    if (!isAdmin && ticket.createdById !== access.id) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }

    // Als gelesen markieren.
    if (isAdmin && ticket.adminUnread) {
      await prisma.ticket.update({ where: { id }, data: { adminUnread: false } });
      ticket.adminUnread = false;
    } else if (!isAdmin && ticket.employeeUnread) {
      await prisma.ticket.update({ where: { id }, data: { employeeUnread: false } });
      ticket.employeeUnread = false;
    }

    return NextResponse.json(ticket);
  } catch (error: any) {
    console.error('Ticket GET error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

// PATCH: Nur Admin darf Status aendern.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED' || access.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Ungueltige ID' }, { status: 400 });

    const data = await request.json();
    const status = data?.status;
    if (!['OFFEN', 'IN_BEARBEITUNG', 'ERLEDIGT'].includes(status)) {
      return NextResponse.json({ error: 'Ungueltiger Status' }, { status: 400 });
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        status,
        closedAt: status === 'ERLEDIGT' ? new Date() : null,
        // Statuswechsel durch Admin -> Mitarbeiter soll das sehen.
        employeeUnread: true,
      },
    });
    return NextResponse.json(ticket);
  } catch (error: any) {
    console.error('Ticket PATCH error:', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 });
  }
}
