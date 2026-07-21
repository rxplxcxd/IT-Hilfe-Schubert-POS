export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessBeleg } from '@/lib/access';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const quoteId = parseInt(params.id);
    if (!(await canAccessBeleg('quote', quoteId))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { items: true, customer: true },
    });
    if (!quote) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    // Use the same case number from the quote
    const { getCaseSubNumbers } = await import('@/lib/case-number');
    const caseNumber = quote.caseNumber;
    const { invoiceNumber } = getCaseSubNumbers(caseNumber);

    // Create invoice from quote
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        caseNumber,
        customerId: quote.customerId,
        subtotal: quote.subtotal,
        discount: quote.discount,
        travelCost: quote.travelCost,
        total: quote.total,
        paymentMethod: 'BAR',
        status: 'OFFEN',
        notes: `Erstellt aus Angebot ${quote.quoteNumber}`,
        items: {
          create: quote.items.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
      },
    });

    // Update quote status
    await prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'ANGENOMMEN', acceptedAt: new Date(), convertedInvoiceId: invoice.id },
    });

    return NextResponse.json({ success: true, invoiceId: invoice.id, invoiceNumber });
  } catch (error: any) {
    console.error('Quote accept error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
