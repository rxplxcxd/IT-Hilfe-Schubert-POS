export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';
import { sendEmail } from '@/lib/email';
import { ticketReplyHtml } from '@/lib/email-templates';

// POST: Neue Nachricht in einem Ticket (Admin oder Ersteller).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Nicht freigegeben' }, { status: 403 });
    }
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Ungueltige ID' }, { status: 400 });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    const isAdmin = access.role === 'ADMIN';
    if (!isAdmin && ticket.createdById !== access.id) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }

    const data = await request.json();
    const body = (data?.body ?? '').trim();
    const rawAttachments = Array.isArray(data?.attachments) ? data.attachments : [];
    const attachments = rawAttachments
      .filter((a: any) => a && a.url)
      .map((a: any) => ({
        url: String(a.url),
        filePath: String(a.filePath ?? ''),
        kind: a.kind === 'video' ? 'video' : 'image',
        caption: String(a.caption ?? ''),
      }));
    if (!body && attachments.length === 0) {
      return NextResponse.json({ error: 'Nachricht fehlt' }, { status: 400 });
    }

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        authorId: access.id,
        authorName: access.name || access.email,
        authorRole: isAdmin ? 'ADMIN' : 'EMPLOYEE',
        body,
        attachments: JSON.stringify(attachments),
      },
    });

    // Ungelesen-Markierung fuer die Gegenseite setzen + updatedAt anheben.
    await prisma.ticket.update({
      where: { id },
      data: isAdmin ? { employeeUnread: true } : { adminUnread: true },
    });

    // E-Mail an die Gegenseite.
    try {
      let toEmail: string | undefined;
      if (isAdmin) {
        const creator = await prisma.appUser.findUnique({ where: { id: ticket.createdById } });
        toEmail = creator?.email;
      } else {
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        toEmail = settings?.email || undefined;
      }
      if (toEmail) {
        await sendEmail({
          to: toEmail,
          subject: `Neue Antwort - Ticket ${ticket.ticketNumber}: ${ticket.subject}`,
          html: ticketReplyHtml({
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            authorName: access.name || access.email,
            body: body || (attachments.length ? `[${attachments.length} Anhang/Anhaenge]` : ''),
          }),
          replyTo: access.email || undefined,
        });
      }
    } catch (mailErr: any) {
      console.error('Ticket-Antwort-E-Mail fehlgeschlagen:', mailErr?.message);
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error: any) {
    console.error('Ticket message error:', error);
    return NextResponse.json({ error: 'Fehler beim Senden' }, { status: 500 });
  }
}
