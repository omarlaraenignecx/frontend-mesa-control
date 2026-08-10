import type { CampoEscribible } from '@/lib/google/sheet-writer'
import type { Caso } from './caso'

export type Seguimiento = Partial<Record<CampoEscribible, string>>

export type Cambio = {
  campo: CampoEscribible
  etiqueta: string
  anterior: string | null
  nuevo: string
}

export const ETIQUETAS_SEGUIMIENTO: Record<CampoEscribible, string> = {
  estatusInicial: 'Estatus inicial',
  estatusFinal: 'Estatus final',
  fechaRespuestaCorreo: 'Fecha de respuesta por correo',
  fechaAtencionFinal: 'Fecha de atención final',
  quienAtendio: 'Quien atendió',
  folioInterno: 'Folio de aseguradora',
  aseguradoraSeguimiento: 'Aseguradora',
  teniaPermisos: '¿El ejecutivo tenía permisos?',
  causaSeguimiento: 'Causa',
  observaciones: 'Observaciones',
}

/**
 * Solo los campos cuyo valor realmente cambia. Es lo que se le muestra al
 * usuario para confirmar antes de escribir, y lo que se registra en la bitácora:
 * si nada cambió, no se toca la hoja.
 */
export function calcularDiff(caso: Caso, propuesto: Seguimiento): Cambio[] {
  const cambios: Cambio[] = []
  for (const [campo, valor] of Object.entries(propuesto) as [CampoEscribible, string][]) {
    if (valor === undefined) continue
    const nuevo = valor.trim()
    const anterior = (caso[campo] as string | null)?.trim() || null
    if ((anterior ?? '') === nuevo) continue
    cambios.push({ campo, etiqueta: ETIQUETAS_SEGUIMIENTO[campo], anterior, nuevo })
  }
  return cambios
}
