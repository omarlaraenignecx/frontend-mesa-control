import { formatearFechaHoja } from '@/lib/fecha'
import { estaVivo, type Caso } from './caso'

/**
 * Si este guardado es el que cierra el caso. Solo cuenta como cierre la
 * transición de abierto a terminal: volver a guardar un caso ya cerrado no
 * vuelve a sellar la fecha.
 */
export function seCierraAhora(
  caso: Pick<Caso, 'estatusFinal'>,
  estatusFinalPropuesto: string | undefined,
): boolean {
  if (!estatusFinalPropuesto) return false
  const quedaCerrado = !estaVivo({ estatusFinal: estatusFinalPropuesto })
  return quedaCerrado && estaVivo(caso)
}

/**
 * Fecha que se escribe en KD al cerrar, o null si no hay que sellar nada.
 *
 * Es una columna que hoy la mesa teclea a mano y de la que depende el cálculo
 * de SLA de la hoja. Si alguien ya la capturó, se respeta.
 */
export function fechaDeCierreASellar(
  caso: Pick<Caso, 'estatusFinal' | 'fechaAtencionFinal'>,
  estatusFinalPropuesto: string | undefined,
  cuando: Date,
): string | null {
  if (!seCierraAhora(caso, estatusFinalPropuesto)) return null
  if (caso.fechaAtencionFinal?.trim()) return null
  return formatearFechaHoja(cuando)
}
