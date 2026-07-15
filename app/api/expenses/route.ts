export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const month = url.searchParams.get('month'); // YYYY-MM
    const where: any = {};
    if (type) where.type = type;
    if (month) {
      const [y, m] = month.split('-').map(Number);
      where.date = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }
    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 200,
    });
    return NextResponse.json(expenses ?? []);
  } catch (error: any) {
    console.error('Expenses GET error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const expense = await prisma.expense.create({
      data: {
        type: body.type || 'AUSGABE',
        category: body.category || '',
        description: body.description || '',
        amount: parseFloat(body.amount) || 0,
        date: body.date ? new Date(body.date) : new Date(),
        reference: body.reference || '',
      },
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (error: any) {
    console.error('Expenses POST error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
