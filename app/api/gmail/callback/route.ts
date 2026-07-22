export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';
import { buildOAuthClient, getAppOrigin } from '@/lib/gmail';

function appBase() {
  return getAppOrigin();
}

export async function GET(request: Request) {
  const base = appBase();
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    if (!code) {
      return NextResponse.redirect(base + '/?gmail_error=no_code');
    }

    // Aktuellen Mitarbeiter ueber die Session ermitteln (das Session-Cookie
    // wird beim Redirect zurueck auf unsere Domain mitgeschickt). Fallback:
    // die im state uebergebene userId.
    const access = await getAccessForCurrentUser();
    let userId = access?.id ?? null;
    if (!userId) {
      const stateId = parseInt(url.searchParams.get('state') || '', 10);
      if (!isNaN(stateId)) userId = stateId;
    }
    if (!userId) {
      return NextResponse.redirect(base + '/?gmail_error=no_user');
    }

    const oauth2Client = await buildOAuthClient();
    if (!oauth2Client) {
      return NextResponse.redirect(base + '/?gmail_error=not_configured');
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // E-Mail-Adresse des verbundenen Kontos abrufen.
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    await prisma.gmailToken.upsert({
      where: { userId },
      update: {
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        email: userInfo.data.email || '',
      },
      create: {
        userId,
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        email: userInfo.data.email || '',
      },
    });

    return NextResponse.redirect(base + '/?gmail_connected=true');
  } catch (error: any) {
    console.error('Gmail callback error:', error);
    return NextResponse.redirect(base + '/?gmail_error=auth_failed');
  }
}
