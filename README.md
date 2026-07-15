# IT-Hilfe Schubert - POS (Self-Hosted)

Unabhaengige Version des Kassensystems fuer **Vercel** (Hosting) + **Supabase** (Datenbank, Auth, Storage) + **Resend** (E-Mail). Keine Abhaengigkeit von Abacus mehr.

## 1. Voraussetzungen

- Supabase-Projekt (Datenbank-Schema aus TEIL 2 wurde bereits eingespielt)
- Storage-Bucket `uploads` in Supabase (oeffentlich) angelegt
- Resend-Konto mit API-Key und verifizierter Absender-Domain
- GitHub-Repository + Vercel-Konto

## 2. Umgebungsvariablen

Alle Werte aus `.env.example` in Vercel unter **Project Settings -> Environment Variables** eintragen:

| Variable | Beschreibung |
|---|---|
| `DATABASE_URL` | Supabase Connection Pooler (Port 6543, `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | Direkte DB-Verbindung (Port 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon-Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service-Role-Key (nur serverseitig) |
| `SUPABASE_STORAGE_BUCKET` | `uploads` |
| `RESEND_API_KEY` | Resend API-Key |
| `RESEND_FROM_EMAIL` | z. B. `IT-Hilfe Schubert <rechnung@deine-domain.de>` |
| `NEXT_PUBLIC_APP_URL` | Deine Vercel-URL (Produktion) |

## 3. Lokal starten

```bash
yarn install
cp .env.example .env      # Werte eintragen
yarn prisma generate
yarn dev
```

## 4. Deployment auf Vercel

1. Repository zu GitHub pushen (Dateien hochladen).
2. In Vercel "New Project" -> Repo importieren.
3. Environment Variables eintragen (siehe oben).
4. Deploy. Der Build fuehrt automatisch `prisma generate` aus.

## 5. Erster Login (Admin)

- Oeffne `/register` und lege dein Konto an.
- **Der erste registrierte Nutzer wird automatisch Administrator** (per Supabase-Trigger).
- Danach ist `/register` weiterhin erreichbar - bei Bedarf in Supabase Auth deaktivieren.

### Hinweis E-Mail-Bestaetigung
Standardmaessig verlangt Supabase eine E-Mail-Bestaetigung bei der Registrierung.
Fuer einen reibungslosen ersten Login: Supabase -> **Authentication -> Providers -> Email**
-> "Confirm email" deaktivieren (oder die Bestaetigungs-Mail einmal bestaetigen).

## Oeffentliche Seiten (ohne Login erreichbar)

- `/termin` - oeffentliche Terminbuchung
- Angebots-Annahme-Link aus den Angebots-E-Mails

Alle uebrigen Seiten und API-Routen sind per Login geschuetzt (Middleware).
