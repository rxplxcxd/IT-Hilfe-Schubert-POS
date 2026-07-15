export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(products ?? []);
  } catch (error: any) {
    console.error('Products GET error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const maxSort = await prisma.product.aggregate({ _max: { sortOrder: true } });
    const product = await prisma.product.create({
      data: {
        name: body.name,
        description: body.description || '',
        category: body.category || 'FIXED',
        price: parseFloat(body.price) || 0,
        unit: body.unit || '',
        active: true,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    console.error('Products POST error:', error);
    return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 });
  }
}
