import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { resolverAcceso } from '@/lib/auth/allowlist'
import { listarAutorizados } from '@/lib/auth/usuarios'

/**
 * Configuración completa, solo para runtime Node (route handlers, páginas y
 * Server Actions). Añade a authConfig los callbacks que consultan la allowlist
 * en la base de datos. El middleware usa authConfig a secas; ver auth.config.ts.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ profile }) {
      const resultado = resolverAcceso(profile?.email, await listarAutorizados())
      // Devolver una ruta en lugar de false permite explicar el motivo del rechazo.
      return resultado.autorizado ? true : `/sin-acceso?motivo=${resultado.motivo}`
    },
    async jwt({ token, user }) {
      // Solo en el primer inicio de sesión: ahí sí estamos en Node con base
      // disponible. En las revalidaciones el token ya trae rol y nombre.
      if (user && token.email) {
        const resultado = resolverAcceso(token.email, await listarAutorizados())
        if (resultado.autorizado) {
          token.rol = resultado.usuario.rol
          token.nombreEnHoja = resultado.usuario.nombreEnHoja
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.rol = (token.rol as 'operador' | 'admin') ?? 'operador'
      session.user.nombreEnHoja = (token.nombreEnHoja as string | null) ?? null
      return session
    },
  },
})
