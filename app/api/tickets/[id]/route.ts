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
        customer: { select: { id: true, firstName: true, lastName: true } },
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

// PATCH: Admin darf Status + Frist aendern, der Ersteller darf die Frist seines eigenen Tickets setzen.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Ungueltige ID' }, { status: 400 });

    const isAdmin = access.role === 'ADMIN';
    const existing = await prisma.ticket.findUnique({ where: { id }, select: { createdById: true } });
    if (!existing) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    const isOwner = existing.createdById === access.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }

    const data = await request.json();
    const patch: any = {};

    // Statuswechsel (nur Admin)
    if (data?.status !== undefined) {
      if (!isAdmin) return NextResponse.json({ error: 'Nur Admin darf den Status aendern' }, { status: 403 });
      if (!['OFFEN', 'IN_BEARBEITUNG', 'ERLEDIGT'].includes(data.status)) {
        return NextResponse.json({ error: 'Ungueltiger Status' }, { status: 400 });
      }
      patch.status = data.status;
      patch.closedAt = data.status === 'ERLEDIGT' ? new Date() : null;
      // Statuswechsel durch Admin -> Mitarbeiter soll das sehen.
      patch.employeeUnread = true;
    }

    // Frist setzen / entfernen (null loescht die Frist). Bei Aenderung Erinnerungen zuruecksetzen.
    if (data?.dueDate !== undefined) {
      if (data.dueDate === null || data.dueDate === '') {
        patch.dueDate = null;
        patch.reminderStage = 0;
      } else {
        const d = new Date(data.dueDate);
        if (isNaN(d.getTime())) {
          return NextResponse.json({ error: 'Ungueltige Frist' }, { status: 400 });
        }
        patch.dueDate = d;
        patch.reminderStage = 0;
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Keine Aenderung' }, { status: 400 });
    }

    const ticket = await prisma.ticket.update({ where: { id }, data: patch });
    return NextResponse.json(ticket);
  } catch (error: any) {
    console.error('Ticket PATCH error:', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 });
  }
}
