export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'monthly'; // daily, weekly, monthly, yearly
    const months = parseInt(url.searchParams.get('months') || '6');
    const now = new Date();

    // Calculate date range based on period
    let rangeStart: Date;
    switch (period) {
      case 'daily':
        rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const dayOfWeek = now.getDay() || 7; // Mon=1
        rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
        break;
      case 'yearly':
        rangeStart = new Date(now.getFullYear(), 0, 1);
        break;
      default: // monthly
        rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Monthly revenue chart (always last N months)
    const monthlyData = [];
    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const invoices = await prisma.invoice.findMany({
        where: {
          status: 'BEZAHLT',
          isCancellation: false,
          paidAt: { gte: start, lt: end },
        },
      });
      const revenue = invoices.reduce((s, inv) => s + inv.total, 0);
      const count = invoices.length;
      monthlyData.push({
        month: start.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
        revenue,
        count,
      });
    }

    // Top services (only from non-cancelled, non-storno invoices)
    const allItems = await prisma.invoiceItem.findMany({
      where: { invoice: { status: { not: 'STORNIERT' }, isCancellation: false } },
      include: { invoice: true },
    });
    const serviceMap: Record<string, { count: number; revenue: number }> = {};
    for (const item of allItems) {
      if (!serviceMap[item.name]) serviceMap[item.name] = { count: 0, revenue: 0 };
      serviceMap[item.name].count += item.quantity;
      serviceMap[item.name].revenue += item.total;
    }
    const topServices = Object.entries(serviceMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Top customers (only paid, non-cancelled)
    const customers = await prisma.customer.findMany({
      include: { invoices: { where: { status: 'BEZAHLT', isCancellation: false } } },
    });
    const topCustomers = customers
      .map((c) => ({
        name: `${c.firstName} ${c.lastName}`,
        revenue: c.invoices.reduce((s, inv) => s + inv.total, 0),
        count: c.invoices.length,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Period-specific revenue (paid, non-storno, non-cancellation)
    const periodInvoices = await prisma.invoice.findMany({
      where: {
        status: 'BEZAHLT',
        isCancellation: false,
        paidAt: { gte: rangeStart },
      },
    });
    const periodRevenue = periodInvoices.reduce((s, inv) => s + inv.total, 0);
    const periodInvoiceCount = periodInvoices.length;

    // Overall stats
    const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
    const totalInvoices = monthlyData.reduce((s, m) => s + m.count, 0);
    const avgInvoice = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;
    const openInvoices = await prisma.invoice.count({ where: { status: 'OFFEN', isCancellation: false } });
    const openAmount = (await prisma.invoice.findMany({ where: { status: 'OFFEN', isCancellation: false } })).reduce((s, i) => s + i.total, 0);
    const totalCustomers = await prisma.customer.count();
    const activeSubscriptions = await prisma.subscription.count({ where: { active: true } });

    // Storno stats
    const cancelledInvoices = await prisma.invoice.findMany({
      where: { status: 'STORNIERT', isCancellation: false },
    });
    const cancelledAmount = cancelledInvoices.reduce((s, i) => s + i.total, 0);

    // Expenses summary (only type AUSGABE counts as expense)
    const periodExpenses = await prisma.expense.findMany({
      where: { date: { gte: new Date(now.getFullYear(), now.getMonth() - months + 1, 1) } },
    });
    const totalExpenses = periodExpenses.filter((e) => e.type === 'AUSGABE').reduce((s, e) => s + e.amount, 0);

    // CORRECT profit: Einnahmen (paid invoices) - Ausgaben (expenses)
    const profit = totalRevenue - totalExpenses;

    // Pending reminders
    const pendingReminders = await prisma.reminder.count({ where: { completed: false, dueDate: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } } });

    return NextResponse.json({
      monthlyData,
      topServices,
      topCustomers,
      summary: {
        totalRevenue,
        totalInvoices,
        avgInvoice,
        openInvoices,
        openAmount,
        totalCustomers,
        activeSubscriptions,
        totalExpenses,
        profit,
        cancelledAmount,
        cancelledCount: cancelledInvoices.length,
        pendingReminders,
        periodRevenue,
        periodInvoiceCount,
        period,
      },
    });
  } catch (error: any) {
    console.error('Stats GET error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
