export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessBeleg } from '@/lib/access';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await canAccessBeleg('workLog', parseInt(params.id)))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const body = await request.json();
    const photo = await prisma.workLogPhoto.create({
      data: {
        workLogId: parseInt(params.id),
        filePath: body.filePath,
        fileUrl: body.fileUrl,
        isPublic: body.isPublic ?? true,
        caption: body.caption || '',
      },
    });
    return NextResponse.json(photo, { status: 201 });
  } catch (error: any) {
    console.error('WorkLogPhoto POST error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await canAccessBeleg('workLog', parseInt(params.id)))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const url = new URL(request.url);
    const photoId = url.searchParams.get('photoId');
    if (photoId) {
      await prisma.workLogPhoto.delete({ where: { id: parseInt(photoId) } });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('WorkLogPhoto DELETE error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
