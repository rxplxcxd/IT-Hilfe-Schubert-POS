export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessCustomer } from '@/lib/access';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params?.id ?? '0');
    if (!(await canAccessCustomer(id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { subscriptions: true },
    });
    if (!customer) {
      return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 });
    }
    // Besitzer (Mitarbeiter) aufloesen, damit die Detailansicht anzeigen kann,
    // welchem MA der Kunde gehoert.
    let ownerName = '';
    let ownerNo: number | null = null;
    if (customer.ownerId) {
      const owner = await prisma.appUser.findUnique({
        where: { id: customer.ownerId },
        select: { name: true, email: true, employeeNo: true },
      });
      if (owner) {
        ownerName = (owner.name && owner.name.trim()) ? owner.name : owner.email;
        ownerNo = owner.employeeNo ?? null;
      }
    }
    return NextResponse.json({ ...customer, ownerName, ownerNo });
  } catch (error: any) {
    console.error('Customer get error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params?.id ?? '0');
    if (!(await canAccessCustomer(id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
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
    if (!(await canAccessCustomer(id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Customer delete error:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 });
  }
}
