export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { renderOrderPdf } from '@/lib/pdf/render';
import { canAccessBeleg, getBillerSettings } from '@/lib/access';

function formatDateDE(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params?.id ?? '0');
    if (!(await canAccessBeleg('order', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const order = await prisma.order.findUnique({
      where: { id },
      include: { customer: true, photos: true },
    });
    if (!order) return NextResponse.json({ error: 'Auftrag nicht gefunden' }, { status: 404 });

    const customerEmail = order?.customer?.email ?? '';
    if (!customerEmail.trim()) {
      return NextResponse.json({ error: 'Kunde hat keine E-Mail-Adresse' }, { status: 400 });
    }

    const settings = await getBillerSettings(order?.customer?.ownerId);

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">${settings?.companyName ?? 'IT-Hilfe Schubert'}</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Auftragsprotokoll ${order?.orderNumber ?? ''}</p>
        </div>
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb;">
          <p>Sehr geehrte/r ${order?.customer?.firstName ?? ''} ${order?.customer?.lastName ?? ''},</p>
          <p>anbei erhalten Sie das Protokoll zu Ihrem Auftrag <strong>${order?.orderNumber ?? ''}</strong>${order?.completedAt ? ` vom ${formatDateDE(order.completedAt)}` : ''}.</p>
          ${order?.title ? `<p style="margin: 10px 0;"><strong>${order.title}</strong></p>` : ''}
          ${order?.completionNotes ? `<div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e5e7eb; font-size: 13px;">${order.completionNotes}</div>` : ''}
          <p style="font-size: 11px; color: #666; background: #f0f4ff; padding: 10px; border-radius: 4px;">
            ${settings?.taxInfo ?? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'}
          </p>
          <p style="margin-top: 15px;">Mit freundlichen Grüßen,<br><strong>${settings?.ownerName ?? 'Leon Schubert'}</strong><br>${settings?.companyName ?? 'IT-Hilfe Schubert'}</p>
        </div>
      </div>
    `;

    let attachments;
    try {
      const pdfBuffer = await renderOrderPdf(order, settings);
      attachments = [{ filename: `${order?.orderNumber ?? 'auftrag'}.pdf`, content: pdfBuffer }];
    } catch (pdfErr) {
      console.error('PDF-Anhang konnte nicht erstellt werden:', pdfErr);
    }

    await sendEmail({
      to: customerEmail,
      subject: `Auftragsprotokoll ${order?.orderNumber ?? ''} - ${settings?.companyName ?? 'IT-Hilfe Schubert'}`,
      html: htmlBody,
      attachments,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Order email send error:', error);
    return NextResponse.json({ error: error?.message ?? 'E-Mail-Fehler' }, { status: 500 });
  }
}
