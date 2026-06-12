import { NextRequest, NextResponse } from 'next/server'
import { decryptSession, COOKIE_NAME } from '@/lib/auth'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rutas públicas — no requieren sesión
  if (pathname === '/login' || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  const session = await decryptSession(token)
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  // Solo admin puede acceder a /admin
  if (pathname.startsWith('/admin') && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
