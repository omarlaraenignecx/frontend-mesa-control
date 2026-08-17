import { requerirUsuario } from '@/lib/auth/guard'
import { sondeoDe } from '@/lib/notificaciones/almacen'

/** El navegador la llama cada 30 segundos: cachearla la volvería inútil. */
export const dynamic = 'force-dynamic'

/**
 * Lo que el navegador necesita para pintar la campanita, el panel y las insignias.
 *
 * Lo pendiente es de quien tiene la sesión: el correo sale de ahí y nunca de un
 * parámetro, para que nadie pueda mirar —ni marcar— los avisos de otra persona.
 */
export async function GET() {
  const usuario = await requerirUsuario()
  return Response.json(await sondeoDe(usuario.correo))
}
