import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/auth.config'

/**
 * Proxy de Next.js 16 (antes middleware.ts). Solo responde una pregunta: ¿hay sesión? La autorización fina
 * (allowlist y rol) se revalida contra la base en cada carga de página mediante
 * usuarioActual(), que corre en Node.
 *
 * Se instancia con authConfig y no con la configuración completa de src/auth.ts
 * a propósito: aquí estamos en el runtime edge, donde la base no es alcanzable.
 */
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const publica = ['/login', '/sin-acceso'].some((p) => req.nextUrl.pathname.startsWith(p))
  if (!req.auth && !publica) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  }
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
