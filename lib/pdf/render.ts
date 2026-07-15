import { createElement } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoiceDocument } from '@/lib/pdf/InvoiceDocument';
import { OrderDocument } from '@/lib/pdf/OrderDocument';

/**
 * Zentrale PDF-Rendering-Helfer.
 * Die `as any` Casts sind noetig, weil die react-pdf Typen
 * mit dem strengen TypeScript-Build von Next.js kollidieren.
 */

export async function renderInvoicePdf(invoice: any, settings: any): Promise<Buffer> {
  return renderToBuffer(
    createElement(InvoiceDocument as any, { invoice, settings }) as any
  );
}

export async function renderOrderPdf(order: any, settings: any): Promise<Buffer> {
  return renderToBuffer(
    createElement(OrderDocument as any, { order, settings: settings || {} }) as any
  );
}
