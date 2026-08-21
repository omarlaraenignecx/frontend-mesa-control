import type { Modulo } from '@/lib/modulos/modulo'

export type TipoNotificacion = 'caso_nuevo' | 'correo_recibido'

export type Notificacion = {
  id: number
  tipo: TipoNotificacion
  fila: number
  folio: string | null
  titulo: string
  detalle: string | null
  creadoEnIso: string
}

/** Lo que devuelve el sondeo del navegador. */
export type Sondeo = {
  /** El id más alto que existe para esta hoja, leído o no. Detecta lo que llegó. */
  maxId: number
  noLeidas: Notificacion[]
  /** Mensajes de correo sin leer por fila, para las insignias de la tabla. */
  correosPorFila: Record<number, number>
}

export type NotificacionNueva = {
  /**
   * A qué módulo va el aviso. Se sella al crearlo porque deducirlo en cada sondeo
   * exigiría releer la hoja para saber el área de la fila, treinta veces por minuto
   * y por persona.
   */
  modulo: Modulo
  tipo: TipoNotificacion
  fila: number
  folio: string | null
  titulo: string
  detalle: string | null
  clave: string
}
