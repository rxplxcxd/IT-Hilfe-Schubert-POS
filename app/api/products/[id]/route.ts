export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    const body = await request.json();
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description ?? '',
        category: body.category,
        price: parseFloat(body.price) || 0,
        unit: body.unit ?? '',
        active: body.active ?? true,
        sortOrder: body.sortOrder ?? undefined,
      },
    });
    return NextResponse.json(product);
  } catch (error: any) {
    console.error('Product PUT error:', error);
    return NextResponse.json({ error: error?.message ?? 'Fehler beim Aktualisieren' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    // Soft delete - just set active to false
    await prisma.product.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Product DELETE error:', error);
    return NextResponse.json({ error: error?.message ?? 'Fehler beim Löschen' }, { status: 500 });
  }
}
