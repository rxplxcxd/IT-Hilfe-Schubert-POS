/**
 * Zentrale, schoen gestaltete HTML-E-Mail-Vorlagen (Resend).
 * Blau-Theme passend zur App (#1e40af).
 */

const BRAND = '#1e40af';
const BRAND_DARK = '#1e3a8a';
const BG = '#f1f5f9';

function layout(title: string, inner: string, footer: string) {
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:linear-gradient(135deg,${BRAND},${BRAND_DARK});border-radius:18px 18px 0 0;padding:32px 28px;text-align:center;">
      <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#bfdbfe;font-weight:600;">IT-Hilfe Schubert</div>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:700;">${title}</h1>
    </div>
    <div style="background:#ffffff;padding:32px 28px;border-radius:0 0 18px 18px;box-shadow:0 10px 25px rgba(15,23,42,0.06);">
      ${inner}
    </div>
    <div style="text-align:center;color:#94a3b8;font-size:12px;padding:20px 8px;line-height:1.6;">
      ${footer}
    </div>
  </div>
</body></html>`;
}

function infoRow(label: string, value: string) {
  if (!value) return '';
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;width:38%;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:600;">${value}</td>
  </tr>`;
}

function formatDate(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
}

export interface AppointmentEmailData {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address?: string;
  description?: string;
  date: string | Date;
  startTime: string;
  endTime: string;
  companyName?: string;
  ownerName?: string;
  phone?: string;
}

