import { requerirUsuario } from '@/lib/auth/guard'
import { moduloValido } from '@/lib/modulos/modulo'
import { sondeoDe } from '@/lib/notificaciones/almacen'

/** El navegador la llama cada 30 segundos: cachearla la volvería inútil. */
export const dynamic = 'force-dynamic'

/**
 * Lo que el navegador necesita para pintar la campanita, el panel y las insignias.
 *
 * Lo pendiente es de quien tiene la sesión: el correo sale de ahí y nunca de un
 * parámetro, para que nadie pueda mirar —ni marcar— los avisos de otra persona.
 *
 * El módulo sí viaja en la URL, y puede: no es un permiso, es qué pantalla está
 * preguntando. Cualquier usuario autorizado entra a los dos módulos, así que no hay
 * nada que proteger ahí; lo que evita es que la campanita de la mesa timbre por un
 * siniestro y al revés.
 */
export async function GET(request: Request) {
  const usuario = await requerirUsuario()
  const modulo = moduloValido(new URL(request.url).searchParams.get('modulo'))
  return Response.json(await sondeoDe(usuario.correo, modulo))
}
