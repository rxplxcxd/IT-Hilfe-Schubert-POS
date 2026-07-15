import { Resend } from 'resend';

/**
 * Zentraler E-Mail-Versand ueber Resend.
 * API-Key & Absender kommen aus den Umgebungsvariablen.
 */

const resendApiKey = process.env.RESEND_API_KEY || '';
const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail({ to, subject, html, replyTo, attachments }: SendEmailOptions) {
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY ist nicht gesetzt');
  }

  const resend = new Resend(resendApiKey);

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [to],
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(attachments && attachments.length
      ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })) }
      : {}),
  } as any);

  if (error) {
    throw new Error(typeof error === 'string' ? error : error.message || 'E-Mail-Versand fehlgeschlagen');
  }

  return data;
}
