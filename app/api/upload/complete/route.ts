export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getFileUrl } from '@/lib/s3';

export async function POST(request: Request) {
  try {
    const { cloud_storage_path, isPublic } = await request.json();
    const fileUrl = await getFileUrl(cloud_storage_path ?? '', isPublic ?? false);
    return NextResponse.json({ fileUrl, cloud_storage_path });
  } catch (error: any) {
    console.error('Upload complete error:', error);
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