/** Bestaetigung an den Kunden */
export function appointmentCustomerHtml(d: AppointmentEmailData) {
  const company = d.companyName || 'IT-Hilfe Schubert';
  const inner = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hallo <strong>${d.customerName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">vielen Dank fuer Ihre Terminanfrage! Wir haben Ihren Wunschtermin erhalten und melden uns in Kuerze zur Bestaetigung bei Ihnen.</p>
    <div style="background:#eff6ff;border:1px solid #dbeafe;border-radius:14px;padding:20px 22px;margin:0 0 20px;">
      <div style="font-size:13px;color:${BRAND};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Ihr Termin</div>
      <table style="width:100%;border-collapse:collapse;">
        ${infoRow('Datum', formatDate(d.date))}
        ${infoRow('Uhrzeit', `${d.startTime} - ${d.endTime} Uhr`)}
        ${infoRow('Adresse', d.address || '')}
        ${infoRow('Anliegen', d.description || '')}
      </table>
    </div>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#334155;">Falls Sie Fragen haben oder den Termin aendern moechten, erreichen Sie uns${d.phone ? ` telefonisch unter <strong>${d.phone}</strong>` : ''}.</p>
    <p style="margin:20px 0 0;font-size:15px;line-height:1.6;">Herzliche Gruesse<br><strong>${d.ownerName || 'Leon Schubert'}</strong><br>${company}</p>`;
  return layout('Terminanfrage erhalten', inner, `Diese E-Mail wurde automatisch von ${company} gesendet.`);
}

/** Benachrichtigung an den Admin/Inhaber */
export function appointmentAdminHtml(d: AppointmentEmailData) {
  const inner = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;"><strong>Neue Terminbuchung eingegangen!</strong></p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;margin:0 0 12px;">
      <div style="font-size:13px;color:${BRAND};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Termindetails</div>
      <table style="width:100%;border-collapse:collapse;">
        ${infoRow('Datum', formatDate(d.date))}
        ${infoRow('Uhrzeit', `${d.startTime} - ${d.endTime} Uhr`)}
      </table>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;">
      <div style="font-size:13px;color:${BRAND};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Kunde</div>
      <table style="width:100%;border-collapse:collapse;">
        ${infoRow('Name', d.customerName)}
        ${infoRow('Telefon', d.customerPhone)}
        ${infoRow('E-Mail', d.customerEmail || '')}
        ${infoRow('Adresse', d.address || '')}
        ${infoRow('Anliegen', d.description || '')}
      </table>
    </div>`;
  return layout('Neue Terminbuchung', inner, 'Automatische Benachrichtigung aus Ihrem POS-System.');
}

export interface AdminUserEmailData {
  name: string;
  email: string;
}

/** Info an Inhaber: neuer Admin-User registriert */
export function newAdminUserHtml(d: AdminUserEmailData) {
  const inner = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;"><strong>Ein neuer Benutzer hat sich registriert.</strong></p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;">
      <table style="width:100%;border-collapse:collapse;">
        ${infoRow('Name', d.name)}
        ${infoRow('E-Mail', d.email)}
      </table>
    </div>
    <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#334155;">Bitte pruefen Sie, ob dieser Zugriff berechtigt ist.</p>`;
  return layout('Neuer Benutzer', inner, 'Automatische Benachrichtigung aus Ihrem POS-System.');
}

/** Info an den Mitarbeiter: Zugang wurde freigeschaltet */
export function accessApprovedHtml(d: { name?: string }) {
  const inner = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hallo <strong>${d.name || ''}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">gute Nachrichten! Dein Zugang zum Kassensystem von <strong>IT-Hilfe Schubert</strong> wurde soeben vom Administrator freigeschaltet.</p>
    <div style="background:#ecfdf5;border:1px solid #d1fae5;border-radius:14px;padding:20px 22px;margin:0 0 20px;">
      <div style="font-size:13px;color:#059669;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Zugang aktiv</div>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#065f46;">Du kannst dich ab sofort mit deiner E-Mail-Adresse und deinem Passwort anmelden.</p>
    </div>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">Viel Erfolg und gutes Gelingen!</p>`;
  return layout('Zugang freigeschaltet', inner, 'Automatische Benachrichtigung aus dem POS-System von IT-Hilfe Schubert.');
}

export interface NewTicketEmailData {
  ticketNumber: string;
  subject: string;
  employeeName: string;
  priority: string;
  description: string;
}

/** Info an den Admin: neues Support-Ticket eines Mitarbeiters */
export function newTicketAdminHtml(d: NewTicketEmailData) {
  const prioColor = d.priority === 'HOCH' ? '#dc2626' : d.priority === 'NIEDRIG' ? '#64748b' : '#2563eb';
  const inner = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;"><strong>${d.employeeName || 'Ein Mitarbeiter'}</strong> hat ein neues Support-Ticket erstellt.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;">
      <table style="width:100%;border-collapse:collapse;">
        ${infoRow('Ticket-Nr.', d.ticketNumber)}
        ${infoRow('Betreff', d.subject)}
        ${infoRow('Mitarbeiter', d.employeeName)}
        ${infoRow('Priorität', `<span style="color:${prioColor};font-weight:700;">${d.priority}</span>`)}
      </table>
    </div>
    ${d.description ? `<div style="margin:18px 0 0;padding:16px 18px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;font-size:14px;line-height:1.6;color:#334155;white-space:pre-wrap;">${d.description}</div>` : ''}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#334155;">Bitte im Ticketsystem bearbeiten.</p>`;
  return layout('Neues Ticket', inner, 'Automatische Benachrichtigung aus dem POS-System von IT-Hilfe Schubert.');
}

export interface TicketReplyEmailData {
  ticketNumber: string;
  subject: string;
  authorName: string;
  body: string;
}

/** Info an die Gegenseite: neue Antwort in einem Ticket */
export function ticketReplyHtml(d: TicketReplyEmailData) {
  const inner = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Neue Antwort im Ticket <strong>${d.ticketNumber}</strong>.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;">
      <table style="width:100%;border-collapse:collapse;">
        ${infoRow('Betreff', d.subject)}
        ${infoRow('Von', d.authorName)}
      </table>
    </div>
    <div style="margin:18px 0 0;padding:16px 18px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;font-size:14px;line-height:1.6;color:#334155;white-space:pre-wrap;">${d.body}</div>`;
  return layout('Neue Antwort', inner, 'Automatische Benachrichtigung aus dem POS-System von IT-Hilfe Schubert.');
}

export interface TicketDeadlineReminderData {
  ticketNumber: string;
  subject: string;
  employeeName?: string;
  dueDate: string | Date;
  /** 'soon3' | 'soon1' | 'hour1' | 'overdue' */
  stage: 'soon3' | 'soon1' | 'hour1' | 'overdue';
}

/** Erinnerung an eine gesetzte Ticket-Frist */
export function ticketDeadlineReminderHtml(d: TicketDeadlineReminderData) {
  const due = new Date(d.dueDate);
  const dueStr = due.toLocaleString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

  const stageMap: Record<string, { headline: string; intro: string; accent: string; badge: string }> = {
    soon3: {
      headline: 'Noch 3 Tage bis zur Frist',
      intro: 'ein kleiner Hinweis vorab: Für dieses Ticket läuft in drei Tagen die gesetzte Frist ab. Genug Zeit, um es in Ruhe abzuschließen.',
      accent: '#2563eb',
      badge: 'Noch 3 Tage',
    },
    soon1: {
      headline: 'Noch 1 Tag bis zur Frist',
      intro: 'morgen ist es soweit: Die Frist für dieses Ticket läuft in einem Tag ab. Am besten heute noch einen Blick darauf werfen.',
      accent: '#d97706',
      badge: 'Noch 1 Tag',
    },
    hour1: {
      headline: 'Nur noch etwa 1 Stunde',
      intro: 'jetzt wird es knapp: Die Frist für dieses Ticket läuft in ungefähr einer Stunde ab. Bitte kümmere dich zeitnah darum.',
      accent: '#dc2626',
      badge: 'Noch 1 Stunde',
    },
    overdue: {
      headline: 'Frist überschritten',
      intro: 'die gesetzte Frist für dieses Ticket ist inzwischen abgelaufen. Bitte schau es dir so schnell wie möglich an und schließe es ab.',
      accent: '#b91c1c',
      badge: 'Überfällig',
    },
  };
  const s = stageMap[d.stage] || stageMap.soon3;

  const inner = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hallo${d.employeeName ? ' ' + d.employeeName : ''},</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155;">${s.intro}</p>
    <div style="text-align:center;margin:0 0 20px;">
      <span style="display:inline-block;background:${s.accent};color:#ffffff;font-weight:700;font-size:13px;letter-spacing:0.5px;padding:8px 16px;border-radius:999px;">${s.badge}</span>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;">
      <table style="width:100%;border-collapse:collapse;">
        ${infoRow('Ticket', d.ticketNumber)}
        ${infoRow('Betreff', d.subject)}
        ${infoRow('Frist', dueStr)}
      </table>
    </div>
    <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#334155;">Du findest das Ticket direkt im Ticketsystem der App.</p>`;
  return layout(s.headline, inner, 'Automatische Frist-Erinnerung aus dem POS-System von IT-Hilfe Schubert.');
}
