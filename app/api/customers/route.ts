export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope } from '@/lib/access';

export async function GET() {
  try {
    const scope = await getScope();
    const customers = await prisma.customer.findMany({
      where: { ...scope.ownerWhere },
      orderBy: { lastName: 'asc' },
      include: { subscriptions: { where: { active: true } } },
    });
    return NextResponse.json(customers ?? []);
  } catch (error: any) {
    console.error('Customers GET error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await getScope();
    if (!scope.access || scope.access.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Nicht freigegeben' }, { status: 403 });
    }
    const data = await request.json();
    const customer = await prisma.customer.create({
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
        // Kunde gehoert dem anlegenden Mitarbeiter (Datentrennung).
        ownerId: scope.access.id,
      },
    });
    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('Customer create error:', error);
    return NextResponse.json({ error: 'Fehler beim Anlegen' }, { status: 500 });
  }
}
