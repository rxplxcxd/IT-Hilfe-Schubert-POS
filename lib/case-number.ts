import { prisma } from './prisma';

/** Formatiert das Mitarbeiter-Kuerzel, z.B. 2 -> "-M002". Ohne Nummer -> "". */
export function employeeSuffix(employeeNo?: number | null): string {
  if (employeeNo === null || employeeNo === undefined) return '';
  return `-M${String(employeeNo).padStart(3, '0')}`;
}

/**
 * Generates the next unified case number (Vorgangsnummer).
 * Format: V-YYYY-XXX  bzw. mit Mitarbeiter: V-YYYY-XXX-M002
 * Uses atomic increment in Settings table to prevent duplicates.
 */
export async function getNextCaseNumber(employeeNo?: number | null): Promise<string> {
  const year = new Date().getFullYear();
  const settings = await prisma.settings.update({
    where: { id: 1 },
    data: { nextCaseNumber: { increment: 1 } },
  });
  // nextCaseNumber was incremented, so the value we use is nextCaseNumber - 1
  const num = settings.nextCaseNumber - 1;
  return `V-${year}-${String(num).padStart(3, '0')}${employeeSuffix(employeeNo)}`;
}

/**
 * Generates the next Storno invoice number.
 * Format: SR-YYYY-XXX  bzw. mit Mitarbeiter: SR-YYYY-XXX-M002
 * Separate counter for financial compliance.
 */
export async function getNextStornoNumber(employeeNo?: number | null): Promise<string> {
  const year = new Date().getFullYear();
  const settings = await prisma.settings.update({
    where: { id: 1 },
    data: { nextStornoNumber: { increment: 1 } },
  });
  const num = settings.nextStornoNumber - 1;
  return `SR-${year}-${String(num).padStart(3, '0')}${employeeSuffix(employeeNo)}`;
}

/**
 * Generates document-specific sub-numbers based on the case number.
 * Quote: AN-..., Invoice: RE-..., Order: AU-...
 * Behaelt Jahr, laufende Nummer UND das Mitarbeiter-Kuerzel bei
 * (z.B. V-2026-001-M002 -> RE-2026-001-M002).
 */
export function getCaseSubNumbers(caseNumber: string) {
  const rest = caseNumber.replace(/^V-/, '');
  return {
    quoteNumber: `AN-${rest}`,
    invoiceNumber: `RE-${rest}`,
    orderNumber: `AU-${rest}`,
  };
}
