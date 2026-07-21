import { prisma } from './prisma';

/** Formatiert das Mitarbeiter-Kuerzel, z.B. 2 -> "-M002". Ohne Nummer -> "". */
export function employeeSuffix(employeeNo?: number | null): string {
  if (employeeNo === null || employeeNo === undefined) return '';
  return `-M${String(employeeNo).padStart(3, '0')}`;
}

/** Liest die Mitarbeiter-Nummer aus einer Vorgangs-/Belegnummer, z.B. "RE-2026-0001-M002" -> 2. */
export function parseEmployeeNo(value?: string | null): number | null {
  if (!value) return null;
  const m = value.match(/-M(\d{3})$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Atomarer, pro-Mitarbeiter gefuehrter Zaehler.
 * Jeder Mitarbeiter hat eine eigene, bei 1 startende Nummernfolge.
 * Gibt die zu verwendende laufende Nummer zurueck (erste -> 1, dann 2, 3 ...).
 */
async function nextEmployeeCounter(
  employeeNo: number,
  field: 'nextCaseNumber' | 'nextStornoNumber',
): Promise<number> {
  const rec = await prisma.employeeCounter.upsert({
    where: { employeeNo },
    create: { employeeNo, [field]: 2 } as any,
    update: { [field]: { increment: 1 } } as any,
  });
  // Der Zaehler zeigt immer auf die NAECHSTE Nummer, daher -1 fuer die aktuelle.
  return (rec as any)[field] - 1;
}

/** Globaler Fallback-Zaehler (nur wenn keine Mitarbeiter-Nummer vorliegt). */
async function nextGlobalCounter(
  field: 'nextCaseNumber' | 'nextStornoNumber',
): Promise<number> {
  const settings = await prisma.settings.update({
    where: { id: 1 },
    data: { [field]: { increment: 1 } } as any,
  });
  return (settings as any)[field] - 1;
}

/**
 * Generates the next unified case number (Vorgangsnummer).
 * Format: V-YYYY-XXXX  bzw. mit Mitarbeiter: V-YYYY-XXXX-M002
 * Jeder Mitarbeiter besitzt eine eigene, bei 0001 startende Nummernfolge
 * (verhindert Duplikate und erleichtert die Zuordnung fuer das Finanzamt).
 */
export async function getNextCaseNumber(employeeNo?: number | null): Promise<string> {
  const year = new Date().getFullYear();
  let num: number;
  if (employeeNo === null || employeeNo === undefined) {
    num = await nextGlobalCounter('nextCaseNumber');
  } else {
    num = await nextEmployeeCounter(employeeNo, 'nextCaseNumber');
  }
  return `V-${year}-${String(num).padStart(4, '0')}${employeeSuffix(employeeNo)}`;
}

/**
 * Generates the next Storno invoice number.
 * Format: SR-YYYY-XXXX  bzw. mit Mitarbeiter: SR-YYYY-XXXX-M002
 * Separater, ebenfalls pro-Mitarbeiter gefuehrter Zaehler.
 */
export async function getNextStornoNumber(employeeNo?: number | null): Promise<string> {
  const year = new Date().getFullYear();
  let num: number;
  if (employeeNo === null || employeeNo === undefined) {
    num = await nextGlobalCounter('nextStornoNumber');
  } else {
    num = await nextEmployeeCounter(employeeNo, 'nextStornoNumber');
  }
  return `SR-${year}-${String(num).padStart(4, '0')}${employeeSuffix(employeeNo)}`;
}

/**
 * Generates the next support ticket number.
 * Format: T-YYYY-XXX
 * Uses atomic increment in Settings table to prevent duplicates.
 */
export async function getNextTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const settings = await prisma.settings.update({
    where: { id: 1 },
    data: { nextTicketNumber: { increment: 1 } },
  });
  const num = settings.nextTicketNumber - 1;
  return `T-${year}-${String(num).padStart(3, '0')}`;
}

/**
 * Generates document-specific sub-numbers based on the case number.
 * Quote: AN-..., Invoice: RE-..., Order: AU-...
 * Behaelt Jahr, laufende Nummer UND das Mitarbeiter-Kuerzel bei
 * (z.B. V-2026-0001-M002 -> RE-2026-0001-M002).
 */
export function getCaseSubNumbers(caseNumber: string) {
  const rest = caseNumber.replace(/^V-/, '');
  return {
    quoteNumber: `AN-${rest}`,
    invoiceNumber: `RE-${rest}`,
    orderNumber: `AU-${rest}`,
  };
}
