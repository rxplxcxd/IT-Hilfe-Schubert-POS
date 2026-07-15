import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Schuetzt die gesamte App per Supabase-Login.
 * Oeffentlich erreichbar bleiben: Login/Registrierung, die oeffentliche
 * Terminbuchung (/termin) sowie der oeffentliche Angebots-Annahme-Link.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Wenn die Supabase-Variablen fehlen, darf die Middleware die App nicht
  // mit einem 500-Fehler lahmlegen. Anfrage einfach durchreichen.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase-Umgebungsvariablen fehlen (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).');
    return response;
  }

  let user = null;
  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request: { headers: request.headers } });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (err) {
    // Netzwerk-/Auth-Fehler duerfen die App nicht crashen.
    console.error('Middleware Auth-Fehler:', err);
    return response;
  }

  const { pathname } = request.nextUrl;
  const method = request.method;

  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isPublic =
    isAuthPage ||
    pathname === '/termin' ||
    pathname.startsWith('/termin/') ||
    (pathname === '/api/timeslots' && method === 'GET') ||
    (pathname === '/api/appointments' && (method === 'GET' || method === 'POST')) ||
    /^\/api\/quotes\/\d+\/public-accept$/.test(pathname);

  // Nicht eingeloggt & geschuetzte Seite -> zum Login
  if (!user && !isPublic) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Eingeloggt & auf Login/Registrierung -> zur App
  if (user && isAuthPage) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Alle Pfade ausser statischen Assets:
     */
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
