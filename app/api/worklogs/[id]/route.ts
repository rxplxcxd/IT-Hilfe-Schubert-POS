export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessBeleg } from '@/lib/access';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (!(await canAccessBeleg('workLog', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const log = await prisma.workLog.findUnique({
      where: { id },
      include: { customer: true, photos: true },
    });
    if (!log) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    return NextResponse.json(log);
  } catch (error: any) {
    console.error('WorkLog GET error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (!(await canAccessBeleg('workLog', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const body = await request.json();
    const log = await prisma.workLog.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description ?? '',
        date: body.date ? new Date(body.date) : undefined,
      },
      include: { photos: true },
    });
    return NextResponse.json(log);
  } catch (error: any) {
    console.error('WorkLog PUT error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (!(await canAccessBeleg('workLog', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    await prisma.workLog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('WorkLog DELETE error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
