export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';
import { encryptUser } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';

/**
 * PUT: Mitarbeiter aktualisiert eigene Profildaten waehrend des Onboardings (Punkt 11).
 *
 * Eingeschraenkter Schreibzugriff auf die eigenen Felder (kein Rollen-/
 * Status-Wechsel moeglich). Sensible Felder (IBAN, SV-Nr, Steuer-ID)
 * werden verschluesselt.
 */
export async function PUT(request: Request) {
  try {
    const access = await getAccessForCurrentUser();
    if (!access) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const s = (v: any) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));

    const data: any = {};

    // Kontaktdaten
    if (body.name !== undefined) data.name = s(body.name);
    if (body.contactStreet !== undefined) data.contactStreet = s(body.contactStreet);
    if (body.contactZip !== undefined) data.contactZip = s(body.contactZip);
    if (body.contactCity !== undefined) data.contactCity = s(body.contactCity);
    if (body.contactPhone !== undefined) data.contactPhone = s(body.contactPhone);
    if (body.personalEmail !== undefined) data.personalEmail = s(body.personalEmail);

    // Geburt / Notfall
    if (body.birthDate !== undefined) {
      const d = body.birthDate ? new Date(body.birthDate) : null;
      data.birthDate = d && !isNaN(d.getTime()) ? d : null;
    }
    if (body.birthPlace !== undefined) data.birthPlace = s(body.birthPlace);
    if (body.nationality !== undefined) data.nationality = s(body.nationality);
    if (body.emergencyContact !== undefined) data.emergencyContact = s(body.emergencyContact);
    if (body.emergencyPhone !== undefined) data.emergencyPhone = s(body.emergencyPhone);

    // Steuer / SV (sensibel -> verschluesselt)
    if (body.iban !== undefined) data.iban = s(body.iban);
    if (body.taxId !== undefined) data.taxId = s(body.taxId);
    if (body.socialSecurityNo !== undefined) data.socialSecurityNo = s(body.socialSecurityNo);
    if (body.healthInsurance !== undefined) data.healthInsurance = s(body.healthInsurance);
    if (body.maritalStatus !== undefined) data.maritalStatus = s(body.maritalStatus);
    if (body.religion !== undefined) data.religion = s(body.religion);
    if (body.taxClass !== undefined) data.taxClass = s(body.taxClass);

    // Vertragsunterschrift (Base64 PNG)
    if (body.contractSignature !== undefined) {
      data.contractSignature = s(body.contractSignature);
      if (data.contractSignature) data.contractSignedAt = new Date();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Keine Daten zum Speichern.' }, { status: 400 });
    }

    const updated = await prisma.appUser.update({
      where: { id: access.id },
      data: encryptUser(data),
    });

    await logAudit({
      action: 'SELF_ONBOARDING',
      entity: 'USER',
      entityId: access.id,
      summary: `${updated.name || updated.email} hat Onboarding-Daten aktualisiert`,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('self-onboarding PUT:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
