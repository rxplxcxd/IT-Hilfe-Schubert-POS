export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(invoices ?? []);
  } catch (error: any) {
    console.error('Invoices GET error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const items = data?.items ?? [];

    // Calculate subtotal
    const subtotal = items.reduce((sum: number, item: any) => sum + ((item?.unitPrice ?? 0) * (item?.quantity ?? 1)), 0);
    const travelCost = data?.travelCost ?? 0;
    const discount = data?.discount ?? 0;
    const total = subtotal - discount + travelCost;

    // Generate unified case number
    const { getNextCaseNumber, getCaseSubNumbers } = await import('@/lib/case-number');
    const caseNumber = data?.caseNumber || await getNextCaseNumber();
    const { invoiceNumber } = getCaseSubNumbers(caseNumber);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        caseNumber,
        customerId: data?.customerId,
        subtotal,
        discount,
        travelCost,
        total,
        paymentMethod: data?.paymentMethod ?? 'BAR',
        notes: data?.notes ?? '',
        items: {
          create: items.map((item: any) => ({
            productId: item?.productId ?? null,
            name: item?.name ?? '',
            quantity: item?.quantity ?? 1,
            unitPrice: item?.unitPrice ?? 0,
            total: (item?.unitPrice ?? 0) * (item?.quantity ?? 1),
          })),
        },
      },
      include: { customer: true, items: true },
    });

    return NextResponse.json(invoice);
  } catch (error: any) {
    console.error('Invoice create error:', error);
    return NextResponse.json({ error: 'Fehler beim Erstellen der Rechnung' }, { status: 500 });
  }
}
