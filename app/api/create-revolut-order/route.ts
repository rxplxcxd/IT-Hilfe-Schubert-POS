export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { canAccessBeleg } from '@/lib/access';

/**
 * Erstellt eine Revolut-Merchant-Order fuer eine Rechnung und liefert die
 * checkout_url zurueck. Benoetigt die Umgebungsvariable REVOLUT_SECRET_KEY.
 * Optional REVOLUT_API_URL (Sandbox vs. Produktiv).
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

    const key = process.env.REVOLUT_SECRET_KEY;
    if (!key) {
      return NextResponse.json(
        { error: 'Revolut ist noch nicht konfiguriert (REVOLUT_SECRET_KEY fehlt).' },
        { status: 400 },
      );
    }

    // Basis-URL ueber String-Konkatenation (verhindert URL-Verfälschung)
    const base = (process.env.REVOLUT_API_URL || ('https' + '://merchant.revolut.com')).replace(/\/$/, '');
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
