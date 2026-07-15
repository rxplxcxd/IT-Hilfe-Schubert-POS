export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customerId');
    const status = url.searchParams.get('status');
    const where: any = {};
    if (customerId) where.customerId = parseInt(customerId);
    if (status && status !== 'ALL') where.status = status;
    const quotes = await prisma.quote.findMany({
      where,
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json(quotes ?? []);
  } catch (error: any) {
    console.error('Quotes GET error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Generate unified case number
    const { getNextCaseNumber, getCaseSubNumbers } = await import('@/lib/case-number');
    const caseNumber = await getNextCaseNumber();
    const { quoteNumber } = getCaseSubNumbers(caseNumber);

    const items = (body.items || []).map((item: any) => ({
      productId: item.productId || null,
      name: item.name,
      quantity: item.quantity || 1,
      unitPrice: parseFloat(item.unitPrice) || 0,
      total: (item.quantity || 1) * (parseFloat(item.unitPrice) || 0),
    }));

    const subtotal = items.reduce((s: number, i: any) => s + i.total, 0);
    const discount = parseFloat(body.discount) || 0;
    const travelCost = parseFloat(body.travelCost) || 0;
    const total = subtotal - discount + travelCost;

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        caseNumber,
        customerId: parseInt(body.customerId),
        subtotal,
        discount,
        travelCost,
        total,
        status: 'ENTWURF',
        validUntil: body.validUntil ? new Date(body.validUntil) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        notes: body.notes || '',
        items: { create: items },
      },
      include: { customer: true, items: true },
    });
    return NextResponse.json(quote, { status: 201 });
  } catch (error: any) {
    console.error('Quotes POST error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
