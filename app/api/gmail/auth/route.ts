export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAccessForCurrentUser } from '@/lib/access';
import { buildOAuthClient, getUserToken, companyAddress, getGmailRedirectUri } from '@/lib/gmail';

export async function GET() {
  try {
    const access = await getAccessForCurrentUser();
    if (!access || access.status !== 'APPROVED') {
      return NextResponse.json({ connected: false, authUrl: null, error: 'Kein Zugriff' }, { status: 200 });
    }

    // Firmen-Adresse dieses Mitarbeiters bestimmen.
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const me = await prisma.appUser.findUnique({ where: { id: access.id } });
    const domain = (settings as any)?.mailDomain || 'ithilfeschubert.xyz';
    const prefix = (me as any)?.emailPrefix || '';
    const compAddress = companyAddress(prefix, domain);
    const redirectUri = getGmailRedirectUri();

    const oauth2Client = await buildOAuthClient();
    if (!oauth2Client) {
      return NextResponse.json({
        connected: false,
        authUrl: null,
        error: 'Google API-Zugangsdaten nicht konfiguriert',
        companyAddress: compAddress,
        prefixSet: !!compAddress,
        redirectUri,
      });
    }

    // Vorhandenes Token dieses Mitarbeiters pruefen.
    const token = await getUserToken(access.id);
    if (token && token.refreshToken) {
      oauth2Client.setCredentials({ refresh_token: token.refreshToken });
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        await prisma.gmailToken.update({
          where: { userId: access.id },
          data: {
            accessToken: credentials.access_token || '',
            expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
          },
        });
        return NextResponse.json({
          connected: true,
          email: token.email,
          companyAddress: compAddress,
          prefixSet: !!compAddress,
          redirectUri,
        });
      } catch {
        // Token ungueltig -> neue Anmeldung noetig
      }
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      state: String(access.id),
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    });

    return NextResponse.json({
      connected: false,
      authUrl,
      companyAddress: compAddress,
      prefixSet: !!compAddress,
      redirectUri,
    });
  } catch (error: any) {
    console.error('Gmail auth error:', error);
    return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
  }
}
