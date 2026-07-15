export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const expense = await prisma.expense.update({
      where: { id: parseInt(params.id) },
      data: {
        type: body.type,
        category: body.category ?? '',
        description: body.description ?? '',
        amount: parseFloat(body.amount) || 0,
        date: body.date ? new Date(body.date) : undefined,
        reference: body.reference ?? '',
      },
    });
    return NextResponse.json(expense);
  } catch (error: any) {
    console.error('Expense PUT error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.expense.delete({ where: { id: parseInt(params.id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Expense DELETE error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
