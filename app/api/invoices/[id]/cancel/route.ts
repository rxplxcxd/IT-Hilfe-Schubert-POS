export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getNextStornoNumber, parseEmployeeNo } from '@/lib/case-number';
import { canAccessBeleg } from '@/lib/access';

/**
 * POST /api/invoices/[id]/cancel
 * Storniert eine Rechnung und erzeugt eine Stornorechnung (SR-YYYY-XXX).
 * Finanzamtssicher: Originalrechnung bleibt erhalten, wird als STORNIERT markiert.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (!(await canAccessBeleg('invoice', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || '';

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true, customer: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });
    }

    if (invoice.status === 'STORNIERT') {
      return NextResponse.json({ error: 'Rechnung ist bereits storniert' }, { status: 400 });
    }

    if (invoice.isCancellation) {
      return NextResponse.json({ error: 'Eine Stornorechnung kann nicht erneut storniert werden' }, { status: 400 });
    }

    // Generate Stornorechnung number (pro Mitarbeiter, abgeleitet aus der Originalrechnung)
    const stornoEmployeeNo = parseEmployeeNo(invoice.caseNumber) ?? parseEmployeeNo(invoice.invoiceNumber);
    const stornoNumber = await getNextStornoNumber(stornoEmployeeNo);

    // Create Stornorechnung (negative amounts)
    const stornoInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: stornoNumber,
        caseNumber: invoice.caseNumber,
        customerId: invoice.customerId,
        subtotal: -invoice.subtotal,
        discount: -invoice.discount,
        travelCost: -invoice.travelCost,
        total: -invoice.total,
        paymentMethod: invoice.paymentMethod,
        status: 'STORNIERT',
        isCancellation: true,
        cancelsInvoiceId: invoice.id,
        cancellationReason: reason,
        cancelledAt: new Date(),
        notes: `Stornorechnung zu ${invoice.invoiceNumber}`,
        items: {
          create: invoice.items.map((item) => ({
            productId: item.productId,
            name: `STORNO: ${item.name}`,
            quantity: item.quantity,
            unitPrice: -item.unitPrice,
            total: -item.total,
          })),
        },
      },
      include: { customer: true, items: true },
    });

    // Mark original as cancelled
    await prisma.invoice.update({
      where: { id },
      data: {
        status: 'STORNIERT',
        cancelledAt: new Date(),
        cancelledByInvoiceId: stornoInvoice.id,
        cancellationReason: reason,
      },
    });

    return NextResponse.json({
      success: true,
      stornoInvoice,
      message: `Stornorechnung ${stornoNumber} wurde erstellt`,
    });
  } catch (error: any) {
    console.error('Invoice cancel error:', error);
    return NextResponse.json({ error: 'Fehler beim Stornieren' }, { status: 500 });
  }
}
