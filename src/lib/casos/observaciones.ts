import { formatearFechaHoja } from '@/lib/fecha'

/**
 * La celda KJ es la bitácora real que usa la mesa hoy: nunca se sobrescribe.
 * La entrada nueva va arriba, encabezada por fecha y autor, y todo lo anterior
 * se conserva tal cual, para que otra persona pueda retomar un caso a medias
 * (RF-12).
 */
export function componerObservaciones(
  existente: string | null,
  nota: string,
  autor: string,
  cuando: Date,
): string {
  const limpia = nota.trim()
  if (!limpia) return existente ?? ''
  const entrada = `${formatearFechaHoja(cuando)} ${autor}: ${limpia}`
  const previo = existente?.trim()
  return previo ? `${entrada}\n${previo}` : entrada
}
