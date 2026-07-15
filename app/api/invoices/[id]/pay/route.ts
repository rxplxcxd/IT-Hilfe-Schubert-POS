export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params?.id ?? '0');
    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'BEZAHLT',
        paidAt: new Date(),
      },
      include: { customer: true, items: true },
    });
    return NextResponse.json(invoice);
  } catch (error: any) {
    console.error('Mark paid error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
