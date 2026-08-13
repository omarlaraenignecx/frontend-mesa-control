/**
 * El folio de atención (columna `JY`) lo llenaba la mesa a mano, arrastrando la
 * serie hacia abajo. Ese arrastre es la causa de los 210 folios duplicados que
 * tiene la hoja: cuando entra una respuesta, el formulario **inserta** la fila
 * arriba de las que ya venían pre-arrastradas, así que continuar desde el folio
 * de la fila de arriba repite un número que ya existe más abajo.
 *
 * Por eso la serie se continúa desde el **máximo de toda la columna**. El
 * resultado puede quedar visualmente desordenado —un 7055 arriba de un 7052—,
 * pero nunca duplica, y el folio es un identificador, no un orden.
 */

/** Más de esto en una sola tanda significa que algo pasó con la hoja. */
export const TOPE_POR_TANDA = 50

/**
 * El folio con el que sigue la serie, o null si la columna no trae ni un valor
 * numérico: en ese caso no se escribe nada y se pide mirar la hoja.
 */
export function siguienteFolio(valoresDeLaColumna: string[]): number | null {
  const numeros = valoresDeLaColumna
    .map((v) => (v ?? '').trim())
    .filter((v) => /^\d+$/.test(v))
    .map(Number)
  if (numeros.length === 0) return null
  return Math.max(...numeros) + 1
}

/**
 * Reparte consecutivos entre las filas sin folio, de la más antigua a la más
 * reciente, que es el orden en que la mesa las habría llenado a mano.
 */
export function asignarFolios(
  filasSinFolio: number[],
  valoresDeLaColumna: string[],
): { fila: number; folio: string }[] {
  const inicio = siguienteFolio(valoresDeLaColumna)
  if (inicio === null) return []
  return [...filasSinFolio]
    .sort((a, b) => a - b)
    .map((fila, i) => ({ fila, folio: String(inicio + i) }))
}
