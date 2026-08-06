import { redirect } from 'next/navigation'
import { SinAutorizacionError, usuarioActual } from './usuarios'

/**
 * Para páginas: obtiene al usuario o lo manda a la pantalla de rechazo con el
 * motivo. Se usa en lugar de usuarioActual() cuando hay una interfaz que mostrar.
 */
export async function requerirUsuario() {
  try {
    return await usuarioActual()
  } catch (e) {
    if (e instanceof SinAutorizacionError) {
      redirect(e.motivo === 'sin-sesion' ? '/login' : `/sin-acceso?motivo=${e.motivo}`)
    }
    throw e
  }
}

export async function requerirAdmin() {
  const usuario = await requerirUsuario()
  if (usuario.rol !== 'admin') redirect('/cola')
  return usuario
}
