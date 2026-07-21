export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';

const EMPTY = { pendingUsers: 0, openAppointments: 0, dueReminders: 0, total: 0 };

// GET: aggregierte Zaehler fuer das globale Notification-Badge
export async function GET() {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json(EMPTY, { status: 200 });
    }
    const isAdmin = access.role === 'ADMIN';
    // Datentrennung: Mitarbeiter sehen nur eigene faellige Erinnerungen.
    const custFilter: any = isAdmin ? {} : { ownerId: access.id };

    const [pendingUsers, openAppointments, dueReminders] = await Promise.all([
      isAdmin ? prisma.appUser.count({ where: { status: 'PENDING' } }) : Promise.resolve(0),
      isAdmin ? prisma.appointment.count({ where: { status: 'OFFEN' } }) : Promise.resolve(0),
      prisma.reminder.count({ where: { completed: false, dueDate: { lte: new Date() }, customer: custFilter } }),
    ]);

    const total = pendingUsers + openAppointments + dueReminders;
    return NextResponse.json({ pendingUsers, openAppointments, dueReminders, total });
  } catch (error: any) {
    console.error('notifications/summary:', error?.message);
    return NextResponse.json(EMPTY, { status: 200 });
  }
}
