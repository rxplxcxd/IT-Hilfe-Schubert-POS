import {
  LayoutDashboard, Users, ShoppingCart, Mail, Package, Wallet,
  ClipboardList, CalendarDays, Settings, LifeBuoy, LucideIcon,
} from 'lucide-react';

/**
 * Zentrale Navigations-Konfiguration.
 *
 * Diese Liste ist die EINZIGE Quelle der Wahrheit fuer die Tabs der App.
 * Sowohl die App-Shell (Sidebar, mobile Navigation) als auch die
 * Onboarding-Tour lesen von hier. Wird ein Tab umbenannt oder ergaenzt,
 * passt sich die Tour automatisch an, weil die Beschriftung live aus
 * NAV_TABS gezogen wird. Nichts ist doppelt gepflegt.
 */
export interface NavTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_TABS: NavTab[] = [
  { id: 'dashboard', label: 'Start', icon: LayoutDashboard },
  { id: 'customers', label: 'Kunden', icon: Users },
  { id: 'booking', label: 'Buchung', icon: ShoppingCart },
  { id: 'belege', label: 'Belege', icon: ClipboardList },
  { id: 'tickets', label: 'Tickets', icon: LifeBuoy },
  { id: 'email', label: 'E-Mail', icon: Mail },
  { id: 'finances', label: 'Finanzen', icon: Wallet },
  { id: 'products', label: 'Produkte', icon: Package },
  { id: 'appointments', label: 'Termine', icon: CalendarDays },
  { id: 'settings', label: 'Einstellungen', icon: Settings },
];

export type TabId = string;

/**
 * Onboarding-Texte je Tab. Bewusst locker und menschlich formuliert.
 * Kein Roboter-Deutsch, keine Aufzaehlungspunkte, keine Bindestriche
 * mitten im Satz. Jeder Eintrag erklaert kurz was der Bereich macht,
 * wohin er fuehrt und was der Mitarbeiter davon hat.
 */
export interface OnboardingCopy {
  what: string;
  where: string;
  benefit: string;
}

export const ONBOARDING_COPY: Record<string, OnboardingCopy> = {
  dashboard: {
    what: 'Hier siehst du auf einen Blick, was heute wichtig ist.',
    where: 'Das ist deine Startseite mit allen Zahlen und offenen Aufgaben.',
    benefit: 'So weisst du sofort, wo du anpacken musst, ohne lange zu suchen.',
  },
  customers: {
    what: 'Hier legst du neue Kunden an und pflegst ihre Daten.',
    where: 'Die Kundenliste mit allen Kontakten und ihrer Historie.',
    benefit: 'Du hast jeden Kunden mit seinen Geraeten und Auftraegen sofort griffbereit.',
  },
  booking: {
    what: 'Hier buchst du Leistungen und Produkte auf einen Kunden.',
    where: 'Der Kassenbereich, in dem eine neue Rechnung entsteht.',
    benefit: 'Du kassierst schnell ab und der Beleg ist in Sekunden fertig.',
  },
  belege: {
    what: 'Hier findest du alle Rechnungen, Angebote und Auftraege wieder.',
    where: 'Die zentrale Beleguebersicht mit Status und Betraegen.',
    benefit: 'Du siehst sofort, was schon bezahlt ist und was noch offen steht.',
  },
  tickets: {
    what: 'Hier meldest du Probleme und verfolgst deine Anfragen an den Chef.',
    where: 'Der interne Support Bereich fuer dein Team.',
    benefit: 'Du bekommst Hilfe, ohne extra anzurufen, und alles bleibt sauber dokumentiert.',
  },
  email: {
    what: 'Hier schreibst und empfaengst du Nachrichten an deine Kunden.',
    where: 'Dein Postfach direkt in der App.',
    benefit: 'Du schreibst Kunden direkt an, ohne staendig das Programm zu wechseln.',
  },
  finances: {
    what: 'Hier siehst du deine Einnahmen und Ausgaben im Ueberblick.',
    where: 'Die Finanzauswertung mit allen Umsaetzen.',
    benefit: 'Du behaeltst deine Zahlen im Blick und weisst genau, wie es gerade laeuft.',
  },
  products: {
    what: 'Hier pflegst du deine Produkte und Preise.',
    where: 'Der Produktkatalog, aus dem du beim Buchen auswaehlst.',
    benefit: 'Einmal angelegt, setzt du alles blitzschnell auf eine Rechnung.',
  },
  appointments: {
    what: 'Hier planst du Termine mit deinen Kunden.',
    where: 'Dein Kalender mit allen anstehenden Terminen.',
    benefit: 'Du verpasst keinen Termin mehr und hast deinen Tag klar strukturiert.',
  },
  settings: {
    what: 'Hier passt du deine persoenlichen Daten und die App an.',
    where: 'Der Einstellungsbereich mit deinem Profil und den Firmendaten.',
    benefit: 'Du haeltst deine Angaben aktuell, damit auf den Belegen alles stimmt.',
  },
};

/** Reihenfolge der Tour. Nur IDs, die auch wirklich erklaert werden sollen. */
export const ONBOARDING_ORDER: string[] = [
  'dashboard', 'customers', 'booking', 'belege', 'tickets',
  'email', 'finances', 'products', 'appointments', 'settings',
];

export interface TourStep {
  id: string;
  selector: string;
  label: string;
  what: string;
  where: string;
  benefit: string;
}

/**
 * Baut die Tour-Schritte dynamisch zusammen. Die Beschriftung wird LIVE aus
 * NAV_TABS gelesen, damit ein umbenannter Tab automatisch auch in der Tour
 * den neuen Namen traegt. Tabs ohne Copy werden uebersprungen.
 */
export function buildTourSteps(): TourStep[] {
  const byId = new Map(NAV_TABS.map((t) => [t.id, t]));
  const steps: TourStep[] = [];
  for (const id of ONBOARDING_ORDER) {
    const tab = byId.get(id);
    const copy = ONBOARDING_COPY[id];
    if (!tab || !copy) continue;
    steps.push({
      id,
      selector: `[data-tour="tab-${id}"]`,
      label: tab.label,
      what: copy.what,
      where: copy.where,
      benefit: copy.benefit,
    });
  }
  return steps;
}
