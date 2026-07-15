export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { InvoiceDocument } from '@/lib/pdf/InvoiceDocument';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params?.id ?? '0');
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, items: true },
    });
    if (!invoice) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });

    let settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 1, companyName: 'IT-Hilfe Schubert', ownerName: 'Leon Schubert', taxInfo: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.' },
      });
    }

    const pdfBuffer = await renderToBuffer(
      createElement(InvoiceDocument, { invoice, settings })
    );

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice?.invoiceNumber ?? 'rechnung'}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'PDF-Fehler' }, { status: 500 });
  }
}
