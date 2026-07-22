export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope } from '@/lib/access';

// Range-Konfiguration: bucket = zeitliche Aufloesung, ms = Zeitfenster.
type Bucket = 'hour' | 'day' | 'week' | 'month';
const RANGES: Record<string, { ms: number; bucket: Bucket }> = {
  '24h': { ms: 24 * 3600e3, bucket: 'hour' },
  '2d': { ms: 2 * 86400e3, bucket: 'hour' },
  '7d': { ms: 7 * 86400e3, bucket: 'day' },
  '14d': { ms: 14 * 86400e3, bucket: 'day' },
  '30d': { ms: 30 * 86400e3, bucket: 'day' },
  '60d': { ms: 60 * 86400e3, bucket: 'day' },
  '90d': { ms: 90 * 86400e3, bucket: 'week' },
  '180d': { ms: 180 * 86400e3, bucket: 'month' },
  '1yr': { ms: 365 * 86400e3, bucket: 'month' },
  '2yrs': { ms: 730 * 86400e3, bucket: 'month' },
};

function bucketKey(d: Date, bucket: Bucket): string {
  switch (bucket) {
    case 'hour':
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
    case 'day':
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    case 'week': {
      // ISO-ish Woche: Jahr + Wochennummer
      const onejan = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400e3 + onejan.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${week}`;
    }
    case 'month':
      return `${d.getFullYear()}-${d.getMonth()}`;
  }
}

function bucketLabel(d: Date, bucket: Bucket): string {
  switch (bucket) {
    case 'hour':
      return `${String(d.getHours()).padStart(2, '0')}:00`;
    case 'day':
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    case 'week':
      return `KW ${bucketKey(d, 'week').split('W')[1]}`;
    case 'month':
      return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  }
}

// Erzeugt eine geordnete, komplette Liste aller Buckets im Zeitfenster (auch leere).
function buildBuckets(start: Date, end: Date, bucket: Bucket) {
  const out: { key: string; label: string }[] = [];
  const cur = new Date(start);
  if (bucket === 'hour') cur.setMinutes(0, 0, 0);
  else cur.setHours(0, 0, 0, 0);
  if (bucket === 'month') cur.setDate(1);
  let guard = 0;
  while (cur <= end && guard < 1000) {
    out.push({ key: bucketKey(cur, bucket), label: bucketLabel(cur, bucket) });
    if (bucket === 'hour') cur.setHours(cur.getHours() + 1);
    else if (bucket === 'day') cur.setDate(cur.getDate() + 1);
    else if (bucket === 'week') cur.setDate(cur.getDate() + 7);
    else cur.setMonth(cur.getMonth() + 1);
    guard++;
  }
  return out;
}

export async function GET(request: Request) {
  try {
    const scope = await getScope();
    const custFilter: any = scope.isAdmin
      ? {}
      : scope.access && scope.access.status === 'APPROVED'
      ? { ownerId: scope.access.id }
      : { ownerId: -1 };

    const url = new URL(request.url);
    const rangeKey = url.searchParams.get('range') || '180d';
    const cfg = RANGES[rangeKey] || RANGES['180d'];
    const now = new Date();
    const start = new Date(now.getTime() - cfg.ms);

    // EIN Fetch pro Datentyp fuer das gesamte Fenster -> in JS bucketen (schnell).
    const [paidInvoices, rangeItems, expenses, statusInvoices] = await Promise.all([
      prisma.invoice.findMany({
        where: { status: 'BEZAHLT', isCancellation: false, paidAt: { gte: start }, customer: custFilter },
        select: { total: true, paidAt: true, customerId: true, customer: { select: { firstName: true, lastName: true } } },
      }),
      prisma.invoiceItem.findMany({
        where: { invoice: { status: 'BEZAHLT', isCancellation: false, paidAt: { gte: start }, customer: custFilter } },
        select: { name: true, quantity: true, total: true },
      }),
      prisma.expense.findMany({
        where: { date: { gte: start }, ...scope.ownerWhere },
        select: { amount: true, type: true, date: true },
      }),
      prisma.invoice.findMany({
        where: { isCancellation: false, createdAt: { gte: start }, customer: custFilter },
        select: { status: true, total: true },
      }),
    ]);

    // --- Umsatz-Zeitreihe (Item 4) ---
    const buckets = buildBuckets(start, now, cfg.bucket);
    const revMap: Record<string, { revenue: number; count: number }> = {};
    for (const b of buckets) revMap[b.key] = { revenue: 0, count: 0 };
    for (const inv of paidInvoices) {
      if (!inv.paidAt) continue;
      const k = bucketKey(new Date(inv.paidAt), cfg.bucket);
      if (!revMap[k]) revMap[k] = { revenue: 0, count: 0 };
      revMap[k].revenue += inv.total;
      revMap[k].count += 1;
    }
    const revenueSeries = buckets.map((b) => ({
      label: b.label,
      revenue: Math.round(revMap[b.key]?.revenue ?? 0),
      count: revMap[b.key]?.count ?? 0,
    }));

    // --- Einnahmen/Ausgaben-Zeitreihe (Item 5, KPI: cashflow) ---
    const einMap: Record<string, { ein: number; aus: number }> = {};
    for (const b of buckets) einMap[b.key] = { ein: 0, aus: 0 };
    for (const inv of paidInvoices) {
      if (!inv.paidAt) continue;
      const k = bucketKey(new Date(inv.paidAt), cfg.bucket);
      if (einMap[k]) einMap[k].ein += inv.total;
    }
    for (const e of expenses) {
      const k = bucketKey(new Date(e.date), cfg.bucket);
      if (!einMap[k]) continue;
      if (e.type === 'AUSGABE') einMap[k].aus += e.amount;
      else einMap[k].ein += e.amount; // EINNAHME
    }
    const incomeExpense = buckets.map((b) => ({
      label: b.label,
      einnahmen: Math.round(einMap[b.key]?.ein ?? 0),
      ausgaben: Math.round(einMap[b.key]?.aus ?? 0),
    }));

    // --- Top-Leistungen (Item 5, KPI: services) ---
    const svcMap: Record<string, number> = {};
    for (const it of rangeItems) svcMap[it.name] = (svcMap[it.name] ?? 0) + it.total;
    const topServices = Object.entries(svcMap)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // --- Rechnungs-Status Verteilung (Item 5, KPI: status) ---
    const statusMap: Record<string, number> = {};
    for (const inv of statusInvoices) statusMap[inv.status] = (statusMap[inv.status] ?? 0) + 1;
    const statusLabels: Record<string, string> = { OFFEN: 'Offen', BEZAHLT: 'Bezahlt', STORNIERT: 'Storniert' };
    const invoiceStatus = Object.entries(statusMap).map(([k, v]) => ({ name: statusLabels[k] ?? k, value: v }));

    // --- Top-Kunden (Item 5, KPI: customers) ---
    const custMap: Record<string, number> = {};
    for (const inv of paidInvoices) {
      const nm = `${inv.customer?.firstName ?? ''} ${inv.customer?.lastName ?? ''}`.trim() || 'Unbekannt';
      custMap[nm] = (custMap[nm] ?? 0) + inv.total;
    }
    const topCustomers = Object.entries(custMap)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const totalRevenue = paidInvoices.reduce((s, i) => s + i.total, 0);
    const totalExpenses = expenses.filter((e) => e.type === 'AUSGABE').reduce((s, e) => s + e.amount, 0);

    return NextResponse.json({
      range: rangeKey,
      revenueSeries,
      incomeExpense,
      topServices,
      invoiceStatus,
      topCustomers,
      summary: {
        totalRevenue: Math.round(totalRevenue),
        totalExpenses: Math.round(totalExpenses),
        profit: Math.round(totalRevenue - totalExpenses),
        paidCount: paidInvoices.length,
      },
    });
  } catch (error: any) {
    console.error('Analytics GET error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
