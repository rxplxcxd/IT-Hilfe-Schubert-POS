export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/s3';
import { canAccessBeleg } from '@/lib/access';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await canAccessBeleg('order', parseInt(params.id)))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    const body = await request.json();
    const photo = await prisma.orderPhoto.create({
      data: {
        orderId: parseInt(params.id),
        filePath: body.filePath || '',
        fileUrl: body.url,
        caption: body.caption || '',
        photoType: body.photoType || 'ARBEIT',
        isPublic: body.isPublic ?? true,
      },
    });
    return NextResponse.json(photo, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const photoId = searchParams.get('photoId');
    if (!photoId) return NextResponse.json({ error: 'photoId fehlt' }, { status: 400 });

    const photo = await prisma.orderPhoto.findUnique({ where: { id: parseInt(photoId) } });
    if (photo && !(await canAccessBeleg('order', photo.orderId))) {
      return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
    }
    if (photo?.filePath) {
      try { await deleteFile(photo.filePath); } catch (e) { console.error('S3 delete error:', e); }
    }
    await prisma.orderPhoto.delete({ where: { id: parseInt(photoId) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
