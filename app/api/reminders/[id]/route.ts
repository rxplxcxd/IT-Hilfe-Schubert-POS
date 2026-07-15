export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const data: any = {};
    if (body.completed !== undefined) {
      data.completed = body.completed;
      data.completedAt = body.completed ? new Date() : null;
    }
    if (body.title) data.title = body.title;
    if (body.message !== undefined) data.message = body.message;
    if (body.dueDate) data.dueDate = new Date(body.dueDate);
    const reminder = await prisma.reminder.update({
      where: { id: parseInt(params.id) },
      data,
      include: { customer: true },
    });
    return NextResponse.json(reminder);
  } catch (error: any) {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.reminder.delete({ where: { id: parseInt(params.id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
