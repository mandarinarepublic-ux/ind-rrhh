// middleware.js
// Solo redirige por comodidad: si no hay cookie, te manda al login.
//
// NO es la barrera de seguridad. El middleware corre en el runtime Edge, donde
// no hay node:crypto para verificar la firma. La validacion de verdad ocurre en
// cada page (server component) y en cada ruta de /api, que corren en Node y
// llaman a leerSesion(). Aqui solo evitamos pantallazos vacios.

import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/cookie';

const PROTEGIDAS = ['/panel', '/mi'];

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const tieneCookie = Boolean(req.cookies.get(COOKIE)?.value);

  if (PROTEGIDAS.some((p) => pathname.startsWith(p)) && !tieneCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('volver', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === '/login' && tieneCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/panel/:path*', '/mi/:path*', '/login'],
};
