import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * Esta base guarda solo metadatos operativos. El seguimiento del negocio vive
 * en el Google Sheet, que es la fuente única de datos.
 */

export const usuariosAutorizados = pgTable('usuarios_autorizados', {
  correo: text('correo').primaryKey(),
  nombreEnHoja: text('nombre_en_hoja'),
  rol: text('rol', { enum: ['operador', 'admin'] }).notNull(),
  activo: boolean('activo').notNull().default(true),
})

export const credencialMesa = pgTable('credencial_mesa', {
  id: integer('id').primaryKey().default(1),
  refreshTokenCifrado: text('refresh_token_cifrado').notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull(),
  autorizadoPor: text('autorizado_por').notNull(),
  autorizadoEn: timestamp('autorizado_en', { withTimezone: true }).notNull().defaultNow(),
  ultimoUso: timestamp('ultimo_uso', { withTimezone: true }),
  ultimoError: text('ultimo_error'),
})

export const bloqueos = pgTable('bloqueos', {
  fila: integer('fila').primaryKey(),
  correoDueno: text('correo_dueno').notNull(),
  tomadoEn: timestamp('tomado_en', { withTimezone: true }).notNull().defaultNow(),
  ultimoLatido: timestamp('ultimo_latido', { withTimezone: true }).notNull().defaultNow(),
})

export const casosHilo = pgTable('casos_hilo', {
  fila: integer('fila').primaryKey(),
  threadId: text('thread_id').notNull(),
  asuntoNormalizado: text('asunto_normalizado').notNull(),
  folioUsado: text('folio_usado').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
})

export const bitacora = pgTable('bitacora', {
  id: serial('id').primaryKey(),
  fila: integer('fila').notNull(),
  folio: text('folio'),
  correoUsuario: text('correo_usuario').notNull(),
  campo: text('campo').notNull(),
  valorAnterior: text('valor_anterior'),
  valorNuevo: text('valor_nuevo'),
  tipo: text('tipo', {
    enum: ['guardado', 'bloqueo_forzado', 'folio_capturado'],
  }).notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
})

export const plantillasCorreo = pgTable(
  'plantillas_correo',
  {
    id: serial('id').primaryKey(),
    tipoTramite: text('tipo_tramite').notNull(),
    asuntoPlantilla: text('asunto_plantilla').notNull(),
    cuerpoHtml: text('cuerpo_html').notNull(),
    activa: boolean('activa').notNull().default(true),
    actualizadaPor: text('actualizada_por'),
    actualizadaEn: timestamp('actualizada_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('plantillas_tipo_tramite_idx').on(t.tipoTramite)],
)

export const eventosBi = pgTable('eventos_bi', {
  id: serial('id').primaryKey(),
  tipo: text('tipo', {
    enum: [
      'caso_visualizado',
      'caso_tomado',
      'conversacion_iniciada',
      'respuesta_enviada',
      'cadena_reenviada',
      'caso_guardado',
      'caso_cerrado',
      'importacion_solicitada',
    ],
  }).notNull(),
  fila: integer('fila'),
  folio: text('folio'),
  tipoTramite: text('tipo_tramite'),
  estatusResultante: text('estatus_resultante'),
  motivo: text('motivo'),
  correoUsuario: text('correo_usuario').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
})
