export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCurrentUserAdmin } from '@/lib/access';
import { sendEmail } from '@/lib/email';
import { accessApprovedHtml } from '@/lib/email-templates';
import { encryptUser, decryptUser } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';

// GET: Detail eines Mitarbeiters inkl. seiner Kunden und Kennzahlen (nur Admin)
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const user = await prisma.appUser.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    const customers = await prisma.customer.findMany({
      where: { ownerId: id },
      orderBy: { lastName: 'asc' },
      select: { id: true, firstName: true, lastName: true, city: true, phone: true },
    });

    // Kennzahlen ueber die Kunden dieses Mitarbeiters.
    const [invoiceAgg, orderCount, paidAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: { customer: { ownerId: id } },
        _count: true,
      }),
      prisma.order.count({ where: { customer: { ownerId: id } } }),
      prisma.invoice.aggregate({
        where: { customer: { ownerId: id }, status: 'BEZAHLT' },
        _sum: { total: true },
      }),
    ]);

    const stats = {
      customerCount: customers.length,
      invoiceCount: invoiceAgg._count || 0,
      orderCount: orderCount || 0,
      revenue: paidAgg._sum.total || 0,
    };

    return NextResponse.json({ user: decryptUser(user), customers, stats });
  } catch (error: any) {
    console.error('users GET detail:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

// PATCH: Freigeben / Ablehnen / Rolle aendern (nur Admin)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const action = body?.action as string;

    const user = await prisma.appUser.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

    if (action === 'approve') {
      const updated = await prisma.appUser.update({
        where: { id },
        data: { status: 'APPROVED', approvedAt: new Date() },
      });
      try {
        await sendEmail({
          to: updated.email,
          subject: 'Dein Zugang wurde freigeschaltet',
          html: accessApprovedHtml({ name: updated.name }),
        });
      } catch (e: any) {
        console.error('approve email:', e?.message);
      }
      await logAudit({ action: 'APPROVE', entity: 'USER', entityId: id, summary: `${updated.name || updated.email} freigeschaltet` });
      return NextResponse.json(updated);
    }

    if (action === 'reject') {
      const updated = await prisma.appUser.update({
        where: { id },
        data: { status: 'REJECTED', approvedAt: null },
      });
      await logAudit({ action: 'REJECT', entity: 'USER', entityId: id, summary: `${updated.name || updated.email} abgelehnt` });
      return NextResponse.json(updated);
    }

    if (action === 'role') {
      const role = body?.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE';
      const updated = await prisma.appUser.update({ where: { id }, data: { role } });
      await logAudit({ action: 'ROLE', entity: 'USER', entityId: id, summary: `Rolle von ${updated.name || updated.email} auf ${role} gesetzt` });
      return NextResponse.json(updated);
    }

    if (action === 'prefix') {
      // Firmen-E-Mail-Prefix des Mitarbeiters setzen (nur Kleinbuchstaben,
      // Ziffern, Punkt, Minus). Leerer Wert entfernt die Zuordnung.
      const raw = String(body?.emailPrefix ?? '').trim().toLowerCase();
      const clean = raw.replace(/[^a-z0-9._-]/g, '');
      const updated = await prisma.appUser.update({
        where: { id },
        data: { emailPrefix: clean } as any,
      });
      await logAudit({ action: 'PREFIX', entity: 'USER', entityId: id, summary: `Firmen-E-Mail-Prefix von ${updated.name || updated.email} auf "${clean}" gesetzt` });
      return NextResponse.json(updated);
    }

    if (action === 'profile') {
      // Vollstaendige Personaldaten-Aktualisierung aus der
      // Mitarbeiterverwaltungszentrale (nur Admin).
      const s = (v: any) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
      const parseDate = (v: any): Date | null => {
        if (!v || typeof v !== 'string' || !v.trim()) return null;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      };
      const num = (v: any): number | null => {
        if (v === '' || v == null) return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      };
      const bool = (v: any) => v === true || v === 'true' || v === 1 || v === '1';
      const data: any = {};
      // Kontakt-/Basisdaten
      if (body.name !== undefined) data.name = s(body.name);
      if (body.contactStreet !== undefined) data.contactStreet = s(body.contactStreet);
      if (body.contactZip !== undefined) data.contactZip = s(body.contactZip);
      if (body.contactCity !== undefined) data.contactCity = s(body.contactCity);
      if (body.contactPhone !== undefined) data.contactPhone = s(body.contactPhone);
      // Erweiterte Personaldaten
      if (body.position !== undefined) data.position = s(body.position);
      if (body.personalEmail !== undefined) data.personalEmail = s(body.personalEmail);
      if (body.birthDate !== undefined) data.birthDate = parseDate(body.birthDate);
      if (body.startDate !== undefined) data.startDate = parseDate(body.startDate);
      if (body.emergencyContact !== undefined) data.emergencyContact = s(body.emergencyContact);
      if (body.emergencyPhone !== undefined) data.emergencyPhone = s(body.emergencyPhone);
      if (body.iban !== undefined) data.iban = s(body.iban);
      if (body.taxId !== undefined) data.taxId = s(body.taxId);
      if (body.socialSecurityNo !== undefined) data.socialSecurityNo = s(body.socialSecurityNo);
      if (body.healthInsurance !== undefined) data.healthInsurance = s(body.healthInsurance);
      if (body.internalNotes !== undefined) data.internalNotes = s(body.internalNotes);
      // Erweiterte Personalstammdaten (Finanzamt / Lohnbuchhaltung)
      if (body.birthPlace !== undefined) data.birthPlace = s(body.birthPlace);
      if (body.nationality !== undefined) data.nationality = s(body.nationality);
      if (body.maritalStatus !== undefined) data.maritalStatus = s(body.maritalStatus);
      if (body.religion !== undefined) data.religion = s(body.religion);
      if (body.taxClass !== undefined) data.taxClass = s(body.taxClass);
      if (body.childAllowances !== undefined) data.childAllowances = num(body.childAllowances);
      if (body.severelyDisabled !== undefined) data.severelyDisabled = bool(body.severelyDisabled);
      if (body.employmentType !== undefined) data.employmentType = s(body.employmentType);
      if (body.weeklyHours !== undefined) data.weeklyHours = num(body.weeklyHours);
      if (body.hourlyWage !== undefined) data.hourlyWage = num(body.hourlyWage);
      if (body.monthlySalary !== undefined) data.monthlySalary = num(body.monthlySalary);
      if (body.vacationDays !== undefined) {
        const n = num(body.vacationDays);
        data.vacationDays = n == null ? null : Math.round(n);
      }
      if (body.exitDate !== undefined) data.exitDate = parseDate(body.exitDate);
      if (body.employmentStatus !== undefined) {
        const allowed = ['AKTIV', 'INAKTIV', 'AUSGESCHIEDEN'];
        const v = s(body.employmentStatus).toUpperCase();
        data.employmentStatus = allowed.includes(v) ? v : 'AKTIV';
      }
      // Sensible Felder verschluesselt ablegen (iban, socialSecurityNo, taxId)
      const updated = await prisma.appUser.update({ where: { id }, data: encryptUser(data) });
      await logAudit({ action: 'UPDATE', entity: 'USER', entityId: id, summary: `Personaldaten von ${updated.name || updated.email} aktualisiert` });
      return NextResponse.json(decryptUser(updated));
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error: any) {
    console.error('users PATCH:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}

// DELETE: Nutzer entfernen (nur Admin)
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
    const victim = await prisma.appUser.findUnique({ where: { id } });
    await prisma.appUser.delete({ where: { id } });
    await logAudit({ action: 'DELETE', entity: 'USER', entityId: id, summary: `Mitarbeiter ${victim?.name || victim?.email || id} gelöscht` });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('users DELETE:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
