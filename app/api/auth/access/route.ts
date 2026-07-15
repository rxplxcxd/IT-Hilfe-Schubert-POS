export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAccessForCurrentUser } from '@/lib/access';

// GET: Freigabe-Status des aktuell eingeloggten Nutzers
export async function GET() {
  try {
    const access = await getAccessForCurrentUser();
    if (!access) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }
    return NextResponse.json({ authenticated: true, ...access });
  } catch (error: any) {
    console.error('auth/access:', error?.message);
    return NextResponse.json({ authenticated: false, error: error?.message }, { status: 200 });
  }
}
