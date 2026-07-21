export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { canAccessBeleg, getBillerSettings } from '@/lib/access';

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
    if (!quote.customer.email) return NextResponse.json({ error: 'Kunde hat keine E-Mail-Adresse' }, { status: 400 });

    const settings = await getBillerSettings(quote?.customer?.ownerId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const acceptUrl = `${appUrl}/api/quotes/${quoteId}/public-accept`;

    const formatCurrency = (n: number) => n.toFixed(2).replace('.', ',') + ' \u20ac';

    const itemRows = quote.items.map((i) =>
      `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(i.total)}</td></tr>`
    ).join('');

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1e40af">Angebot ${quote.quoteNumber}</h2>
        <p>Sehr geehrte/r ${quote.customer.firstName} ${quote.customer.lastName},</p>
        <p>vielen Dank für Ihr Interesse. Hier ist Ihr Angebot:</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <thead><tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Position</th><th style="padding:8px;text-align:center">Menge</th><th style="padding:8px;text-align:right">Betrag</th></tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            ${quote.discount > 0 ? `<tr><td colspan="2" style="padding:8px;text-align:right">Rabatt:</td><td style="padding:8px;text-align:right">-${formatCurrency(quote.discount)}</td></tr>` : ''}
            ${quote.travelCost > 0 ? `<tr><td colspan="2" style="padding:8px;text-align:right">Anfahrt:</td><td style="padding:8px;text-align:right">${formatCurrency(quote.travelCost)}</td></tr>` : ''}
            <tr style="font-weight:bold"><td colspan="2" style="padding:8px;text-align:right;border-top:2px solid #1e40af">Gesamt:</td><td style="padding:8px;text-align:right;border-top:2px solid #1e40af">${formatCurrency(quote.total)}</td></tr>
          </tfoot>
        </table>
        <p style="color:#666;font-size:14px">${settings?.taxInfo || 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'}</p>
        <div style="margin:30px 0;text-align:center">
          <a href="${acceptUrl}" style="display:inline-block;padding:14px 32px;background:#1e40af;color:white;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px">✅ Angebot annehmen</a>
        </div>
        <p style="color:#999;font-size:12px">Gültig bis: ${quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('de-DE') : '14 Tage'}</p>
        <p>Mit freundlichen Grüßen,<br/>${settings?.ownerName || 'IT-Hilfe Schubert'}</p>
      </div>
    `;

    const subject = `Angebot ${quote.quoteNumber} - ${settings?.companyName || 'IT-Hilfe Schubert'}`;

    // Versand via Gmail (falls verbunden), sonst via Resend
    const gmailToken = await prisma.gmailToken.findUnique({ where: { id: 1 } });
    if (gmailToken?.refreshToken) {
      const { google } = await import('googleapis');
      let clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
      let clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        clientId = settings?.googleClientId || '';
        clientSecret = settings?.googleClientSecret || '';
      }
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, `${appUrl}/api/gmail/callback`);
      oauth2Client.setCredentials({ refresh_token: gmailToken.refreshToken, access_token: gmailToken.accessToken });

      const raw = Buffer.from(
        `To: ${quote.customer.email}\r\nFrom: ${gmailToken.email}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${emailHtml}`
      ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    } else {
      await sendEmail({ to: quote.customer.email, subject, html: emailHtml });
    }

    await prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'GESENDET', emailSentAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Quote send error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
