import { prisma } from './prisma';

/**
 * Generates the next unified case number (Vorgangsnummer).
 * Format: V-YYYY-XXX (e.g. V-2026-001)
 * Uses atomic increment in Settings table to prevent duplicates.
 */
export async function getNextCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const settings = await prisma.settings.update({
    where: { id: 1 },
    data: { nextCaseNumber: { increment: 1 } },
  });
  // nextCaseNumber was incremented, so the value we use is nextCaseNumber - 1
  // Actually after update, settings.nextCaseNumber = old + 1, so our number = old = settings.nextCaseNumber - 1
  const num = settings.nextCaseNumber - 1;
  return `V-${year}-${String(num).padStart(3, '0')}`;
}

/**
 * Generates the next Storno invoice number.
 * Format: SR-YYYY-XXX (e.g. SR-2026-001)
 * Separate counter for financial compliance.
 */
export async function getNextStornoNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const settings = await prisma.settings.update({
    where: { id: 1 },
    data: { nextStornoNumber: { increment: 1 } },
  });
  const num = settings.nextStornoNumber - 1;
  return `SR-${year}-${String(num).padStart(3, '0')}`;
}

/**
 * Generates document-specific sub-numbers based on the case number.
 * Quote: AN-YYYY-XXX, Invoice: RE-YYYY-XXX, Order: AU-YYYY-XXX
 * All share the same XXX from the case number.
 */
export function getCaseSubNumbers(caseNumber: string) {
  // V-2026-001 -> 2026, 001
  const parts = caseNumber.split('-');
  const year = parts[1];
  const num = parts[2];
  return {
    quoteNumber: `AN-${year}-${num}`,
    invoiceNumber: `RE-${year}-${num}`,
    orderNumber: `AU-${year}-${num}`,
  };
}
