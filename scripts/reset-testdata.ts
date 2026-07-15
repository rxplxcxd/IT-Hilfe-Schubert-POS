/**
 * EINMALIGER TESTDATEN-RESET
 * 
 * Löscht: Quotes, QuoteItems, Invoices, InvoiceItems, Orders, OrderPhotos, WorkLogs, WorkLogPhotos, Expenses, Reminders, Subscriptions
 * Behält: Customers, Products, Settings, GmailToken, DeviceInventory, TimeSlots, Appointments
 * Setzt Nummernkreise auf 1 zurück.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== TESTDATEN-RESET ===');
  console.log('Starte Reset...');
  console.log('');

  // Safety check: verify customers exist
  const customerCount = await prisma.customer.count();
  console.log(`Kunden gefunden: ${customerCount} (werden NICHT gelöscht)`);
  if (customerCount === 0) {
    console.log('WARNUNG: Keine Kunden gefunden. Reset wird trotzdem durchgeführt.');
  }

  // Count before delete
  const counts = {
    orderPhotos: await prisma.orderPhoto.count(),
    orders: await prisma.order.count(),
    invoiceItems: await prisma.invoiceItem.count(),
    invoices: await prisma.invoice.count(),
    quoteItems: await prisma.quoteItem.count(),
    quotes: await prisma.quote.count(),
    workLogPhotos: await prisma.workLogPhoto.count(),
    workLogs: await prisma.workLog.count(),
    expenses: await prisma.expense.count(),
    reminders: await prisma.reminder.count(),
    subscriptions: await prisma.subscription.count(),
  };

  console.log('Zu löschende Datensätze:');
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count}`);
  }
  console.log('');

  // Delete in correct order (children first)
  await prisma.orderPhoto.deleteMany({});
  console.log('✓ OrderPhotos gelöscht');
  
  await prisma.order.deleteMany({});
  console.log('✓ Orders gelöscht');
  
  await prisma.invoiceItem.deleteMany({});
  console.log('✓ InvoiceItems gelöscht');
  
  await prisma.invoice.deleteMany({});
  console.log('✓ Invoices gelöscht');
  
  await prisma.quoteItem.deleteMany({});
  console.log('✓ QuoteItems gelöscht');
  
  await prisma.quote.deleteMany({});
  console.log('✓ Quotes gelöscht');
  
  await prisma.workLogPhoto.deleteMany({});
  console.log('✓ WorkLogPhotos gelöscht');
  
  await prisma.workLog.deleteMany({});
  console.log('✓ WorkLogs gelöscht');
  
  await prisma.expense.deleteMany({});
  console.log('✓ Expenses gelöscht');
  
  await prisma.reminder.deleteMany({});
  console.log('✓ Reminders gelöscht');
  
  await prisma.subscription.deleteMany({});
  console.log('✓ Subscriptions gelöscht');

  // Reset counters
  await prisma.settings.upsert({
    where: { id: 1 },
    update: { nextCaseNumber: 1, nextStornoNumber: 1 },
    create: { id: 1, nextCaseNumber: 1, nextStornoNumber: 1 },
  });
  console.log('✓ Nummernkreise auf 1 zurückgesetzt');

  // Verify customers untouched
  const afterCount = await prisma.customer.count();
  console.log('');
  console.log(`Kunden nach Reset: ${afterCount} (unverändert: ${afterCount === customerCount ? 'JA ✓' : 'NEIN ✗'})`);
  
  const totalDeleted = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`\nGesamt gelöscht: ${totalDeleted} Datensätze`);
  console.log('=== RESET ABGESCHLOSSEN ===');
}

main()
  .catch((e) => { console.error('FEHLER:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
