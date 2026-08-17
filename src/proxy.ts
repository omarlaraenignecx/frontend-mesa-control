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

/** Rutas que se abren sin sesión porque cualquiera tiene que poder entrar. */
const PUBLICAS = ['/login', '/sin-acceso']

/**
 * Rutas que no llevan sesión porque quien las llama es una máquina: los flujos de
 * n8n que producen las notificaciones. **No** quedan abiertas: cada una compara un
 * secreto compartido de tiempo constante y responde 401 sin él, y sin la variable
 * de entorno configurada rechazan todo (ver `lib/notificaciones/secreto.ts`).
 *
 * La lista es de rutas exactas a propósito. Con `startsWith` sobre
 * `/api/notificaciones`, el sondeo del navegador —que sí necesita sesión, porque
 * devuelve datos de casos— se quedaría sin protección.
 */
const CON_SECRETO = ['/api/notificaciones/casos-nuevos']

export default auth((req) => {
  const ruta = req.nextUrl.pathname
  const publica = PUBLICAS.some((p) => ruta.startsWith(p)) || CON_SECRETO.includes(ruta)
  if (!req.auth && !publica) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  }
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
