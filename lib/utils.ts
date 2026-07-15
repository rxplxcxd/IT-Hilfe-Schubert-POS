import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function getZoneCost(zone: number): number {
  switch (zone) {
    case 1: return 0;
    case 2: return 10;
    case 3: return 20;
    case 4: return 0; // individuell
    default: return 0;
  }
}

export function getZoneFromKm(km: number): number {
  if (km <= 15) return 1;
  if (km <= 30) return 2;
  if (km <= 50) return 3;
  return 4;
}

export function getZoneLabel(zone: number): string {
  switch (zone) {
    case 1: return 'Zone 1 (0€)';
    case 2: return 'Zone 2 (10€)';
    case 3: return 'Zone 3 (20€)';
    case 4: return 'Zone 4 (individuell)';
    default: return 'Unbekannt';
  }
}
