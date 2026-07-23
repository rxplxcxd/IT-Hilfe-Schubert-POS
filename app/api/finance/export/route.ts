export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope } from '@/lib/access';

/**
 * CSV-Export fuer den Steuerberater (Punkt 26 - Kassenbuch/DATEV-naher Export).
 *
 * Erzeugt eine chronologische Liste aller Buchungen eines Jahres:
 *  - Betriebseinnahmen = bezahlte, nicht stornierte Rechnungen (nach Zahldatum)
 *  - Manuelle Einnahmen/Ausgaben aus dem Finanzen-Tracker
 *
 * Format: Semikolon-getrennt, deutsches Zahlenformat (Komma), UTF-8 mit BOM
 * (damit Excel Umlaute korrekt anzeigt). Dies ist ein sauberer, gut lesbarer
 * CSV-Export -- KEIN zertifiziertes DATEV-Format. Fuer die endgueltige
 * Verbuchung bitte mit dem Steuerberater abstimmen.
 *
 * Datentrennung wie ueberall: Admin alles, Mitarbeiter nur eigene Daten.
 */
function deDate(d: Date): string {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}
function deAmount(n: number): string {
  return n.toFixed(2).replace('.', ',');
}
function csvCell(s: string): string {
  const v = String(s ?? '');
  if (v.includes(';') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
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
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()));
    const yStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const yEnd = new Date(year + 1, 0, 1, 0, 0, 0, 0);

    const [paidInvoices, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: { status: 'BEZAHLT', isCancellation: false, paidAt: { gte: yStart, lt: yEnd }, customer: custFilter },
        select: {
          invoiceNumber: true, total: true, paidAt: true, paymentMethod: true,
          customer: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.expense.findMany({
        where: { date: { gte: yStart, lt: yEnd }, ...scope.ownerWhere },
        select: { type: true, category: true, description: true, amount: true, date: true, reference: true },
      }),
    ]);

    type Row = { date: Date; beleg: string; art: string; kategorie: string; beschreibung: string; kunde: string; einnahme: number; ausgabe: number };
    const rows: Row[] = [];

    for (const i of paidInvoices) {
      rows.push({
        date: i.paidAt as Date,
        beleg: i.invoiceNumber,
        art: 'Einnahme (Rechnung)',
        kategorie: 'Dienstleistung',
        beschreibung: `Zahlung ${i.paymentMethod === 'BAR' ? 'bar' : 'unbar'}`,
        kunde: `${i.customer?.firstName ?? ''} ${i.customer?.lastName ?? ''}`.trim(),
        einnahme: i.total,
        ausgabe: 0,
      });
    }
    for (const e of expenses) {
      const isIncome = e.type === 'EINNAHME';
      rows.push({
        date: e.date,
        beleg: e.reference || '-',
        art: isIncome ? 'Einnahme (manuell)' : 'Ausgabe',
        kategorie: e.category || 'Sonstiges',
        beschreibung: e.description || '',
        kunde: '',
        einnahme: isIncome ? e.amount : 0,
        ausgabe: isIncome ? 0 : e.amount,
      });
    }

    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const sumEin = rows.reduce((s, r) => s + r.einnahme, 0);
    const sumAus = rows.reduce((s, r) => s + r.ausgabe, 0);

    const header = ['Datum', 'Beleg-Nr', 'Art', 'Kategorie', 'Beschreibung', 'Kunde', 'Einnahme (EUR)', 'Ausgabe (EUR)'];
    const lines: string[] = [];
    lines.push(header.join(';'));
    for (const r of rows) {
      lines.push([
        deDate(r.date), csvCell(r.beleg), csvCell(r.art), csvCell(r.kategorie),
        csvCell(r.beschreibung), csvCell(r.kunde), deAmount(r.einnahme), deAmount(r.ausgabe),
      ].join(';'));
    }
    lines.push(['', '', '', '', '', 'Summe', deAmount(sumEin), deAmount(sumAus)].join(';'));
    lines.push(['', '', '', '', '', 'Gewinn (EUeR)', deAmount(sumEin - sumAus), ''].join(';'));

    const csv = '\uFEFF' + lines.join('\r\n');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Kassenbuch_${year}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('finance/export:', error?.message);
    return NextResponse.json({ error: 'Fehler beim Export' }, { status: 500 });
  }
}
