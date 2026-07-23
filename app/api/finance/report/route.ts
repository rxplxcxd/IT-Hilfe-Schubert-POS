export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope } from '@/lib/access';

/**
 * Finanz-Auswertung fuer Phase C (Belege, Kasse & Finanzen / GoBD).
 *
 * Liefert drei Bausteine fuer ein gewaehltes Jahr:
 *  1. Offene Posten (Punkt 40): alle unbezahlten Rechnungen mit Alter,
 *     sortiert nach aeltester zuerst; markiert ueberfaellige (>14 Tage).
 *  2. EUeR-Vorschau (Punkt 27): Einnahmen-Ueberschuss-Rechnung nach dem
 *     Zufluss-/Abfluss-Prinzip. Betriebseinnahmen = bezahlte Rechnungen
 *     (nach Zahldatum) + manuelle Einnahmen; Betriebsausgaben = manuelle
 *     Ausgaben je Kategorie. Gewinn = Einnahmen - Ausgaben.
 *  3. Monatsverlauf: Einnahmen/Ausgaben je Monat des Jahres.
 *
 * Datentrennung: Admin sieht alles, Mitarbeiter nur eigene Belege/Ausgaben.
 */
export async function GET(request: Request) {
  try {
    const scope = await getScope();
    const custFilter: any = scope.isAdmin
      ? {}
      : scope.access && scope.access.status === 'APPROVED'
      ? { ownerId: scope.access.id }
      : { ownerId: -1 };

    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()));
    const yStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const yEnd = new Date(year + 1, 0, 1, 0, 0, 0, 0);
    const now = new Date();
    const DAY = 86400e3;

    const [openInvoices, paidInvoices, expenses] = await Promise.all([
      // Offene Posten: alle unbezahlten, nicht stornierten Rechnungen (jahresuebergreifend)
      prisma.invoice.findMany({
        where: { status: 'OFFEN', isCancellation: false, customer: custFilter },
        select: {
          id: true, invoiceNumber: true, caseNumber: true, total: true, createdAt: true,
          customer: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      // Betriebseinnahmen (Zufluss): bezahlte, nicht stornierte Rechnungen im Jahr
      prisma.invoice.findMany({
        where: { status: 'BEZAHLT', isCancellation: false, paidAt: { gte: yStart, lt: yEnd }, customer: custFilter },
        select: { total: true, paidAt: true },
      }),
      // Manuelle Einnahmen/Ausgaben im Jahr
      prisma.expense.findMany({
        where: { date: { gte: yStart, lt: yEnd }, ...scope.ownerWhere },
        select: { type: true, category: true, amount: true, date: true },
      }),
    ]);

    // --- 1. Offene Posten ---
    const offenePosten = openInvoices.map((inv) => {
      const ageDays = Math.floor((now.getTime() - new Date(inv.createdAt).getTime()) / DAY);
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        caseNumber: inv.caseNumber,
        customerName: `${inv.customer?.firstName ?? ''} ${inv.customer?.lastName ?? ''}`.trim() || 'Unbekannt',
        total: inv.total,
        createdAt: inv.createdAt,
        ageDays,
        overdue: ageDays > 14,
      };
    }).sort((a, b) => b.ageDays - a.ageDays);
    const openTotal = offenePosten.reduce((s, o) => s + o.total, 0);
    const overdueTotal = offenePosten.filter((o) => o.overdue).reduce((s, o) => s + o.total, 0);

    // --- 2. EUeR ---
    const invoiceIncome = paidInvoices.reduce((s, i) => s + i.total, 0);
    const incomeByCategory: Record<string, number> = {};
    incomeByCategory['Dienstleistung (Rechnungen)'] = invoiceIncome;
    const expenseByCategory: Record<string, number> = {};
    for (const e of expenses) {
      const cat = e.category || 'Sonstiges';
      if (e.type === 'EINNAHME') {
        incomeByCategory[cat] = (incomeByCategory[cat] || 0) + e.amount;
      } else {
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + e.amount;
      }
    }
    const incomeTotal = Object.values(incomeByCategory).reduce((s, v) => s + v, 0);
    const expenseTotal = Object.values(expenseByCategory).reduce((s, v) => s + v, 0);

    // --- 3. Monatsverlauf ---
    const months = Array.from({ length: 12 }, (_, m) => ({ month: m + 1, einnahmen: 0, ausgaben: 0 }));
    for (const i of paidInvoices) {
      if (!i.paidAt) continue;
      const m = new Date(i.paidAt).getMonth();
      months[m].einnahmen += i.total;
    }
    for (const e of expenses) {
      const m = new Date(e.date).getMonth();
      if (e.type === 'EINNAHME') months[m].einnahmen += e.amount;
      else months[m].ausgaben += e.amount;
    }

    return NextResponse.json({
      year,
      offenePosten,
      openTotal,
      overdueTotal,
      euer: {
        incomeByCategory: Object.entries(incomeByCategory).map(([category, amount]) => ({ category, amount })).filter((x) => x.amount !== 0),
        expenseByCategory: Object.entries(expenseByCategory).map(([category, amount]) => ({ category, amount })).filter((x) => x.amount !== 0),
        incomeTotal,
        expenseTotal,
        profit: incomeTotal - expenseTotal,
      },
      months: months.map((m) => ({ ...m, saldo: m.einnahmen - m.ausgaben })),
    });
  } catch (error: any) {
    console.error('finance/report:', error?.message);
    return NextResponse.json({ error: 'Fehler bei der Auswertung' }, { status: 500 });
  }
}
