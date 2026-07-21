export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessBeleg } from '@/lib/access';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (!(await canAccessBeleg('order', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const order = await prisma.order.findUnique({
      where: { id },
      include: { customer: true, photos: true },
    });
    if (!order) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
    return NextResponse.json(order);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (!(await canAccessBeleg('order', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const body = await request.json();
    const data: any = {};

    // Allow updating specific fields
    const allowedFields = [
      'title', 'description', 'status', 'workNotes', 'completionNotes',
      'liabilitySignature', 'liabilitySigned', 'liabilitySignedAt', 'disclaimerText',
      'handoverSignature', 'handoverSigned', 'handoverSignedAt',
      'customDocuments', 'startedAt', 'completedAt', 'completionPdfPath',
      'routeStartType', 'routeStartAddress', 'routeEndAddress',
      'routeDistanceKm', 'routeDurationMin', 'routeCalculatedAt',
      'cancelledAt', 'cancellationReason',
      'convertedInvoiceId',
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field.endsWith('At') && body[field]) {
          data[field] = new Date(body[field]);
        } else {
          data[field] = body[field];
        }
      }
    }

    const order = await prisma.order.update({
      where: { id },
      data,
      include: { customer: true, photos: true },
    });
    return NextResponse.json(order);
  } catch (error: any) {
    console.error('Order PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (!(await canAccessBeleg('order', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    await prisma.order.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
