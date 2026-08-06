import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      rol: 'operador' | 'admin'
      nombreEnHoja: string | null
    } & DefaultSession['user']
  }
}
