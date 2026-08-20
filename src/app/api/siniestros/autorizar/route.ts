import { redirect } from 'next/navigation'
import { usuarioActual } from '@/lib/auth/usuarios'
import { SCOPES_SINIESTROS } from '@/lib/siniestros/auth'

/**
 * Manda a la pantalla de consentimiento de Google para autorizar un buzón del módulo
 * de siniestros.
 *
 * La abre cualquier usuario autorizado, no solo el administrador: cada quien concede
 * **su propia** cuenta, y exigir que el ejecutivo de siniestros fuera administrador de
 * la mesa entera le daría además la reautorización del Google de la mesa y la edición
 * de sus plantillas. Qué buzón quedó autorizado no lo decide esta ruta ni la sesión:
 * lo dice Google en el callback.
 */
export async function GET(request: Request) {
  const usuario = await usuarioActual()

  const origen = new URL(request.url).origin
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_OAUTH_CLIENT_ID!)
  url.searchParams.set('redirect_uri', `${origen}/api/siniestros/callback`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES_SINIESTROS.join(' '))
  // offline + consent es lo que garantiza que Google entregue un refresh token.
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  // Sugerencia, no imposición: si la persona elige otra cuenta en la pantalla de
  // Google, el callback registra la que de verdad autorizó.
  url.searchParams.set('login_hint', usuario.correo)

  redirect(url.toString())
}
