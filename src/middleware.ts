import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export default auth((req) => {
  const publica = ['/login', '/sin-acceso'].some((p) => req.nextUrl.pathname.startsWith(p))
  if (!req.auth && !publica) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  }
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
