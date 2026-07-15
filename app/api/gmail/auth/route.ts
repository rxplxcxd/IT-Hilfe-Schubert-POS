export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';

async function getOAuth2Client() {
  let clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    clientId = settings?.googleClientId || '';
    clientSecret = settings?.googleClientSecret || '';
  }
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`;
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function GET() {
  try {
    const oauth2Client = await getOAuth2Client();
    if (!oauth2Client) {
      return NextResponse.json({ connected: false, authUrl: null, error: 'Google API-Zugangsdaten nicht konfiguriert' });
    }

    // Check if we have a valid token
    const token = await prisma.gmailToken.findUnique({ where: { id: 1 } });
    if (token && token.refreshToken) {
      oauth2Client.setCredentials({ refresh_token: token.refreshToken });
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        await prisma.gmailToken.update({
          where: { id: 1 },
          data: {
            accessToken: credentials.access_token || '',
            expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
          },
        });
        return NextResponse.json({ connected: true, email: token.email });
      } catch {
        // Token invalid, need re-auth
      }
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    });

    return NextResponse.json({ connected: false, authUrl });
  } catch (error: any) {
    console.error('Gmail auth error:', error);
    return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
  }
}
