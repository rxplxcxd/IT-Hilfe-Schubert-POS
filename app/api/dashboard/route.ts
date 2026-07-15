export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [openInvoices, paidThisMonth, totalCustomers, invoiceCount] = await Promise.all([
      prisma.invoice.findMany({
        where: { status: 'OFFEN', isCancellation: false },
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.findMany({
        where: {
          status: 'BEZAHLT',
          isCancellation: false,
          paidAt: { gte: startOfMonth },
        },
      }),
      prisma.customer.count(),
      prisma.invoice.count({ where: { isCancellation: false } }),
    ]);

    const monthlyRevenue = (paidThisMonth ?? []).reduce((sum: number, inv: any) => sum + (inv?.total ?? 0), 0);

    return NextResponse.json({
      openInvoices: openInvoices ?? [],
      monthlyRevenue,
      totalCustomers: totalCustomers ?? 0,
      invoiceCount: invoiceCount ?? 0,
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ openInvoices: [], monthlyRevenue: 0, totalCustomers: 0, invoiceCount: 0 });
  }
}
