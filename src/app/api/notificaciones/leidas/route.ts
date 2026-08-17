import { requerirUsuario } from '@/lib/auth/guard'
import { marcarLeidas, marcarLeidasDeFila } from '@/lib/notificaciones/almacen'

/**
 * Marca avisos como leídos para **el usuario de la sesión**.
 *
 * El correo sale de la sesión y nunca del cuerpo: si viniera del cuerpo,
 * cualquiera podría vaciarle los pendientes a otra persona de la mesa.
 *
 * Acepta `{ ids }` para avisos concretos —el panel— o `{ fila }` para todo lo de un
 * caso, que es lo que hace la vista del caso al abrirse.
 */
export async function POST(request: Request) {
  const usuario = await requerirUsuario()

  let cuerpo: { ids?: unknown; fila?: unknown }
  try {
    cuerpo = (await request.json()) as { ids?: unknown; fila?: unknown }
  } catch {
    return Response.json({ ok: false, error: 'Cuerpo inválido.' }, { status: 400 })
  }

  if (Number.isInteger(cuerpo.fila)) {
    await marcarLeidasDeFila(usuario.correo, cuerpo.fila as number)
  } else if (Array.isArray(cuerpo.ids)) {
    await marcarLeidas(usuario.correo, cuerpo.ids.filter((n): n is number => Number.isInteger(n)))
  }

  return Response.json({ ok: true })
}
