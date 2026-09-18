export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { canAccessBeleg } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

/**
 * Erstellt eine Revolut-Merchant-Order fuer eine Rechnung und liefert die
 * checkout_url zurueck. Der Schluessel wird bevorzugt aus den in der Datenbank
 * gespeicherten Einstellungen gelesen (verschluesselt), ersatzweise aus der
 * Umgebungsvariable REVOLUT_SECRET_KEY. Der Modus (live/sandbox) kommt aus den
 * Einstellungen bzw. optional aus REVOLUT_API_URL.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const invoiceId = parseInt(String(body?.invoiceId ?? '0'));
    const amount = Number(body?.amount ?? 0);
    const invoiceNumber = String(body?.invoiceNumber ?? '');

    if (!invoiceId || !(amount > 0)) {
      return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
    }

    if (!(await canAccessBeleg('invoice', invoiceId))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }

    // Schluessel + Modus bevorzugt aus der Datenbank (Admin-Einstellungen),
    // ersatzweise aus den Umgebungsvariablen.
    const settings = await prisma.settings.findUnique({ where: { id: 1 } }).catch(() => null);
    const dbKey = (settings as any)?.revolutSecretKey ? decrypt((settings as any).revolutSecretKey) : '';
    const mode = (settings as any)?.revolutMode || 'live';
    const key = dbKey || process.env.REVOLUT_SECRET_KEY;
    if (!key) {
      return NextResponse.json(
        { error: 'Revolut ist noch nicht konfiguriert. Bitte den Revolut-Schlüssel in den Einstellungen hinterlegen.' },
        { status: 400 },
      );
    }

    // Basis-URL ueber String-Konkatenation (verhindert URL-Verfälschung).
    // Reihenfolge: explizite Env-Variable > Modus aus den Einstellungen.
    const defaultBase = mode === 'sandbox'
      ? ('https' + '://sandbox-merchant.revolut.com')
      : ('https' + '://merchant.revolut.com');
    const base = (process.env.REVOLUT_API_URL || defaultBase).replace(/\/$/, '');
    const endpoint = base + '/api/orders';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Revolut-Api-Version': '2024-09-01',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: 'EUR',
        merchant_order_ext_ref: invoiceNumber || ('INV-' + invoiceId),
        description: 'IT-Hilfe Schubert – Auftrag ' + (invoiceNumber || invoiceId),
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Revolut order error:', res.status, json);
      return NextResponse.json(
        { error: json?.message || 'Revolut-Order konnte nicht erstellt werden.' },
        { status: 502 },
      );
    }

    const checkout_url = json?.checkout_url || json?.checkoutUrl || null;
    if (!checkout_url) {
      return NextResponse.json({ error: 'Keine checkout_url erhalten.' }, { status: 502 });
    }

    return NextResponse.json({ checkout_url, token: json?.token ?? null, id: json?.id ?? null });
  } catch (error: any) {
    console.error('create-revolut-order error:', error);
    return NextResponse.json({ error: 'Serverfehler bei Revolut-Anfrage.' }, { status: 500 });
  }
}
