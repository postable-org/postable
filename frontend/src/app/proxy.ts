import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) =>
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          ),
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const isAuth = !!session;

  // Redirect authenticated users away from auth pages
  if (isAuth && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Protect /dashboard and /brand-setup — require auth
  if (!isAuth && (pathname.startsWith('/dashboard') || pathname.startsWith('/brand-setup'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Brand setup guard — authenticated users accessing /dashboard must have a brand profile
  // If no brand: redirect to /brand-setup (best-effort: allow through if check fails)
  if (isAuth && pathname.startsWith('/dashboard') && session?.access_token) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
      const brandRes = await fetch(`${apiUrl}/api/brands`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(3000),
      });
      if (brandRes.status === 404) {
        return NextResponse.redirect(new URL('/brand-setup', request.url));
      }
    } catch {
      // Best-effort: if the check fails (network error, timeout), allow through
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
