export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCurrentUserAdmin } from '@/lib/access';

// GET: Aenderungsprotokoll (nur Admin). Optional gefiltert nach entity/entityId.
export async function GET(request: Request) {
  try {
    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }
    const url = new URL(request.url);
    const entity = url.searchParams.get('entity');
    const entityIdRaw = url.searchParams.get('entityId');
    const limitRaw = parseInt(url.searchParams.get('limit') || '50', 10);
    const limit = Math.min(isNaN(limitRaw) ? 50 : limitRaw, 200);

    const where: any = {};
    if (entity) where.entity = entity;
    if (entityIdRaw) {
      const eid = parseInt(entityIdRaw, 10);
      if (!isNaN(eid)) where.entityId = eid;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('audit-log GET:', error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
