import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';

/**
 * Zentrales Aenderungsprotokoll (Punkt 9).
 *
 * Schreibt einen Eintrag in die AuditLog-Tabelle. Bewusst "fire and forget":
 * Faellt das Protokollieren aus, darf der eigentliche Vorgang NICHT scheitern
 * (deshalb alles in try/catch, keine Weitergabe von Fehlern).
 */
export async function logAudit(input: {
  action: string; // CREATE, UPDATE, DELETE, APPROVE, REJECT, ROLE, PREFIX ...
  entity: string; // USER, DEVICE, DOCUMENT ...
  entityId?: number | null;
  summary?: string;
  details?: any;
  actorId?: number | null;
  actorName?: string;
}): Promise<void> {
  try {
    let actorId = input.actorId ?? null;
    let actorName = input.actorName ?? '';
    if (actorId == null) {
      const me = await getAccessForCurrentUser().catch(() => null);
      if (me) {
        actorId = me.id;
        actorName = me.name || me.email;
      }
    }
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? undefined,
        actorName: actorName || '',
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? undefined,
        summary: input.summary ?? '',
        details: input.details
          ? typeof input.details === 'string'
            ? input.details
            : JSON.stringify(input.details)
          : '',
      },
    });
  } catch (e: any) {
    console.error('logAudit:', e?.message);
  }
}
