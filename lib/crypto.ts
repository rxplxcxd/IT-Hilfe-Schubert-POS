import crypto from 'crypto';

/**
 * Transparente Feldverschluesselung fuer sensible Daten (Punkt 59).
 *
 * - AES-256-GCM (authentifiziert), Schluessel aus APP_ENC_KEY bzw. ersatzweise
 *   NEXTAUTH_SECRET abgeleitet (SHA-256 -> 32 Byte).
 * - Verschluesselte Werte tragen das Praefix "enc::". Alles ohne dieses Praefix
 *   gilt als Klartext (Altbestand) und wird unveraendert zurueckgegeben
 *   -> keine Migration noetig, kein Datenverlust.
 * - Schlaegt eine Operation fehl, wird lieber der Eingabewert zurueckgegeben
 *   als ein Fehler geworfen (Robustheit vor Perfektion).
 */

const MARKER = 'enc::';

function getKey(): Buffer {
  const secret =
    process.env.APP_ENC_KEY ||
    process.env.NEXTAUTH_SECRET ||
    'ithilfe-schubert-fallback-key-bitte-APP_ENC_KEY-setzen';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encrypt(plain: string | null | undefined): string {
  const text = plain == null ? '' : String(plain);
  if (text === '') return '';
  if (text.startsWith(MARKER)) return text; // schon verschluesselt
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return MARKER + Buffer.concat([iv, tag, enc]).toString('base64');
  } catch {
    return text;
  }
}

export function decrypt(value: string | null | undefined): string {
  const text = value == null ? '' : String(value);
  if (!text.startsWith(MARKER)) return text; // Klartext / Altbestand
  try {
    const raw = Buffer.from(text.slice(MARKER.length), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return text;
  }
}

function encryptFields<T extends Record<string, any>>(data: T, fields: readonly string[]): T {
  const out: any = { ...data };
  for (const f of fields) {
    if (out[f] !== undefined && out[f] !== null && out[f] !== '') out[f] = encrypt(String(out[f]));
  }
  return out;
}

function decryptFields<T extends Record<string, any>>(data: T, fields: readonly string[]): T {
  if (!data) return data;
  const out: any = { ...data };
  for (const f of fields) {
    if (out[f] !== undefined && out[f] !== null) out[f] = decrypt(String(out[f]));
  }
  return out;
}

// Sensible Mitarbeiterfelder (Personalakte)
const USER_SENSITIVE = ['iban', 'socialSecurityNo', 'taxId'] as const;
// Sensible Geraetefelder (Kunden-Geraeteinventar)
const DEVICE_SENSITIVE = ['password', 'wifiPassword'] as const;

export function encryptUser<T extends Record<string, any>>(d: T): T {
  return encryptFields(d, USER_SENSITIVE);
}
export function decryptUser<T extends Record<string, any>>(d: T): T {
  return decryptFields(d, USER_SENSITIVE);
}
export function encryptDevice<T extends Record<string, any>>(d: T): T {
  return encryptFields(d, DEVICE_SENSITIVE);
}
export function decryptDevice<T extends Record<string, any>>(d: T): T {
  return decryptFields(d, DEVICE_SENSITIVE);
}
