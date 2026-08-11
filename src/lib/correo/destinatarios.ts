import type { Caso } from '@/lib/casos/caso'

export type Destinos = { para: string; cc: string[] }

const FORMATO = /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/

export function esCorreoValido(v: string): boolean {
  return FORMATO.test(v.trim())
}

const normalizar = (v: string) => v.trim().toLowerCase()

/**
 * El destinatario principal es el solicitante y no se puede cambiar: el PRD
 * garantiza que la herramienta solo escribe a quien declaró el formulario.
 *
 * El ejecutivo comercial entra en copia únicamente si es otra persona; en la
 * mayoría de los casos que revisamos ambos correos coinciden, y duplicar el
 * envío se vería como un error desde la agencia.
 */
export function resolverDestinos(
  caso: Pick<Caso, 'correoSolicitante'>,
  correoEjecutivo: string | null,
  copiasExtra: string[],
): Destinos {
  const para = caso.correoSolicitante?.trim()
  if (!para || !esCorreoValido(para)) {
    throw new Error('El caso no tiene correo de solicitante válido; no se puede escribir.')
  }

  const vistos = new Set([normalizar(para)])
  const cc: string[] = []

  for (const candidato of [correoEjecutivo, ...copiasExtra]) {
    const limpio = candidato?.trim()
    if (!limpio || !esCorreoValido(limpio)) continue
    if (vistos.has(normalizar(limpio))) continue
    vistos.add(normalizar(limpio))
    cc.push(limpio)
  }

  return { para, cc }
}
