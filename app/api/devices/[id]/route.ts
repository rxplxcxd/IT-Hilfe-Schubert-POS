export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const device = await prisma.deviceInventory.update({
      where: { id: parseInt(params.id) },
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
    await prisma.deviceInventory.delete({ where: { id: parseInt(params.id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Device DELETE error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
