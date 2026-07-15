export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { OrderDocument } from '@/lib/pdf/OrderDocument';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(params.id) },
      include: { customer: true, photos: true },
    });
    if (!order) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });

    const pdfBuffer = await renderToBuffer(
      createElement(OrderDocument as any, { order, settings: settings || {} }) as any
    );

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${order.orderNumber || 'auftrag'}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Order PDF error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
