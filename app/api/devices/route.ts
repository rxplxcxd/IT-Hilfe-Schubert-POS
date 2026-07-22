export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope, canAccessCustomer } from '@/lib/access';
import { encryptDevice, decryptDevice } from '@/lib/crypto';
import { logAudit } from '@/lib/audit';

export async function GET(request: Request) {
  try {
    const scope = await getScope();
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customerId');
    const where: any = { ...scope.customerWhere };
    if (customerId) where.customerId = parseInt(customerId);
    const devices = await prisma.deviceInventory.findMany({
      where,
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json((devices ?? []).map((d) => decryptDevice(d)));
  } catch (error: any) {
    console.error('Devices GET error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!(await canAccessCustomer(parseInt(body.customerId)))) {
      return NextResponse.json({ error: 'Kein Zugriff auf diesen Kunden' }, { status: 403 });
    }
    const device = await prisma.deviceInventory.create({
      data: encryptDevice({
        customerId: parseInt(body.customerId),
        deviceType: body.deviceType || '',
        brand: body.brand || '',
        model: body.model || '',
        serialNr: body.serialNr || '',
        password: body.password || '',
        wifiPassword: body.wifiPassword || '',
        notes: body.notes || '',
      }),
    });
    await logAudit({ action: 'CREATE', entity: 'DEVICE', entityId: device.id, summary: `Gerät "${device.deviceType || 'Gerät'} ${device.brand}" angelegt` });
    return NextResponse.json(decryptDevice(device), { status: 201 });
  } catch (error: any) {
    console.error('Devices POST error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
