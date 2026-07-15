export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customerId');
    const where = customerId ? { customerId: parseInt(customerId) } : {};
    const logs = await prisma.workLog.findMany({
      where,
      include: { customer: true, photos: true },
      orderBy: { date: 'desc' },
      take: 50,
    });
    return NextResponse.json(logs ?? []);
  } catch (error: any) {
    console.error('WorkLogs GET error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const log = await prisma.workLog.create({
      data: {
        customerId: parseInt(body.customerId),
        invoiceId: body.invoiceId ? parseInt(body.invoiceId) : null,
        title: body.title,
        description: body.description || '',
        date: body.date ? new Date(body.date) : new Date(),
      },
      include: { photos: true },
    });
    return NextResponse.json(log, { status: 201 });
  } catch (error: any) {
    console.error('WorkLogs POST error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
