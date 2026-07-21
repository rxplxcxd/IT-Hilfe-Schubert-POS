export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/employees/public?no=2
 * Oeffentliche Mitarbeiter-Daten fuer die Terminbuchungsseite.
 * Gibt Name, Telefon, Stadt zurueck (keine sensiblen Daten).
 * Wenn kein ?no angegeben wird, gibt Admin-/Settings-Daten zurueck (Fallback).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const empNo = searchParams.get('no');

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });

    if (empNo) {
      const no = parseInt(empNo, 10);
      if (isNaN(no)) {
        return NextResponse.json({ error: 'Ungueltige Mitarbeiternummer' }, { status: 400 });
      }
      const emp = await prisma.appUser.findFirst({
        where: { employeeNo: no, status: 'APPROVED' },
        select: {
          name: true,
          contactPhone: true,
          contactCity: true,
          contactStreet: true,
          contactZip: true,
          employeeNo: true,
        },
      });
      if (!emp) {
        return NextResponse.json({ error: 'Mitarbeiter nicht gefunden' }, { status: 404 });
      }
      return NextResponse.json({
        name: emp.name || settings?.ownerName || 'IT-Hilfe Schubert',
        phone: emp.contactPhone || settings?.phone || '',
        email: settings?.email || '',
        city: emp.contactCity || settings?.city || '',
        companyName: settings?.companyName || 'IT-Hilfe Schubert',
        logoUrl: settings?.logoPath || '',
        employeeNo: emp.employeeNo,
      });
    }

    // Fallback: Admin-/Firmendaten
    return NextResponse.json({
      name: settings?.ownerName || 'IT-Hilfe Schubert',
      phone: settings?.phone || '',
      email: settings?.email || '',
      city: '',
      companyName: settings?.companyName || 'IT-Hilfe Schubert',
      logoUrl: settings?.logoPath || '',
      employeeNo: null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
