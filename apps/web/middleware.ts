import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import { auth } from './auth';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

/** Routes that stay English and outside locale routing (the panel + auth). */
const PANEL_PREFIXES = ['/admin', '/account', '/signin', '/signup', '/health'];
const isPanel = (pathname: string) =>
  PANEL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const needsSession = (pathname: string) =>
  pathname === '/admin' ||
  pathname.startsWith('/admin/') ||
  pathname === '/account' ||
  pathname.startsWith('/account/');

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public site: locale negotiation + as-needed prefixing.
  if (!isPanel(pathname)) {
    return intlMiddleware(req);
  }

  // Panel + auth pages: protect /admin and /account; let the rest through.
  if (needsSession(pathname) && !req.auth) {
    const signInUrl = new URL('/signin', req.nextUrl.origin);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
});

export const config = {
  // Everything except API routes, Next internals, and files with an extension
  // (so sitemap.xml / robots.txt / llms.txt and static assets are untouched).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
