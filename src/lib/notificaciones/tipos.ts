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
  tipo: TipoNotificacion
  fila: number
  folio: string | null
  titulo: string
  detalle: string | null
  clave: string
}
