export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { generatePresignedUploadUrl } from '@/lib/s3';

export async function POST(request: Request) {
  try {
    const { fileName, contentType, isPublic } = await request.json();
    const result = await generatePresignedUploadUrl(fileName ?? 'file', contentType ?? 'application/octet-stream', isPublic ?? false);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Presigned URL error:', error);
    return NextResponse.json({ error: 'Upload-Fehler' }, { status: 500 });
  }
}
