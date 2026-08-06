import { auth } from '@/auth'
import { getDb, schema } from '@/db'
import type { UsuarioAutorizado } from './allowlist'

export async function listarAutorizados(): Promise<UsuarioAutorizado[]> {
  const filas = await getDb().select().from(schema.usuariosAutorizados)
  return filas.map((f) => ({
    correo: f.correo,
    nombreEnHoja: f.nombreEnHoja,
    rol: f.rol,
    activo: f.activo,
  }))
}

/**
 * Quién opera en este momento. Es la función que usan todas las etapas para
 * atribuir bloqueos, guardados, bitácora y el valor de la columna KE.
 */
export async function usuarioActual() {
  const sesion = await auth()
  const correo = sesion?.user?.email
  if (!correo) throw new Error('No hay sesión activa.')
  return {
    correo,
    rol: sesion.user.rol,
    nombreEnHoja: sesion.user.nombreEnHoja,
  }
}
