export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCurrentUserAdmin } from '@/lib/access';
import { decryptUser } from '@/lib/crypto';

// GET: Liste aller App-Nutzer (nur Admin)
export async function GET() {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }
    const users = await prisma.appUser.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(users.map((u) => decryptUser(u)));
  } catch (error: any) {
    console.error('users GET:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
