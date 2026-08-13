/**
 * La hoja declara `timeZone: Etc/GMT+6` y `locale: es_MX`: seis horas detrás de
 * UTC, fijas, sin horario de verano —México lo eliminó en 2022—. El servidor, en
 * cambio, corre en UTC cuando está en Vercel, así que `new Date()` y los getters
 * locales no dan la hora que la mesa ve en la hoja.
 *
 * Este módulo es el único lugar del sistema que conoce ese desfase. Se resuelve
 * con aritmética sobre el instante y los getters UTC, y no con `Intl`, para que
 * el resultado no dependa del ICU del entorno: esa dependencia ya nos obligó a
 * armar a mano los nombres de mes en `fecha.ts`.
 */
export const HORAS_DETRAS_DE_UTC = 6

const MS_POR_HORA = 60 * 60 * 1000

/** El mes va de 1 a 12, como se lee en la hoja, no como lo numera `Date`. */
export type PartesDeFecha = {
  anio: number
  mes: number
  dia: number
  horas: number
  minutos: number
  segundos: number
}

/** Los componentes de calendario que la mesa ve en la hoja para ese instante. */
export function partesDeLaMesa(instante: Date): PartesDeFecha {
  const corrido = new Date(instante.getTime() - HORAS_DETRAS_DE_UTC * MS_POR_HORA)
  return {
    anio: corrido.getUTCFullYear(),
    mes: corrido.getUTCMonth() + 1,
    dia: corrido.getUTCDate(),
    horas: corrido.getUTCHours(),
    minutos: corrido.getUTCMinutes(),
    segundos: corrido.getUTCSeconds(),
  }
}

/** El inverso: el instante real que corresponde a una hora de pared de la hoja. */
export function instanteDeLaMesa(partes: PartesDeFecha): Date {
  const utc = Date.UTC(
    partes.anio,
    partes.mes - 1,
    partes.dia,
    partes.horas,
    partes.minutos,
    partes.segundos,
  )
  return new Date(utc + HORAS_DETRAS_DE_UTC * MS_POR_HORA)
}

/**
 * La medianoche del día de la mesa, en milisegundos, para contar días naturales
 * sin que la hora estorbe y sin que el corte de las 18:00 locales mueva la
 * cuenta.
 */
export function diaDeLaMesa(instante: Date): number {
  const { anio, mes, dia } = partesDeLaMesa(instante)
  return Date.UTC(anio, mes - 1, dia)
}
