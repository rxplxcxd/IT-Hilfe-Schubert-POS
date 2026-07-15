import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed Products
  const products = [
    { id: 1, name: 'Gerät startklar!', description: 'PC/Laptop/Tablet einrichten, Updates, Programme installieren', category: 'FIXED', price: 55.0, unit: 'Pauschal', sortOrder: 1 },
    { id: 2, name: 'Drucker-Retter', description: 'Drucker einrichten, Treiber installieren, Probleme beheben', category: 'FIXED', price: 45.0, unit: 'Pauschal', sortOrder: 2 },
    { id: 3, name: 'Internet-Check / WLAN-Hilfe', description: 'Internetverbindung prüfen, WLAN optimieren, Router konfigurieren', category: 'FIXED', price: 55.0, unit: 'Pauschal', sortOrder: 3 },
    { id: 4, name: 'Sicherheits-Check & Virenschutz', description: 'Virenscanner installieren, System prüfen, Sicherheitseinstellungen', category: 'FIXED', price: 55.0, unit: 'Pauschal', sortOrder: 4 },
    { id: 5, name: 'Individuelle Hilfe (15 Min)', description: 'Flexible Hilfe im 15-Minuten-Takt (Stundensatz 60€)', category: 'HOURLY', price: 15.0, unit: '15 Min', sortOrder: 5 },
    { id: 6, name: 'Der digitale Schutzbrief (Monatlich)', description: 'Monatliches Abo für laufende Betreuung und Support', category: 'SUBSCRIPTION', price: 15.0, unit: 'Monat', sortOrder: 6 },
    { id: 7, name: 'Der digitale Schutzbrief (Jährlich)', description: 'Jährliches Abo für laufende Betreuung und Support (2 Monate gratis)', category: 'SUBSCRIPTION', price: 150.0, unit: 'Jahr', sortOrder: 7 },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: { ...product },
      create: { ...product },
    });
  }

  // Seed Settings
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: 'IT-Hilfe Schubert',
      ownerName: 'Leon Schubert',
      taxInfo: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
    },
  });

  // Seed sample customers
  const customers = [
    { id: 1, firstName: 'Helga', lastName: 'Müller', street: 'Hauptstraße', houseNr: '12', zip: '01234', city: 'Dresden', phone: '0351 1234567', email: 'helga.mueller@web.de', zone: 1, notes: 'Stammkundin, hat oft Druckerprobleme' },
    { id: 2, firstName: 'Werner', lastName: 'Schmidt', street: 'Gartenweg', houseNr: '5a', zip: '01239', city: 'Dresden', phone: '0351 9876543', email: '', zone: 2, notes: 'Braucht regelmäßig Hilfe mit E-Mail' },
    { id: 3, firstName: 'Ingrid', lastName: 'Hoffmann', street: 'Bergstraße', houseNr: '28', zip: '01445', city: 'Radebeul', phone: '0351 5551234', email: 'ingrid.hoffmann@gmx.de', zone: 3, notes: '' },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: { ...c },
      create: { ...c },
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
