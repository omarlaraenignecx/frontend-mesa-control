import { diaDeLaMesa } from '@/lib/reloj'
import { fechaDe, type Caso } from './caso'

export type NivelSemaforo = 'verde' | 'ambar' | 'rojo' | 'desconocido'

/**
 * Colores del semáforo según el Estatus Final que la mesa captura en la hoja
 * (columna KA). No mide antigüedad: el área pidió que el punto diga en qué
 * terminó el caso, no cuánto lleva esperando, que es lo que informa la columna
 * de días.
 *
 * Las llaves están normalizadas —sin acentos, en minúsculas— porque la
 * validación de la hoja dice "Tramite" pero el histórico tiene filas con
 * "Trámite" capturadas antes de que esa validación existiera.
 */
const POR_ESTATUS: Record<string, NivelSemaforo> = {
  concluida: 'verde',
  improcedente: 'rojo',
  tramite: 'ambar',
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Días naturales desde que llegó la petición. Alimenta la columna de espera y el
 * corte de la ventana de la cola; ya no decide el color del semáforo.
 */
export function diasDeEspera(caso: Pick<Caso, 'marcaTemporalIso'>, hoy: Date): number | null {
  const recibido = fechaDe(caso)
  if (!recibido) return null
  // Los dos extremos se llevan al día de la mesa: con la medianoche local del
  // servidor, las últimas seis horas de cada día contaban un día de más.
  return Math.max(0, Math.round((diaDeLaMesa(hoy) - diaDeLaMesa(recibido)) / MS_POR_DIA))
}

/**
 * Devuelve null cuando la hoja no trae estatus: la interfaz dibuja el círculo
 * hueco, que se lee como "todavía nadie lo resolvió". Un valor fuera de la
 * validación se pinta gris en lugar de reventar, porque el histórico tiene 570
 * filas con "N/A" y algún texto suelto.
 */
export function semaforoDe(caso: Pick<Caso, 'estatusFinal'>): NivelSemaforo | null {
  const clave = normalizar(caso.estatusFinal ?? '')
  if (!clave) return null
  return POR_ESTATUS[clave] ?? 'desconocido'
}
