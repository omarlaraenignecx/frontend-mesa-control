import { fechaDe, type Caso } from './caso'

export type NivelSemaforo = 'verde' | 'ambar' | 'rojo'

/**
 * Días de espera a partir de los cuales cambia el indicador. Sujetos a
 * validación con Keynor y Norma, que conocen el SLA real del área.
 */
export const UMBRALES_SEMAFORO = { ambar: 3, rojo: 6 }

const MS_POR_DIA = 24 * 60 * 60 * 1000

export function diasDeEspera(caso: Pick<Caso, 'marcaTemporalIso'>, hoy: Date): number | null {
  const recibido = fechaDe(caso)
  if (!recibido) return null
  const desde = new Date(recibido.getFullYear(), recibido.getMonth(), recibido.getDate())
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.max(0, Math.round((hasta.getTime() - desde.getTime()) / MS_POR_DIA))
}

export function semaforoDe(caso: Pick<Caso, 'marcaTemporalIso'>, hoy: Date): NivelSemaforo | null {
  const dias = diasDeEspera(caso, hoy)
  if (dias === null) return null
  if (dias >= UMBRALES_SEMAFORO.rojo) return 'rojo'
  if (dias >= UMBRALES_SEMAFORO.ambar) return 'ambar'
  return 'verde'
}
