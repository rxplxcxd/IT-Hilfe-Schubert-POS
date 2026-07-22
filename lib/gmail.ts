import { google } from 'googleapis';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * Ermittelt den absoluten Origin (Protokoll + Host) der App.
 *
 * WICHTIG fuer OAuth: Google verlangt eine ABSOLUTE redirect_uri. Frueher
 * wurde nur NEXT_PUBLIC_APP_URL benutzt - war die Variable leer, entstand der
 * relative Pfad "/api/gmail/callback", was Google mit "invalid_request"
 * ablehnt. Wir leiten den Origin daher primaer aus den Request-Headern ab
 * (funktioniert auf Vercel hinter dem Proxy zuverlaessig) und fallen nur
 * ersatzweise auf die ENV-Variablen zurueck.
 */
function originFromHeaders(): string {
  try {
    const h = headers();
    const host = h.get('x-forwarded-host') || h.get('host') || '';
    if (!host) return '';
    const proto = h.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    return proto + '://' + host;
  } catch {
    return '';
  }
}

/** Absoluter App-Origin ohne abschliessenden Slash. */
export function getAppOrigin(): string {
  const fromHeaders = originFromHeaders().replace(/\/$/, '');
  if (fromHeaders) return fromHeaders;
  const envUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  return envUrl;
}

/**
 * Zentrale Helfer fuer die pro-Mitarbeiter Gmail-Anbindung.
 *
 * Jeder Mitarbeiter verbindet sein EIGENES Gmail-Konto. Die Firmen-Mails
 * werden per Weiterleitung (ImprovMX) von prefix@<mailDomain> an das private
 * Gmail des Mitarbeiters zugestellt. In der App sieht jeder Mitarbeiter nur
 * seine eigenen Firmen-Mails (gefiltert nach seiner Firmen-Adresse).
 */

export interface OAuthCreds {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Die exakte redirect_uri, die an Google gesendet und dort registriert werden
 * muss. Reihenfolge (deterministisch zuerst):
 *   1. GMAIL_REDIRECT_URI  (vollstaendige URL als harter Override)
 *   2. NEXT_PUBLIC_APP_URL / NEXTAUTH_URL  (+ /api/gmail/callback)
 *   3. Request-Origin aus den Headern  (+ /api/gmail/callback)
 * So kann der Wert per ENV fest verdrahtet werden und stimmt immer
 * zeichengenau mit der Google-Registrierung ueberein.
 */
export function getGmailRedirectUri(): string {
  const override = (process.env.GMAIL_REDIRECT_URI || '').trim().replace(/\/$/, '');
  if (override) return override;
  const env = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').trim().replace(/\/$/, '');
  if (env) return env + '/api/gmail/callback';
  const base = getAppOrigin().replace(/\/$/, '');
  return base + '/api/gmail/callback';
}

/** Laedt Client-ID/Secret aus ENV, faellt auf die Settings-Tabelle zurueck. */
export async function getOAuthCreds(): Promise<OAuthCreds | null> {
  let clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    clientId = clientId || settings?.googleClientId || '';
    clientSecret = clientSecret || settings?.googleClientSecret || '';
  }
  if (!clientId || !clientSecret) return null;
  const redirectUri = getGmailRedirectUri();
  return { clientId, clientSecret, redirectUri };
}

/** Erstellt einen frischen OAuth2-Client (ohne gesetzte Credentials). */
export async function buildOAuthClient() {
  const creds = await getOAuthCreds();
  if (!creds) return null;
  return new google.auth.OAuth2(creds.clientId, creds.clientSecret, creds.redirectUri);
}

/** Token-Datensatz eines Mitarbeiters (per userId). */
export async function getUserToken(userId: number) {
  return prisma.gmailToken.findUnique({ where: { userId } });
}

/**
 * Liefert einen authentifizierten OAuth2-Client fuer den Mitarbeiter oder
 * null, wenn (noch) kein gueltiges Token vorliegt.
 */
export async function getAuthedClientForUser(userId: number) {
  const token = await getUserToken(userId);
  if (!token?.refreshToken) return null;
  const client = await buildOAuthClient();
  if (!client) return null;
  client.setCredentials({
    refresh_token: token.refreshToken,
    access_token: token.accessToken || undefined,
  });
  return client;
}

/** Firmen-Adresse eines Mitarbeiters: prefix@mailDomain (oder null). */
export function companyAddress(prefix: string | null | undefined, domain: string): string | null {
  const p = (prefix || '').trim().toLowerCase();
  const d = (domain || '').trim().toLowerCase();
  if (!p || !d) return null;
  return p + '@' + d;
}

/**
 * Baut den Gmail-Suchfilter, damit ein Mitarbeiter NUR seine Firmen-Mails
 * sieht. Da die Mails per ImprovMX weitergeleitet werden, greifen wir auf
 * mehrere Empfaenger-Header zu (to/deliveredto/cc).
 */
export function companyInboxQuery(address: string | null, userSearch?: string): string | undefined {
  const parts: string[] = [];
  if (address) {
    parts.push(`(to:${address} OR deliveredto:${address} OR cc:${address})`);
  }
  if (userSearch && userSearch.trim()) {
    parts.push(`(${userSearch.trim()})`);
  }
  return parts.length ? parts.join(' ') : undefined;
}
