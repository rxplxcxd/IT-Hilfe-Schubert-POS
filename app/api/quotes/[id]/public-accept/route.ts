export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function formatCurrency(n: number) {
  return n.toFixed(2).replace('.', ',') + ' €';
}

function renderPage(content: string) {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Angebot - IT-Hilfe Schubert</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f4ff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { max-width: 540px; width: 100%; background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); padding: 40px 32px; }
    h2 { color: #1e40af; font-size: 22px; margin-bottom: 8px; }
    .subtitle { color: #64748b; margin-bottom: 24px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-size: 13px; color: #475569; }
    th:last-child { text-align: right; }
    td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    td:last-child { text-align: right; }
    .total-row { font-weight: bold; border-top: 2px solid #1e40af; }
    .total-row td { padding-top: 12px; }
    .tax-info { color: #94a3b8; font-size: 12px; margin: 8px 0 24px; }
    .accept-btn { display: block; width: 100%; padding: 16px; background: #16a34a; color: white; border: none; border-radius: 10px; font-size: 17px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
    .accept-btn:hover { background: #15803d; }
    .accept-btn:disabled { background: #94a3b8; cursor: wait; }
    .success { color: #16a34a; }
    .error { color: #dc2626; }
    .footer { margin-top: 24px; color: #94a3b8; font-size: 12px; text-align: center; }
    .valid { color: #94a3b8; font-size: 13px; margin-bottom: 20px; }
    .status-msg { text-align: center; padding: 20px 0; }
    .status-msg h3 { font-size: 20px; margin-bottom: 8px; }
    .status-msg p { color: #64748b; font-size: 14px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">${content}</div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// GET: Show the quote details with an accept button
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const quoteId = parseInt(params.id);
    if (isNaN(quoteId)) return renderPage('<div class="status-msg"><h3 class="error">Ungültiger Link</h3></div>');

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { items: true, customer: true },
    });

    if (!quote) {
      return renderPage('<div class="status-msg"><h3 class="error">Angebot nicht gefunden</h3><p>Dieses Angebot existiert nicht oder wurde gelöscht.</p></div>');
    }

    if (quote.status === 'ANGENOMMEN') {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      return renderPage(`
        <div class="status-msg">
          <h3 class="success">✅ Bereits angenommen</h3>
          <p>Dieses Angebot wurde bereits erfolgreich angenommen.<br/>Wir melden uns in Kürze bei Ihnen, um einen Termin zu vereinbaren.</p>
          <p style="margin-top:16px">Mit freundlichen Grüßen,<br/><strong>${settings?.companyName || 'IT-Hilfe Schubert'}</strong></p>
        </div>
      `);
    }

    // Build items table
    const itemRows = quote.items.map(i =>
      `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}x</td><td>${formatCurrency(i.total)}</td></tr>`
    ).join('');

    const validUntil = quote.validUntil
      ? new Date(quote.validUntil).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : null;

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });

    return renderPage(`
      <h2>Angebot ${quote.quoteNumber}</h2>
      <p class="subtitle">für ${quote.customer.firstName} ${quote.customer.lastName}</p>

      <table>
        <thead><tr><th>Position</th><th style="text-align:center">Menge</th><th style="text-align:right">Betrag</th></tr></thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          ${quote.discount > 0 ? `<tr><td colspan="2" style="text-align:right;color:#64748b">Rabatt:</td><td>-${formatCurrency(quote.discount)}</td></tr>` : ''}
          ${quote.travelCost > 0 ? `<tr><td colspan="2" style="text-align:right;color:#64748b">Anfahrt:</td><td>${formatCurrency(quote.travelCost)}</td></tr>` : ''}
          <tr class="total-row"><td colspan="2" style="text-align:right">Gesamt:</td><td>${formatCurrency(quote.total)}</td></tr>
        </tfoot>
      </table>

      <p class="tax-info">${settings?.taxInfo || 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'}</p>

      ${validUntil ? `<p class="valid">Gültig bis: ${validUntil}</p>` : ''}

      <button class="accept-btn" id="acceptBtn" onclick="acceptQuote()">✅ Angebot annehmen</button>
      <p id="statusText" style="text-align:center;margin-top:12px;font-size:14px;display:none"></p>

      <div class="footer">
        <p>${settings?.companyName || 'IT-Hilfe Schubert'}</p>
      </div>

      <script>
        async function acceptQuote() {
          var btn = document.getElementById('acceptBtn');
          var statusText = document.getElementById('statusText');
          btn.disabled = true;
          btn.textContent = 'Wird verarbeitet...';
          statusText.style.display = 'none';

          try {
            var res = await fetch(window.location.href, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            var data = await res.json();

            if (res.ok && data.success) {
              btn.style.background = '#16a34a';
              btn.textContent = '✅ Angenommen!';
              statusText.style.display = 'block';
              statusText.style.color = '#16a34a';
              statusText.innerHTML = 'Vielen Dank! Rechnung <strong>' + data.invoiceNumber + '</strong> wurde erstellt.<br/>Wir melden uns in Kürze bei Ihnen.';
            } else {
              throw new Error(data.error || 'Fehler');
            }
          } catch(e) {
            btn.disabled = false;
            btn.textContent = '✅ Angebot annehmen';
            statusText.style.display = 'block';
            statusText.style.color = '#dc2626';
            statusText.textContent = 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
          }
        }
      </script>
    `);
  } catch (error: any) {
    console.error('Quote public-accept GET error:', error);
    return renderPage('<div class="status-msg"><h3 class="error">Ein Fehler ist aufgetreten</h3><p>Bitte kontaktieren Sie uns direkt.</p></div>');
  }
}

// POST: Actually accept the quote and create the invoice
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const quoteId = parseInt(params.id);
    if (isNaN(quoteId)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { items: true, customer: true },
    });

    if (!quote) return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 });

    if (quote.status === 'ANGENOMMEN') {
      return NextResponse.json({ success: true, alreadyAccepted: true, message: 'Bereits angenommen' });
    }

    // Use the same case number from the quote
    const { getCaseSubNumbers } = await import('@/lib/case-number');
    const caseNumber = quote.caseNumber;
    const { invoiceNumber } = getCaseSubNumbers(caseNumber);

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

    await prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'ANGENOMMEN', acceptedAt: new Date(), convertedInvoiceId: invoice.id },
    });

    return NextResponse.json({ success: true, invoiceNumber });
  } catch (error: any) {
    console.error('Quote public-accept POST error:', error);
    return NextResponse.json({ error: 'Ein Fehler ist aufgetreten' }, { status: 500 });
  }
}
