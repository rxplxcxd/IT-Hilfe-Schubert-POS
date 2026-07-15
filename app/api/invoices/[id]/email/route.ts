export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatCurrency } from '@/lib/utils';
import { sendEmail } from '@/lib/email';

function formatDateDE(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params?.id ?? '0');
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, items: true },
    });
    if (!invoice) return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 });

    const customerEmail = invoice?.customer?.email ?? '';
    if (!customerEmail.trim()) {
      return NextResponse.json({ error: 'Kunde hat keine E-Mail-Adresse' }, { status: 400 });
    }

    const settings = await prisma.settings.findUnique({ where: { id: 1 } }) ?? {
      companyName: 'IT-Hilfe Schubert', ownerName: 'Leon Schubert',
      taxInfo: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
      bankName: '', iban: '', bic: '',
    } as any;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">${settings?.companyName ?? 'IT-Hilfe Schubert'}</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Rechnung ${invoice?.invoiceNumber ?? ''}</p>
        </div>
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb;">
          <p>Sehr geehrte/r ${invoice?.customer?.firstName ?? ''} ${invoice?.customer?.lastName ?? ''},</p>
          <p>anbei erhalten Sie Ihre Rechnung <strong>${invoice?.invoiceNumber ?? ''}</strong> vom ${formatDateDE(invoice?.createdAt)}.</p>

          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e5e7eb;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #1e40af;">
                  <th style="text-align: left; padding: 5px; font-size: 12px;">Position</th>
                  <th style="text-align: right; padding: 5px; font-size: 12px;">Betrag</th>
                </tr>
              </thead>
              <tbody>
                ${(invoice?.items ?? []).map((item: any) => `
                  <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 5px; font-size: 12px;">${item?.quantity ?? 0}x ${item?.name ?? ''}</td>
                    <td style="text-align: right; padding: 5px; font-size: 12px;">${formatCurrency((item?.unitPrice ?? 0) * (item?.quantity ?? 0))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${(invoice?.travelCost ?? 0) > 0 ? `<p style="font-size: 12px; margin: 5px 0;">Anfahrt: ${formatCurrency(invoice.travelCost)}</p>` : ''}
            ${(invoice?.discount ?? 0) > 0 ? `<p style="font-size: 12px; margin: 5px 0; color: #16a34a;">Rabatt: -${formatCurrency(invoice.discount)}</p>` : ''}
            <p style="font-size: 16px; font-weight: bold; border-top: 2px solid #1e40af; padding-top: 8px; margin-top: 8px; color: #1e40af;">
              Gesamtbetrag: ${formatCurrency(invoice?.total ?? 0)}
            </p>
          </div>

          <p style="font-size: 11px; color: #666; background: #f0f4ff; padding: 10px; border-radius: 4px;">
            ${settings?.taxInfo ?? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'}
          </p>

          ${(settings?.iban ?? '').trim() ? `
          <div style="margin-top: 15px; font-size: 11px; color: #666;">
            <p><strong>Bankverbindung:</strong></p>
            <p>${settings?.bankName ?? ''} | IBAN: ${settings?.iban ?? ''} ${(settings?.bic ?? '').trim() ? `| BIC: ${settings.bic}` : ''}</p>
          </div>` : ''}

          <p style="margin-top: 15px;">Mit freundlichen Grüßen,<br><strong>${settings?.ownerName ?? 'Leon Schubert'}</strong><br>${settings?.companyName ?? 'IT-Hilfe Schubert'}</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: customerEmail,
      subject: `Rechnung ${invoice?.invoiceNumber ?? ''} - ${settings?.companyName ?? 'IT-Hilfe Schubert'}`,
      html: htmlBody,
    });

    await prisma.invoice.update({
      where: { id },
      data: { emailSentAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Email send error:', error);
    return NextResponse.json({ error: error?.message ?? 'E-Mail-Fehler' }, { status: 500 });
  }
}
