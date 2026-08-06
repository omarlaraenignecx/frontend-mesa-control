/**
 * Formato con el que la hoja "Respuestas de formulario 1" guarda las fechas:
 * día y mes sin cero inicial, hora sin cero inicial, minutos y segundos con dos dígitos.
 */
export function formatearFechaHoja(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`
}
