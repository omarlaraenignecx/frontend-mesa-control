import { redirect } from 'next/navigation'
import { usuarioActual } from '@/lib/auth/usuarios'
import { SCOPES_MESA } from '@/lib/google/auth-mesa'

export async function GET(request: Request) {
  const usuario = await usuarioActual()
  if (usuario.rol !== 'admin') {
    return new Response('Solo el administrador puede autorizar el acceso a Google.', {
      status: 403,
    })
  }

  const origen = new URL(request.url).origin
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_OAUTH_CLIENT_ID!)
  url.searchParams.set('redirect_uri', `${origen}/api/mesa/callback`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES_MESA.join(' '))
  // offline + consent es lo que garantiza que Google entregue un refresh token.
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('login_hint', process.env.MESA_CORREO ?? 'mesadecontrol@gplusseguros.mx')

  redirect(url.toString())
}
