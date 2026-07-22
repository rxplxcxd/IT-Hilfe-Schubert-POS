export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/version';

/** Liefert die aktuell auf dem Server laufende App-Version. */
export async function GET() {
  return NextResponse.json({ version: APP_VERSION }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
