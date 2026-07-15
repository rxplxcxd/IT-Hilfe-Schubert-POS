export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params?.id ?? '0');
    const data = await request.json();
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        firstName: data?.firstName ?? '',
        lastName: data?.lastName ?? '',
        street: data?.street ?? '',
        houseNr: data?.houseNr ?? '',
        zip: data?.zip ?? '',
        city: data?.city ?? '',
        phone: data?.phone ?? '',
        email: data?.email ?? '',
        zone: data?.zone ?? 1,
        notes: data?.notes ?? '',
      },
    });
    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('Customer update error:', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params?.id ?? '0');
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Customer delete error:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 });
  }
}
