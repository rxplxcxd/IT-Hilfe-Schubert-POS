export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Alle Zeitfenster laden
export async function GET() {
  try {
    const slots = await prisma.timeSlot.findMany({
      where: { active: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return NextResponse.json(slots);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Neues Zeitfenster erstellen
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const slot = await prisma.timeSlot.create({
      data: {
        dayOfWeek: body.dayOfWeek,
        startTime: body.startTime,
        endTime: body.endTime,
      },
    });
    return NextResponse.json(slot, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
