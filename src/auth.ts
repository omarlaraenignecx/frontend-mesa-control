import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { DOMINIO_PERMITIDO, resolverAcceso } from '@/lib/auth/allowlist'
import { listarAutorizados } from '@/lib/auth/usuarios'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: { hd: DOMINIO_PERMITIDO, prompt: 'select_account' },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/sin-acceso' },
  callbacks: {
    async signIn({ profile }) {
      const resultado = resolverAcceso(profile?.email, await listarAutorizados())
      // Devolver una ruta en lugar de false permite explicar el motivo del rechazo.
      return resultado.autorizado ? true : `/sin-acceso?motivo=${resultado.motivo}`
    },
    async jwt({ token }) {
      if (!token.email) return token
      const resultado = resolverAcceso(token.email, await listarAutorizados())
      if (resultado.autorizado) {
        token.rol = resultado.usuario.rol
        token.nombreEnHoja = resultado.usuario.nombreEnHoja
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
