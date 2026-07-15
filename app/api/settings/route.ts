export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 1,
          companyName: 'IT-Hilfe Schubert',
          ownerName: 'Leon Schubert',
          taxInfo: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
        },
      });
    }
    // Transform for client
    return NextResponse.json({
      companyName: settings?.companyName ?? '',
      ownerName: settings?.ownerName ?? '',
      street: settings?.street ?? '',
      zip: settings?.zip ?? '',
      city: settings?.city ?? '',
      phone: settings?.phone ?? '',
      email: settings?.email ?? '',
      taxInfo: settings?.taxInfo ?? '',
      invoiceHeader: settings?.invoiceHeader ?? '',
      logoUrl: settings?.logoPath ?? '',
      resendApiKey: settings?.resendApiKey ?? '',
      bankName: settings?.bankName ?? '',
      iban: settings?.iban ?? '',
      bic: settings?.bic ?? '',
      googleClientId: settings?.googleClientId ?? '',
      googleClientSecret: settings?.googleClientSecret ? '••••••••' : '',
      disclaimerDefaultText: (settings as any)?.disclaimerDefaultText ?? '',
      hqStreet: (settings as any)?.hqStreet ?? 'Alte Schulstr 4',
      hqZip: (settings as any)?.hqZip ?? '02694',
      hqCity: (settings as any)?.hqCity ?? 'Malschwitz',
    });
  } catch (error: any) {
    console.error('Settings GET error:', error);
    return NextResponse.json(null, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {
        companyName: data?.companyName ?? 'IT-Hilfe Schubert',
        ownerName: data?.ownerName ?? 'Leon Schubert',
        street: data?.street ?? '',
        zip: data?.zip ?? '',
        city: data?.city ?? '',
        phone: data?.phone ?? '',
        email: data?.email ?? '',
        taxInfo: data?.taxInfo ?? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
        invoiceHeader: data?.invoiceHeader ?? '',
        logoPath: data?.logoUrl ?? '',
        resendApiKey: data?.resendApiKey ?? '',
        bankName: data?.bankName ?? '',
        iban: data?.iban ?? '',
        bic: data?.bic ?? '',
        ...(data?.googleClientId !== undefined ? { googleClientId: data.googleClientId } : {}),
        ...(data?.googleClientSecret && !data.googleClientSecret.includes('••') ? { googleClientSecret: data.googleClientSecret } : {}),
        ...(data?.disclaimerDefaultText !== undefined ? { disclaimerDefaultText: data.disclaimerDefaultText } : {}),
        ...(data?.hqStreet !== undefined ? { hqStreet: data.hqStreet } : {}),
        ...(data?.hqZip !== undefined ? { hqZip: data.hqZip } : {}),
        ...(data?.hqCity !== undefined ? { hqCity: data.hqCity } : {}),
      },
      create: {
        id: 1,
        companyName: data?.companyName ?? 'IT-Hilfe Schubert',
        ownerName: data?.ownerName ?? 'Leon Schubert',
        street: data?.street ?? '',
        zip: data?.zip ?? '',
        city: data?.city ?? '',
        phone: data?.phone ?? '',
        email: data?.email ?? '',
        taxInfo: data?.taxInfo ?? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
        invoiceHeader: data?.invoiceHeader ?? '',
        logoPath: data?.logoUrl ?? '',
        resendApiKey: data?.resendApiKey ?? '',
        bankName: data?.bankName ?? '',
        iban: data?.iban ?? '',
        bic: data?.bic ?? '',
        googleClientId: data?.googleClientId ?? '',
        googleClientSecret: data?.googleClientSecret ?? '',
        disclaimerDefaultText: data?.disclaimerDefaultText ?? '',
        hqStreet: data?.hqStreet ?? 'Alte Schulstr 4',
        hqZip: data?.hqZip ?? '02694',
        hqCity: data?.hqCity ?? 'Malschwitz',
      },
    });

    // Update env vars for Gmail API if credentials provided
    if (data?.googleClientId) process.env.GOOGLE_GMAIL_CLIENT_ID = data.googleClientId;
    const updatedSettings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (updatedSettings?.googleClientSecret) process.env.GOOGLE_GMAIL_CLIENT_SECRET = updatedSettings.googleClientSecret;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Settings PUT error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
