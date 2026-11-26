/**
 * Menentukan apakah pathname dapat diakses tanpa autentikasi sesi di middleware.
 */
export function isPublicRoutePathname(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  return (
    pathname === '/' ||
    pathname === '/home' ||
    pathname === '/aff' ||
    pathname.startsWith('/aff/') ||
    pathname.startsWith('/api/public/affiliate-catalog') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/logout') ||
    pathname.startsWith('/api/auth/me') ||
    pathname.startsWith('/api/operator/v1/') ||
    pathname.startsWith('/api/operator/v2/') ||
    pathname.startsWith('/api/media-proxy') ||
    pathname.startsWith('/temp/') ||
    pathname.startsWith('/mockup') ||
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/uploads/')
  );
}
