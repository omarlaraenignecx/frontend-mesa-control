import { and, desc, eq, inArray, isNull, max } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import type { Modulo } from '@/lib/modulos/modulo'
import type { Notificacion, NotificacionNueva, Sondeo } from './tipos'

/**
 * Lectura y escritura de los avisos.
 *
 * Toda consulta filtra por la hoja que este despliegue atiende: la misma base de
 * datos sirve a la copia de pruebas y a la hoja productiva, y la fila 7231 de cada
 * una es un caso distinto.
 */
export function hojaActual(): string {
  const id = process.env.SHEET_ID
  if (!id) throw new Error('Falta SHEET_ID para resolver las notificaciones de esta hoja.')
  return id
}

/**
 * El filtro que toda consulta de avisos lleva. Vive en un solo lugar para que no
 * haya una consulta que se lo salte por descuido: sin él, un aviso de la copia de
 * pruebas aparece en un caso de producción que tiene el mismo número de fila.
 */
function filtroDeHoja() {
  return eq(schema.notificaciones.sheetId, hojaActual())
}

/** El filtro de hoja más el del módulo, para lo que alimenta una campanita. */
function filtroDeHojaYModulo(modulo: Modulo) {
  return and(filtroDeHoja(), eq(schema.notificaciones.modulo, modulo))
}

function claveDeLaMarca(): string {
  return `ultima_marca_caso:${hojaActual()}`
}

export async function leerMarca(): Promise<string | null> {
  const [fila] = await getDb()
    .select()
    .from(schema.ajustesApp)
    .where(eq(schema.ajustesApp.clave, claveDeLaMarca()))
    .limit(1)
  return fila?.valor ?? null
}

export async function guardarMarca(iso: string): Promise<void> {
  await getDb()
    .insert(schema.ajustesApp)
    .values({ clave: claveDeLaMarca(), valor: iso })
    .onConflictDoUpdate({ target: schema.ajustesApp.clave, set: { valor: iso } })
}

/** Inserta descartando lo repetido. Devuelve cuántos avisos se crearon de verdad. */
export async function guardarNotificaciones(nuevas: NotificacionNueva[]): Promise<number> {
  if (nuevas.length === 0) return 0
  const hoja = hojaActual()
  const creadas = await getDb()
    .insert(schema.notificaciones)
    .values(nuevas.map((n) => ({ ...n, sheetId: hoja })))
    .onConflictDoNothing({ target: schema.notificaciones.clave })
    .returning({ id: schema.notificaciones.id })
  return creadas.length
}

/** Las claves que ya existen, para no pedir a Gmail metadatos que no se usarán. */
export async function clavesExistentes(claves: string[]): Promise<Set<string>> {
  if (claves.length === 0) return new Set()
  const filas = await getDb()
    .select({ clave: schema.notificaciones.clave })
    .from(schema.notificaciones)
    .where(and(filtroDeHoja(), inArray(schema.notificaciones.clave, claves)))
  return new Set(filas.map((f) => f.clave))
}

/** Tope de avisos que viaja al navegador. El panel no es un histórico. */
const TOPE_PANEL = 100

/**
 * Lo pendiente de una persona en un módulo.
 *
 * El módulo filtra de verdad y no solo decora: la Mesa de Control no debe timbrar
 * por un siniestro que no le toca, ni Atención a Siniestros por las 1,400 peticiones
 * al año de la mesa. `maxId` también se acota al módulo, o el navegador creería que
 * llegó algo nuevo cada vez que entra un aviso del otro.
 */
export async function sondeoDe(correo: string, modulo: Modulo): Promise<Sondeo> {
  const db = getDb()

  const [tope] = await db
    .select({ valor: max(schema.notificaciones.id) })
    .from(schema.notificaciones)
    .where(filtroDeHojaYModulo(modulo))

  const filas = await db
    .select({
      id: schema.notificaciones.id,
      tipo: schema.notificaciones.tipo,
      fila: schema.notificaciones.fila,
      folio: schema.notificaciones.folio,
      titulo: schema.notificaciones.titulo,
      detalle: schema.notificaciones.detalle,
      creadoEn: schema.notificaciones.creadoEn,
    })
    .from(schema.notificaciones)
    .leftJoin(
      schema.notificacionesLeidas,
      and(
        eq(schema.notificacionesLeidas.notificacionId, schema.notificaciones.id),
        eq(schema.notificacionesLeidas.correoUsuario, correo),
      ),
    )
    .where(and(filtroDeHojaYModulo(modulo), isNull(schema.notificacionesLeidas.notificacionId)))
    .orderBy(desc(schema.notificaciones.id))
    .limit(TOPE_PANEL)

  const noLeidas: Notificacion[] = filas.map((f) => ({
    id: f.id,
    tipo: f.tipo,
    fila: f.fila,
    folio: f.folio,
    titulo: f.titulo,
    detalle: f.detalle,
    creadoEnIso: f.creadoEn.toISOString(),
  }))

  const correosPorFila: Record<number, number> = {}
  for (const n of noLeidas) {
    if (n.tipo !== 'correo_recibido') continue
    correosPorFila[n.fila] = (correosPorFila[n.fila] ?? 0) + 1
  }

  return { maxId: tope?.valor ?? 0, noLeidas, correosPorFila }
}

export async function marcarLeidas(correo: string, ids: number[]): Promise<void> {
  if (ids.length === 0) return
  await getDb()
    .insert(schema.notificacionesLeidas)
    .values(ids.map((notificacionId) => ({ notificacionId, correoUsuario: correo })))
    .onConflictDoNothing()
}

/** Marca leído todo lo de un caso: es lo que hace la vista del caso al abrirse. */
export async function marcarLeidasDeFila(correo: string, fila: number): Promise<void> {
  const pendientes = await getDb()
    .select({ id: schema.notificaciones.id })
    .from(schema.notificaciones)
    // Sin filtrar por módulo: abrir el caso lo lee entero, venga de donde venga.
    .where(and(filtroDeHoja(), eq(schema.notificaciones.fila, fila)))
  await marcarLeidas(
    correo,
    pendientes.map((p) => p.id),
  )
}
