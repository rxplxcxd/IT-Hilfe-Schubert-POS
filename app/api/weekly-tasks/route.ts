export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope } from '@/lib/access';

/**
 * Wochenaufgaben (Batch 4): einfache wiederkehrende To-dos pro Mitarbeiter.
 * Admin sieht alle, Mitarbeiter nur die eigenen (ownerId).
 */
export async function GET() {
  const scope = await getScope();
  if (!scope.access || scope.access.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
  }
  const where = scope.isAdmin ? {} : { ownerId: scope.access.id };
  const tasks = await prisma.weeklyTask.findMany({
    where,
    orderBy: [{ done: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const scope = await getScope();
  if (!scope.access || scope.access.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const title = String(body?.title ?? '').trim();
  if (!title) {
    return NextResponse.json({ error: 'Titel fehlt.' }, { status: 400 });
  }
  const weekdayRaw = body?.weekday;
  const weekday = weekdayRaw === null || weekdayRaw === undefined || weekdayRaw === ''
    ? null
    : parseInt(String(weekdayRaw));
  const task = await prisma.weeklyTask.create({
    data: {
      title,
      weekday: Number.isNaN(weekday as any) ? null : weekday,
      ownerId: scope.access.id,
    },
  });
  return NextResponse.json({ task });
}
