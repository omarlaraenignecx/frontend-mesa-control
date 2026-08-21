export const DOMINIO_PERMITIDO = 'gplusseguros.mx'

export type UsuarioAutorizado = {
  correo: string
  nombreEnHoja: string | null
  rol: 'operador' | 'admin'
  activo: boolean
}

export type ResultadoAcceso =
  | { autorizado: true; usuario: UsuarioAutorizado }
  | { autorizado: false; motivo: 'sin-correo' | 'dominio-ajeno' | 'fuera-de-allowlist' | 'inactivo' }

export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase()
}

/**
 * Quién entra: **solo** quien está en la lista explícita de personas autorizadas y
 * está activo. Tener cuenta del dominio nunca ha bastado, y desde el 21 de agosto de
 * 2026 tampoco es requisito.
 *
 * El cambio lo pidió el área por una razón concreta: quien desarrolla la herramienta
 * es externo y entraba con la cuenta compartida de administrador, así que la bitácora
 * le atribuía a `mesadecontrol@` todo lo que hacía una persona identificable. Una
 * cuenta compartida es peor control que una lista nominal, aunque el dominio cuadre.
 *
 * El dominio sigue teniendo un papel, pero solo de cortesía: decide **qué mensaje** ve
 * quien no está en la lista. A alguien de la empresa le sirve saber que hay que
 * agregarlo; a alguien de fuera, que se equivocó de cuenta.
 */
export function resolverAcceso(
  correo: string | null | undefined,
  autorizados: UsuarioAutorizado[],
): ResultadoAcceso {
  if (!correo || !correo.trim()) return { autorizado: false, motivo: 'sin-correo' }

  const normalizado = normalizarCorreo(correo)
  const usuario = autorizados.find((u) => normalizarCorreo(u.correo) === normalizado)

  if (!usuario) {
    return {
      autorizado: false,
      motivo: normalizado.endsWith(`@${DOMINIO_PERMITIDO}`)
        ? 'fuera-de-allowlist'
        : 'dominio-ajeno',
    }
  }
  if (!usuario.activo) return { autorizado: false, motivo: 'inactivo' }

  return { autorizado: true, usuario }
}
