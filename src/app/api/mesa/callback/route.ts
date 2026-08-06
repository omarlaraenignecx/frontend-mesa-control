import { redirect } from 'next/navigation'
import { usuarioActual } from '@/lib/auth/usuarios'
import { guardarCredencial } from '@/lib/google/credencial'

export async function GET(request: Request) {
  const usuario = await usuarioActual()
  if (usuario.rol !== 'admin') {
    return new Response('Solo el administrador puede autorizar el acceso a Google.', {
      status: 403,
    })
  }

  const url = new URL(request.url)
  const codigo = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  if (error) redirect(`/ajustes?estado=error&detalle=${encodeURIComponent(error)}`)
  if (!codigo) redirect('/ajustes?estado=error&detalle=sin-codigo')

  const respuesta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: codigo!,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: `${url.origin}/api/mesa/callback`,
    }).toString(),
  })

  const cuerpo = (await respuesta.json().catch(() => ({}))) as {
    refresh_token?: string
    scope?: string
  }

  if (!respuesta.ok || !cuerpo.refresh_token) {
    redirect('/ajustes?estado=error&detalle=sin-refresh-token')
  }

  await guardarCredencial(
    cuerpo.refresh_token!,
    (cuerpo.scope ?? '').split(' ').filter(Boolean),
    usuario.correo,
  )

  redirect('/ajustes?estado=autorizado')
}
