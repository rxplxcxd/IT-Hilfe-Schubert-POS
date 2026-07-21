export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderInvoicePdf } from '@/lib/pdf/render';
import { canAccessBeleg, getBillerSettings } from '@/lib/access';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params?.id ?? '0');
    if (!(await canAccessBeleg('invoice', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, items: true },
    });
    if (!invoice) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });

    const settings = await getBillerSettings(invoice?.customer?.ownerId);

    const pdfBuffer = await renderInvoicePdf(invoice, settings);

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
