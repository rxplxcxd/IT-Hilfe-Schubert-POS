export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessBeleg } from '@/lib/access';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (!(await canAccessBeleg('deviceInventory', id))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const body = await request.json();
    const device = await prisma.deviceInventory.update({
      where: { id },
      data: {
        deviceType: body.deviceType ?? '',
        brand: body.brand ?? '',
        model: body.model ?? '',
        serialNr: body.serialNr ?? '',
        password: body.password ?? '',
        wifiPassword: body.wifiPassword ?? '',
        notes: body.notes ?? '',
      },
    });
    return NextResponse.json(device);
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
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Device DELETE error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
