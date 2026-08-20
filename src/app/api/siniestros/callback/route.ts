import { redirect } from 'next/navigation'
import { DOMINIO_PERMITIDO, normalizarCorreo } from '@/lib/auth/allowlist'
import { usuarioActual } from '@/lib/auth/usuarios'
import { guardarCredencialSiniestros } from '@/lib/siniestros/credencial'
import { activarCuenta, cuentaActiva, guardarFicha, leerFicha } from '@/lib/siniestros/ejecutivos'

const AJUSTES = '/siniestros/ajustes'

function conError(detalle: string): never {
  redirect(`${AJUSTES}?estado=error&detalle=${encodeURIComponent(detalle)}`)
}

/**
 * Qué buzón se autorizó de verdad, según Google.
 *
 * Se pregunta en lugar de dar por hecho que es el de la sesión, y no es paranoia: la
 * pantalla de consentimiento de Google deja elegir cuenta. Alguien firmado en la
 * aplicación como Keynor puede conceder ahí el buzón de José —o al revés—, y guardar la
 * credencial a nombre equivocado haría que el módulo enviara desde un buzón atribuido a
 * otra persona, con la firma de otra persona.
 */
async function buzonAutorizado(accessToken: string): Promise<string | null> {
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!r.ok) return null
  const cuerpo = (await r.json()) as { emailAddress?: string }
  return cuerpo.emailAddress ?? null
}

export async function GET(request: Request) {
  const usuario = await usuarioActual()

  const url = new URL(request.url)
  const codigo = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  if (error) conError(error)
  if (!codigo) conError('sin-codigo')

  const respuesta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: codigo!,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: `${url.origin}/api/siniestros/callback`,
    }).toString(),
  })

  const cuerpo = (await respuesta.json().catch(() => ({}))) as {
    refresh_token?: string
    access_token?: string
    scope?: string
  }

  if (!respuesta.ok || !cuerpo.refresh_token || !cuerpo.access_token) {
    conError('sin-refresh-token')
  }

  const buzon = await buzonAutorizado(cuerpo.access_token!)
  if (!buzon) conError('sin-buzon')

  const correo = normalizarCorreo(buzon!)
  if (!correo.endsWith(`@${DOMINIO_PERMITIDO}`)) {
    // Una cuenta personal de Gmail no puede ser el buzón de un área de la empresa.
    conError('dominio-ajeno')
  }

  await guardarCredencialSiniestros(
    correo,
    cuerpo.refresh_token!,
    (cuerpo.scope ?? '').split(' ').filter(Boolean),
    usuario.correo,
  )

  // Una cuenta autorizada sin ficha no podría firmar; se deja una mínima con el
  // correo, que la persona completa en la misma pantalla.
  if (!(await leerFicha(correo))) {
    await guardarFicha(
      { correo, nombre: correo, puesto: 'Ejecutivo de siniestros', telefono: '' },
      usuario.correo,
    )
  }

  // La primera cuenta autorizada queda designada: si no, el módulo tendría una
  // credencial válida y seguiría diciendo que no hay ninguna.
  if ((await cuentaActiva()) === null) await activarCuenta(correo)

  redirect(`${AJUSTES}?estado=autorizado&buzon=${encodeURIComponent(correo)}`)
}
