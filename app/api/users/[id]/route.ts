export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCurrentUserAdmin } from '@/lib/access';
import { sendEmail } from '@/lib/email';
import { accessApprovedHtml } from '@/lib/email-templates';

// GET: Detail eines Mitarbeiters inkl. seiner Kunden und Kennzahlen (nur Admin)
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const user = await prisma.appUser.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    const customers = await prisma.customer.findMany({
      where: { ownerId: id },
      orderBy: { lastName: 'asc' },
      select: { id: true, firstName: true, lastName: true, city: true, phone: true },
    });

    // Kennzahlen ueber die Kunden dieses Mitarbeiters.
    const [invoiceAgg, orderCount, paidAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: { customer: { ownerId: id } },
        _count: true,
      }),
      prisma.order.count({ where: { customer: { ownerId: id } } }),
      prisma.invoice.aggregate({
        where: { customer: { ownerId: id }, status: 'BEZAHLT' },
        _sum: { total: true },
      }),
    ]);

    const stats = {
      customerCount: customers.length,
      invoiceCount: invoiceAgg._count || 0,
      orderCount: orderCount || 0,
      revenue: paidAgg._sum.total || 0,
    };

    return NextResponse.json({ user, customers, stats });
  } catch (error: any) {
    console.error('users GET detail:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

// PATCH: Freigeben / Ablehnen / Rolle aendern (nur Admin)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const action = body?.action as string;

    const user = await prisma.appUser.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    if (action === 'approve') {
      const updated = await prisma.appUser.update({
        where: { id },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
      try {
        await sendEmail({
          to: updated.email,
          subject: 'Dein Zugang wurde freigeschaltet',
          html: accessApprovedHtml({ name: updated.name }),
        });
      } catch (e: any) {
        console.error('approve email:', e?.message);
      }
      return NextResponse.json(updated);
    }

    if (action === 'reject') {
      const updated = await prisma.appUser.update({
        where: { id },
        data: { status: 'REJECTED', approvedAt: null },
      });
      return NextResponse.json(updated);
    }

    if (action === 'role') {
      const role = body?.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE';
      const updated = await prisma.appUser.update({ where: { id }, data: { role } });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error: any) {
    console.error('users PATCH:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

// DELETE: Nutzer entfernen (nur Admin)
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
    await prisma.appUser.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('users DELETE:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
