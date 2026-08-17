import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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

/**
 * Sin uso desde el 11 de agosto de 2026: el área pidió que los casos queden
 * abiertos para todos, marcados con quién los atiende en la columna de la hoja.
 * La tabla se queda porque borrarla es una migración destructiva y no estorba;
 * quitarla es decisión del área. Nada de la aplicación la lee ni la escribe.
 */
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
  // 'bloqueo_forzado' ya no se escribe, pero hay filas históricas con ese valor
  // y quitarlo del enum haría ilegibles esas entradas de la bitácora.
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

/**
 * Archivos que la mesa sube a un caso. El contenido vive en el Drive de
 * `mesadecontrol@` y aquí queda el registro: la hoja no puede guardar el enlace
 * porque sus columnas de adjuntos están protegidas sin editores.
 */
export const archivosCaso = pgTable('archivos_caso', {
  id: serial('id').primaryKey(),
  /**
   * La fila sola no identifica un caso: esta base es la misma para desarrollo y
   * producción, y la fila 7181 de la copia es un caso distinto al de la hoja
   * real. Sin la hoja, un archivo subido desde `pnpm dev` aparecería en un caso
   * de producción que no tiene nada que ver.
   */
  sheetId: text('sheet_id').notNull(),
  fila: integer('fila').notNull(),
  driveFileId: text('drive_file_id').notNull(),
  nombre: text('nombre').notNull(),
  tipo: text('tipo').notNull(),
  bytes: integer('bytes').notNull(),
  subidoPor: text('subido_por').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
})

/** Configuración interna en pares clave-valor, como el id de la carpeta de Drive. */
export const ajustesApp = pgTable('ajustes_app', {
  clave: text('clave').primaryKey(),
  valor: text('valor').notNull(),
})

/**
 * Avisos para la mesa: una petición nueva en la hoja o una respuesta de correo en
 * un caso. Los produce la app cuando n8n la despierta; el navegador los sondea.
 *
 * `clave` es la idempotencia (ver `lib/notificaciones/claves.ts`) y `sheet_id`
 * separa la copia de la hoja real, que comparten esta base.
 */
export const notificaciones = pgTable(
  'notificaciones',
  {
    id: serial('id').primaryKey(),
    sheetId: text('sheet_id').notNull(),
    tipo: text('tipo', { enum: ['caso_nuevo', 'correo_recibido'] }).notNull(),
    fila: integer('fila').notNull(),
    folio: text('folio'),
    titulo: text('titulo').notNull(),
    detalle: text('detalle'),
    clave: text('clave').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('notificaciones_clave_idx').on(t.clave),
    index('notificaciones_hoja_idx').on(t.sheetId, t.id),
  ],
)

/**
 * Lo leído es por usuario, no por equipo: que Keynor lea un aviso no se lo quita
 * a Paty. Se guarda la marca de lectura y no un booleano en `notificaciones`
 * porque cada aviso tiene tantos estados como personas en la mesa.
 */
export const notificacionesLeidas = pgTable(
  'notificaciones_leidas',
  {
    notificacionId: integer('notificacion_id').notNull(),
    correoUsuario: text('correo_usuario').notNull(),
    leidoEn: timestamp('leido_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.notificacionId, t.correoUsuario] })],
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
