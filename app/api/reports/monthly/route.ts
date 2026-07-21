export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope } from '@/lib/access';

export async function GET(request: Request) {
  try {
    const scope = await getScope();
    const custFilter: any = scope.isAdmin
      ? {}
      : scope.access && scope.access.status === 'APPROVED'
      ? { ownerId: scope.access.id }
      : { ownerId: -1 };

    const url = new URL(request.url);
    const month = url.searchParams.get('month'); // YYYY-MM
    if (!month) return NextResponse.json({ error: 'month parameter required' }, { status: 400 });

    const [y, m] = month.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    const monthLabel = start.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    // Invoices this month
    const invoices = await prisma.invoice.findMany({
      where: { createdAt: { gte: start, lt: end }, customer: custFilter },
      include: { customer: true, items: true },
      orderBy: { createdAt: 'asc' },
    });

    const paidInvoices = invoices.filter((i) => i.status === 'BEZAHLT');
    const openInvoices = invoices.filter((i) => i.status === 'OFFEN');
    const totalRevenue = paidInvoices.reduce((s, i) => s + i.total, 0);
    const totalOpen = openInvoices.reduce((s, i) => s + i.total, 0);

    // Expenses this month
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: start, lt: end }, ...scope.ownerWhere },
      orderBy: { date: 'asc' },
    });
    const totalExpenses = expenses.filter((e) => e.type === 'AUSGABE').reduce((s, e) => s + e.amount, 0);
    const totalExtraIncome = expenses.filter((e) => e.type === 'EINNAHME').reduce((s, e) => s + e.amount, 0);

    // New customers this month
    const newCustomers = await prisma.customer.count({
      where: { createdAt: { gte: start, lt: end }, ...custFilter },
    });

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });

    return NextResponse.json({
      month: monthLabel,
      monthKey: month,
      invoices: invoices.map((i) => ({
        number: i.invoiceNumber,
        customer: `${i.customer.firstName} ${i.customer.lastName}`,
        total: i.total,
        status: i.status,
        date: i.createdAt,
        paymentMethod: i.paymentMethod,
      })),
      expenses: expenses.map((e) => ({
        description: e.description,
        category: e.category,
        amount: e.amount,
        type: e.type,
        date: e.date,
      })),
      summary: {
        totalRevenue,
        totalOpen,
        totalExpenses,
        totalExtraIncome,
        profit: totalRevenue + totalExtraIncome - totalExpenses,
        invoiceCount: invoices.length,
        paidCount: paidInvoices.length,
        openCount: openInvoices.length,
        newCustomers,
      },
      settings: {
        companyName: settings?.companyName || 'IT-Hilfe Schubert',
        ownerName: settings?.ownerName || '',
        taxInfo: settings?.taxInfo || '',
      },
    });
  } catch (error: any) {
    console.error('Monthly report error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
