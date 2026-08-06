import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import { DOMINIO_PERMITIDO } from '@/lib/auth/allowlist'

/**
 * Configuración compartida, apta para el runtime edge del middleware.
 *
 * NO debe importar, ni directa ni transitivamente, nada que toque la base de
 * datos: el driver `postgres` usa sockets TCP de Node y en edge falla, lo que
 * rompe los callbacks jwt/session de Auth.js con JWTSessionError y deja al
 * usuario sin sesión. La prueba src/lib/auth/edge-safety.test.ts lo vigila.
 *
 * Los callbacks que consultan la allowlist viven en src/auth.ts, que solo se
 * carga en runtime Node.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: { hd: DOMINIO_PERMITIDO, prompt: 'select_account' },
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // una jornada de trabajo
  },
  pages: { signIn: '/login', error: '/sin-acceso' },
} satisfies NextAuthConfig
