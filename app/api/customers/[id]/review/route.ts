export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';
import { sendEmail } from '@/lib/email';
import { canAccessCustomer } from '@/lib/access';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await canAccessCustomer(parseInt(params.id)))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const customer = await prisma.customer.findUnique({ where: { id: parseInt(params.id) } });
    if (!customer) return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 });
    if (!customer.email) return NextResponse.json({ error: 'Kunde hat keine E-Mail' }, { status: 400 });

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const reviewLink = 'https://share.google/lsyLcuZ4x45ih4tJ6';

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;text-align:center">
        <h2 style="color:#1e40af">${settings?.companyName || 'IT-Hilfe Schubert'}</h2>
        <p>Liebe/r ${customer.firstName} ${customer.lastName},</p>
        <p>vielen Dank, dass Sie unseren Service in Anspruch genommen haben!</p>
        <p>Wir würden uns sehr über eine kurze Bewertung freuen. Ihr Feedback hilft uns, unseren Service stetig zu verbessern.</p>
        <div style="margin:30px 0">
          <a href="${reviewLink}" style="display:inline-block;padding:14px 32px;background:#f59e0b;color:white;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px">⭐ Jetzt bewerten</a>
        </div>
        <p style="color:#999;font-size:13px">Vielen Dank für Ihr Vertrauen!</p>
        <p>Mit freundlichen Grüßen,<br/><strong>${settings?.ownerName || 'Leon Schubert'}</strong><br/>${settings?.companyName || 'IT-Hilfe Schubert'}</p>
      </div>
    `;

    const subject = `Ihre Meinung zählt! - ${settings?.companyName || 'IT-Hilfe Schubert'}`;

    // Versand via Gmail (falls verbunden), sonst via Resend
    const gmailToken = await prisma.gmailToken.findUnique({ where: { id: 1 } });
    if (gmailToken?.refreshToken) {
      let clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
      let clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        clientId = settings?.googleClientId || '';
        clientSecret = settings?.googleClientSecret || '';
      }
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, `${appUrl}/api/gmail/callback`);
      oauth2Client.setCredentials({ refresh_token: gmailToken.refreshToken, access_token: gmailToken.accessToken });

      const raw = Buffer.from(
        `To: ${customer.email}\r\nFrom: ${gmailToken.email}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${emailHtml}`
      ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    } else {
      await sendEmail({ to: customer.email, subject, html: emailHtml });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Review email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
