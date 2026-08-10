import type { Adjunto } from '@/lib/google/drive-links'

/**
 * El caso es un objeto plano y serializable a JSON, sin excepciones.
 *
 * La cola se cachea y la caché guarda JSON: un Date volvería convertido en
 * string y cualquier llamada a getFullYear() reventaría en la segunda carga.
 * Por eso la fecha de recepción viaja como texto ISO y se convierte a Date solo
 * donde se necesita, con fechaDe().
 */
export type Caso = {
  fila: number
  folio: string | null
  marcaTemporalIso: string | null
  marcaTemporalTexto: string
  tipoTramite: string | null
  tipoNegocio: string | null
  nombreSolicitante: string | null
  correoSolicitante: string | null
  agencia: string | null
  motivo: string | null
  aseguradoraDeclarada: string | null
  nombreCliente: string | null
  estatusInicial: string | null
  estatusFinal: string | null
  quienAtendio: string | null
  folioInterno: string | null
  aseguradoraSeguimiento: string | null
  teniaPermisos: string | null
  causaSeguimiento: string | null
  observaciones: string | null
  fechaRespuestaCorreo: string | null
  fechaAtencionFinal: string | null
  adjuntos: Adjunto[]
  /** Campos con dato que el mapeador no clasificó; se muestran igual (RF-03). */
  camposExtra: { etiqueta: string; valor: string }[]
}

export const ESTATUS_TERMINALES = ['concluida', 'improcedente'] as const

/** La columna A guarda las fechas como D/M/YYYY H:mm:ss, no en ISO. */
export function parsearFechaHoja(texto: string): Date | null {
  if (!texto?.trim()) return null
  const m = texto
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!m) return null
  const [, d, mes, a, h = '0', min = '0', s = '0'] = m
  const fecha = new Date(Number(a), Number(mes) - 1, Number(d), Number(h), Number(min), Number(s))
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

/** Fecha de recepción como Date. Devuelve null si no hay fecha o no es legible. */
export function fechaDe(caso: Pick<Caso, 'marcaTemporalIso'>): Date | null {
  if (!caso.marcaTemporalIso) return null
  const d = new Date(caso.marcaTemporalIso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function estaVivo(caso: Pick<Caso, 'estatusFinal'>): boolean {
  const estatus = (caso.estatusFinal ?? '').trim().toLowerCase()
  if (!estatus) return true
  return !ESTATUS_TERMINALES.includes(estatus as (typeof ESTATUS_TERMINALES)[number])
}

export function sinFolio(caso: Pick<Caso, 'folio'>): boolean {
  return !caso.folio?.trim()
}
