export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    if (!code) {
      return NextResponse.redirect(new URL('/?gmail_error=no_code', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
    }

    let clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
    let clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      clientId = settings?.googleClientId || '';
      clientSecret = settings?.googleClientSecret || '';
    }
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`;
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    await prisma.gmailToken.upsert({
      where: { id: 1 },
      update: {
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        email: userInfo.data.email || '',
      },
      create: {
        id: 1,
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        email: userInfo.data.email || '',
      },
    });

    return NextResponse.redirect(new URL('/?gmail_connected=true', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  } catch (error: any) {
    console.error('Gmail callback error:', error);
    return NextResponse.redirect(new URL('/?gmail_error=auth_failed', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }
}
