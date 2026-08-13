import { partesDeLaMesa } from './reloj'

/**
 * Formato con el que la hoja "Respuestas de formulario 1" guarda las fechas:
 * día y mes sin cero inicial, hora sin cero inicial, minutos y segundos con dos
 * dígitos. La hora es la de la mesa, no la del servidor, que en Vercel es UTC.
 */
export function formatearFechaHoja(instante: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  const { dia, mes, anio, horas, minutos, segundos } = partesDeLaMesa(instante)
  return `${dia}/${mes}/${anio} ${horas}:${dos(minutos)}:${dos(segundos)}`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * Día de recepción para la tabla de la cola: sin la hora, que en una lista larga
 * solo estorba.
 *
 * El mes se arma con la lista de arriba en lugar de `toLocaleDateString`: la
 * salida de Intl depende del ICU del entorno y cambia entre la máquina de
 * desarrollo y el servidor, agregando puntos o mayúsculas según la versión.
 */
export function fechaCorta(iso: string | null, textoCrudo: string): string {
  if (iso) {
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) {
      const { dia, mes, anio } = partesDeLaMesa(d)
      return `${dia} ${MESES[mes - 1]} ${anio}`
    }
  }
  return textoCrudo.trim().split(/\s+/)[0] || '—'
}
