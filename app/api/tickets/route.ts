export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';
import { getNextTicketNumber } from '@/lib/case-number';
import { sendEmail } from '@/lib/email';
import { newTicketAdminHtml } from '@/lib/email-templates';

// GET: Admin sieht alle Tickets, Mitarbeiter nur eigene.
export async function GET() {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json([], { status: 403 });
    }
    const isAdmin = access.role === 'ADMIN';
    const tickets = await prisma.ticket.findMany({
      where: isAdmin ? {} : { createdById: access.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        attachments: true,
        _count: { select: { messages: true } },
      },
    });
    return NextResponse.json(tickets ?? []);
  } catch (error: any) {
    console.error('Tickets GET error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

// POST: Mitarbeiter oder Admin erstellt ein Ticket (mit optionalen Anhaengen).
export async function POST(request: Request) {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Nicht freigegeben' }, { status: 403 });
    }
    const data = await request.json();
    const subject = (data?.subject ?? '').trim();
    if (!subject) {
      return NextResponse.json({ error: 'Betreff fehlt' }, { status: 400 });
    }
    const priority = ['NIEDRIG', 'NORMAL', 'HOCH'].includes(data?.priority) ? data.priority : 'NORMAL';
    const ALLOWED_CATEGORIES = ['HARDWARE', 'SOFTWARE', 'NETZWERK', 'ABRECHNUNG', 'KUNDE', 'TERMIN', 'ZUGANG', 'APP', 'MATERIAL', 'SONSTIGES'];
    const category = ALLOWED_CATEGORIES.includes(data?.category) ? data.category : 'SONSTIGES';
    const description = (data?.description ?? '').trim();
    const attachments = Array.isArray(data?.attachments) ? data.attachments : [];
    // Optionale Frist (Deadline). Wird als ISO-String erwartet.
    let dueDate: Date | null = null;
    if (data?.dueDate) {
      const d = new Date(data.dueDate);
      if (!isNaN(d.getTime())) dueDate = d;
    }

    const ticketNumber = await getNextTicketNumber();
    const isAdmin = access.role === 'ADMIN';

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        subject,
        description,
        priority,
        category,
        status: 'OFFEN',
        dueDate,
        createdById: access.id,
        createdByName: access.name || access.email,
        createdByNo: access.employeeNo,
        // Vom Mitarbeiter erstellt -> Admin hat ungelesen. Vom Admin -> keiner.
        adminUnread: !isAdmin,
        employeeUnread: false,
        attachments: {
          create: attachments
            .filter((a: any) => a && a.url)
            .map((a: any) => ({
              url: String(a.url),
              filePath: String(a.filePath ?? ''),
              kind: a.kind === 'video' ? 'video' : 'image',
              caption: String(a.caption ?? ''),
            })),
        },
      },
      include: { attachments: true },
    });

    // Benachrichtigung an den Admin (nur wenn vom Mitarbeiter erstellt).
    if (!isAdmin) {
      try {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        const adminEmail = settings?.email;
        if (adminEmail) {
          await sendEmail({
            to: adminEmail,
            subject: `Neues Support-Ticket ${ticketNumber}: ${subject}`,
            html: newTicketAdminHtml({
              ticketNumber,
              subject,
              employeeName: access.name || access.email,
              priority,
              description,
            }),
            replyTo: access.email || undefined,
          });
        }
      } catch (mailErr: any) {
        console.error('Ticket-Admin-E-Mail fehlgeschlagen:', mailErr?.message);
      }
    }

    return NextResponse.json(ticket, { status: 201 });
  } catch (error: any) {
    console.error('Ticket create error:', error);
    return NextResponse.json({ error: 'Fehler beim Anlegen' }, { status: 500 });
  }
}
