import { getDb, schema } from '@/db'

type TipoEvento =
  | 'caso_visualizado'
  | 'caso_tomado'
  | 'conversacion_iniciada'
  | 'respuesta_enviada'
  | 'caso_guardado'
  | 'caso_cerrado'
  | 'importacion_solicitada'

/**
 * Eventos de la sección 11 del PRD, insumo del reporteo de la Fase 2.
 *
 * Registrar un evento nunca debe tumbar la operación: si falla, se anota en el
 * log y el usuario sigue trabajando. Un evento perdido es un dato de BI menos;
 * una excepción aquí sería un caso que no se pudo guardar.
 */
export async function emitirEvento(evento: {
  tipo: TipoEvento
  fila?: number
  folio?: string | null
  tipoTramite?: string | null
  estatusResultante?: string | null
  motivo?: string | null
  correoUsuario: string
}): Promise<void> {
  try {
    await getDb()
      .insert(schema.eventosBi)
      .values({
        tipo: evento.tipo,
        fila: evento.fila ?? null,
        folio: evento.folio ?? null,
        tipoTramite: evento.tipoTramite ?? null,
        estatusResultante: evento.estatusResultante ?? null,
        motivo: evento.motivo ?? null,
        correoUsuario: evento.correoUsuario,
      })
  } catch (e) {
    console.error('No se pudo registrar el evento de BI', evento.tipo, e)
  }
}
