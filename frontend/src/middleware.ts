import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED = ['/dashboard', '/brand-setup', '/posts', '/campaigns', '/context', '/social'];
const AUTH_ONLY = ['/login', '/signup'];

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

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY.some((p) => pathname.startsWith(p));

  // Redirect authenticated users away from auth pages
  if (isAuth && isAuthOnly) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Protect app routes — require auth
  if (!isAuth && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Brand setup guard — authenticated users accessing /dashboard must have a brand profile
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
      // Best-effort: allow through if check fails (network error, timeout)
    }
  }

  return response;
}

export const config = {
  // Exclude static assets, Next.js internals, API routes, and the auth callback
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth).*)'],
};
