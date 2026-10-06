import { esSiniestro } from './area'
import { estaVivo, parsearFechaHoja, type Caso } from './caso'

/**
 * Cuánto tardó la mesa en atender un caso: horas naturales desde que llegó la
 * respuesta del formulario (A) hasta su atención final (KD). Se guarda en la
 * columna «Tiempo de atención (horas)» para que el área saque el promedio en la
 * hoja.
 *
 * Son horas naturales —noches y fines de semana cuentan— porque las hábiles
 * exigirían un horario que nadie ha definido, y el número puro es lo que deja
 * que `PROMEDIO` y las tablas dinámicas funcionen sin formato de duración.
 */

const MS_POR_HORA = 60 * 60 * 1000

/** Una fecha de la hoja con hora. «5/8/2026» a secas no sirve para medir horas. */
const TRAE_HORA = /\s\d{1,2}:\d{2}/

export function horasDeAtencion(recibido: Date, cierre: Date): number | null {
  const ms = cierre.getTime() - recibido.getTime()
  // Un cierre anterior a la llegada es un dato mal capturado, no un tiempo.
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.round((ms / MS_POR_HORA) * 100) / 100
}

/**
 * Las horas que hay que escribir, o null si no toca.
 *
 * No exige que el cierre ocurra en este guardado: un caso que alguien cerró a
 * mano en la hoja se completa la próxima vez que se guarde desde la aplicación.
 * Tampoco recalcula: si la columna ya tiene dato —un cierre anterior, o algo que
 * el área corrigió— se respeta, igual que la fecha de KD.
 */
export function tiempoASellar(
  caso: Pick<Caso, 'area' | 'marcaTemporalTexto' | 'tiempoAtencion'>,
  estatusFinal: string | null | undefined,
  fechaCierreTexto: string | null | undefined,
): number | null {
  if (esSiniestro(caso)) return null
  if (estaVivo({ estatusFinal: estatusFinal ?? null })) return null
  if (caso.tiempoAtencion?.trim()) return null
  if (!fechaCierreTexto || !TRAE_HORA.test(fechaCierreTexto.trim())) return null
  const recibido = parsearFechaHoja(caso.marcaTemporalTexto)
  const cierre = parsearFechaHoja(fechaCierreTexto)
  if (!recibido || !cierre) return null
  return horasDeAtencion(recibido, cierre)
}
