import { auth } from '@/auth'
import { getDb, schema } from '@/db'
import { resolverAcceso, type UsuarioAutorizado } from './allowlist'

export async function listarAutorizados(): Promise<UsuarioAutorizado[]> {
  const filas = await getDb().select().from(schema.usuariosAutorizados)
  return filas.map((f) => ({
    correo: f.correo,
    nombreEnHoja: f.nombreEnHoja,
    rol: f.rol,
    activo: f.activo,
  }))
}

export class SinAutorizacionError extends Error {
  constructor(readonly motivo: string) {
    super('La cuenta no está autorizada para usar la Mesa de Control.')
    this.name = 'SinAutorizacionError'
  }
}

/**
 * Quién opera en este momento. Es la función que usan todas las etapas para
 * atribuir bloqueos, guardados, bitácora y el valor de la columna KE.
 *
 * Revalida contra la allowlist en cada llamada, no confía solo en el token: así
 * desactivar a alguien en la base surte efecto en su siguiente carga de página
 * sin esperar a que caduque su sesión.
 */
export async function usuarioActual() {
  const sesion = await auth()
  const correo = sesion?.user?.email
  if (!correo) throw new SinAutorizacionError('sin-sesion')

  const resultado = resolverAcceso(correo, await listarAutorizados())
  if (!resultado.autorizado) throw new SinAutorizacionError(resultado.motivo)

  return {
    correo: resultado.usuario.correo,
    rol: resultado.usuario.rol,
    nombreEnHoja: resultado.usuario.nombreEnHoja,
  }
}
