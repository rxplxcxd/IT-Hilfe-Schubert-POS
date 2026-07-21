export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessBeleg } from '@/lib/access';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (!(await canAccessBeleg('reminder', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
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
      where: { id },
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
    const id = parseInt(params.id);
    if (!(await canAccessBeleg('reminder', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    await prisma.reminder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
