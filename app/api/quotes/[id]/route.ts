export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: parseInt(params.id) },
      include: { customer: true, items: true },
    });
    if (!quote) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    return NextResponse.json(quote);
  } catch (error: any) {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const id = parseInt(params.id);
    const data: any = {};
    const allowedFields = ['status', 'notes', 'validUntil', 'cancelledAt', 'cancellationReason'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field.endsWith('At') || field === 'validUntil') {
          data[field] = body[field] ? new Date(body[field]) : null;
        } else {
          data[field] = body[field];
        }
      }
    }
    const quote = await prisma.quote.update({
      where: { id },
      data,
      include: { customer: true, items: true },
    });
    return NextResponse.json(quote);
  } catch (error: any) {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.quote.delete({ where: { id: parseInt(params.id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
