/**
 * Formato con el que la hoja "Respuestas de formulario 1" guarda las fechas:
 * día y mes sin cero inicial, hora sin cero inicial, minutos y segundos con dos dígitos.
 */
export function formatearFechaHoja(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`
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
      return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
    }
  }
  return textoCrudo.trim().split(/\s+/)[0] || '—'
}
