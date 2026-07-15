export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { appointmentCustomerHtml, appointmentAdminHtml } from '@/lib/email-templates';

// GET: Termine laden (admin) oder verfügbare Slots für ein Datum (public)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const dateStr = searchParams.get('date');
    const publicMode = searchParams.get('public') === 'true';

    // Public: Verfügbare Zeitfenster für ein bestimmtes Datum
    if (publicMode && dateStr) {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay(); // 0=So...6=Sa

      // Alle aktiven Zeitfenster für diesen Wochentag
      const slots = await prisma.timeSlot.findMany({
        where: { dayOfWeek, active: true },
        orderBy: { startTime: 'asc' },
      });

      // Bereits gebuchte Termine an diesem Tag
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const booked = await prisma.appointment.findMany({
        where: {
          date: { gte: startOfDay, lte: endOfDay },
          status: { in: ['OFFEN', 'BESTAETIGT'] },
        },
        select: { startTime: true },
      });
      const bookedTimes = new Set(booked.map(b => b.startTime));

      // Nur freie Slots zurückgeben
      const available = slots.filter(s => !bookedTimes.has(s.startTime));
      return NextResponse.json(available);
    }

    // Admin: Alle Termine
    const where: any = {};
    if (status && status !== 'ALL') where.status = status;

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { date: 'asc' },
    });
    return NextResponse.json(appointments);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Neuen Termin buchen (öffentlich)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, startTime, endTime, customerName, customerPhone, customerEmail, address, description } = body;

    if (!date || !startTime || !endTime || !customerName || !customerPhone) {
      return NextResponse.json({ error: 'Bitte alle Pflichtfelder ausfüllen' }, { status: 400 });
    }

    // Prüfen ob Slot noch frei ist
    const bookingDate = new Date(date);
    const startOfDay = new Date(bookingDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(bookingDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await prisma.appointment.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        startTime,
        status: { in: ['OFFEN', 'BESTAETIGT'] },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Dieser Termin ist leider nicht mehr verfügbar' }, { status: 409 });
    }

    const appointment = await prisma.appointment.create({
      data: {
        date: bookingDate,
        startTime,
        endTime,
        customerName,
        customerPhone,
        customerEmail: customerEmail || '',
        address: address || '',
        description: description || '',
      },
    });

    // Automatische E-Mails (Resend) - Fehler blockieren die Buchung nie
    try {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      const emailData = {
        customerName,
        customerPhone,
        customerEmail: customerEmail || '',
        address: address || '',
        description: description || '',
        date: bookingDate,
        startTime,
        endTime,
        companyName: settings?.companyName || 'IT-Hilfe Schubert',
        ownerName: settings?.ownerName || 'Leon Schubert',
        phone: settings?.phone || '',
      };

      // Bestaetigung an den Kunden (nur wenn E-Mail angegeben)
      if (customerEmail) {
        await sendEmail({
          to: customerEmail,
          subject: `Terminanfrage erhalten - ${emailData.companyName}`,
          html: appointmentCustomerHtml(emailData),
          replyTo: settings?.email || undefined,
        }).catch((e) => console.error('Kunden-E-Mail fehlgeschlagen:', e?.message));
      }

      // Benachrichtigung an den Inhaber
      const adminEmail = settings?.email;
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: `Neue Terminbuchung: ${customerName} am ${bookingDate.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}`,
          html: appointmentAdminHtml(emailData),
          replyTo: customerEmail || undefined,
        }).catch((e) => console.error('Admin-E-Mail fehlgeschlagen:', e?.message));
      }
    } catch (mailErr: any) {
      console.error('E-Mail-Versand uebersprungen:', mailErr?.message);
    }

    return NextResponse.json(appointment, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
