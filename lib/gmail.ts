import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

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
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const redirectUri = base + '/api/gmail/callback';
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
