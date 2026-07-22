export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessBeleg } from '@/lib/access';
import { encryptDevice, decryptDevice } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (!(await canAccessBeleg('deviceInventory', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const body = await request.json();
    const device = await prisma.deviceInventory.update({
      where: { id },
      data: encryptDevice({
        deviceType: body.deviceType ?? '',
        brand: body.brand ?? '',
        model: body.model ?? '',
        serialNr: body.serialNr ?? '',
        password: body.password ?? '',
        wifiPassword: body.wifiPassword ?? '',
        notes: body.notes ?? '',
      }),
    });
    await logAudit({ action: 'UPDATE', entity: 'DEVICE', entityId: id, summary: `Gerät "${device.deviceType || 'Gerät'} ${device.brand}" bearbeitet` });
    return NextResponse.json(decryptDevice(device));
  } catch (error: any) {
    console.error('Device PUT error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (!(await canAccessBeleg('deviceInventory', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    await prisma.deviceInventory.delete({ where: { id } });
    await logAudit({ action: 'DELETE', entity: 'DEVICE', entityId: id, summary: `Gerät #${id} gelöscht` });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Device DELETE error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
