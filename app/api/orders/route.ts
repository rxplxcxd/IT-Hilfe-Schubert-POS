export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');

    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    if (customerId) where.customerId = parseInt(customerId);

    const orders = await prisma.order.findMany({
      where,
      include: { customer: true, photos: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(orders);
  } catch (error: any) {
    console.error('Orders GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Generate unified case number
    const { getNextCaseNumber, getCaseSubNumbers } = await import('@/lib/case-number');
    const caseNumber = body.caseNumber || await getNextCaseNumber();
    const { orderNumber } = getCaseSubNumbers(caseNumber);

    // Get default disclaimer text from settings
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const disclaimerText = body.disclaimerText || settings?.disclaimerDefaultText || '';

    const order = await prisma.order.create({
      data: {
        orderNumber,
        caseNumber,
        customerId: body.customerId,
        title: body.title || '',
        description: body.description || '',
        disclaimerText,
      },
      include: { customer: true, photos: true },
    });
    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error('Orders POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
