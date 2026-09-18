export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getScope } from '@/lib/access';

async function loadOwned(id: number) {
  const scope = await getScope();
  if (!scope.access || scope.access.status !== 'APPROVED') return { scope, task: null as any, denied: true };
  const task = await prisma.weeklyTask.findUnique({ where: { id } });
  if (!task) return { scope, task: null as any, denied: false };
  const allowed = scope.isAdmin || task.ownerId === scope.access.id;
  return { scope, task, denied: !allowed };
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const { task, denied } = await loadOwned(id);
  if (denied) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
  if (!task) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: any = {};
  if (typeof body?.done === 'boolean') data.done = body.done;
  if (typeof body?.title === 'string' && body.title.trim()) data.title = body.title.trim();
  if (body?.weekday !== undefined) {
    const w = body.weekday === null || body.weekday === '' ? null : parseInt(String(body.weekday));
    data.weekday = Number.isNaN(w as any) ? null : w;
  }

  const updated = await prisma.weeklyTask.update({ where: { id }, data });
  return NextResponse.json({ task: updated });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const { task, denied } = await loadOwned(id);
  if (denied) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 });
  if (!task) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });
  await prisma.weeklyTask.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
