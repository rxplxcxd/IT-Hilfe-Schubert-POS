export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    await prisma.gmailToken.upsert({
      where: { id: 1 },
      update: { accessToken: '', refreshToken: '', email: '', expiresAt: null },
      create: { id: 1, accessToken: '', refreshToken: '', email: '' },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Gmail disconnect error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
