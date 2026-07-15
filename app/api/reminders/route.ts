export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customerId');
    const pending = url.searchParams.get('pending');
    const where: any = {};
    if (customerId) where.customerId = parseInt(customerId);
    if (pending === 'true') where.completed = false;
    const reminders = await prisma.reminder.findMany({
      where,
      include: { customer: true },
      orderBy: { dueDate: 'asc' },
      take: 100,
    });
    return NextResponse.json(reminders ?? []);
  } catch (error: any) {
    console.error('Reminders GET error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reminder = await prisma.reminder.create({
      data: {
        customerId: parseInt(body.customerId),
        type: body.type || 'CUSTOM',
        title: body.title,
        message: body.message || '',
        dueDate: new Date(body.dueDate),
      },
      include: { customer: true },
    });
    return NextResponse.json(reminder, { status: 201 });
  } catch (error: any) {
    console.error('Reminders POST error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
