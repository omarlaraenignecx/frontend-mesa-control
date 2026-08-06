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
 * Tener cuenta del dominio no basta para entrar (RNF-02): además hay que estar
 * en la lista explícita de personas autorizadas y estar activo.
 */
export function resolverAcceso(
  correo: string | null | undefined,
  autorizados: UsuarioAutorizado[],
): ResultadoAcceso {
  if (!correo || !correo.trim()) return { autorizado: false, motivo: 'sin-correo' }

  const normalizado = normalizarCorreo(correo)
  if (!normalizado.endsWith(`@${DOMINIO_PERMITIDO}`)) {
    return { autorizado: false, motivo: 'dominio-ajeno' }
  }

  const usuario = autorizados.find((u) => normalizarCorreo(u.correo) === normalizado)
  if (!usuario) return { autorizado: false, motivo: 'fuera-de-allowlist' }
  if (!usuario.activo) return { autorizado: false, motivo: 'inactivo' }

  return { autorizado: true, usuario }
}
