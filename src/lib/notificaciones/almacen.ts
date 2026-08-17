import { and, desc, eq, inArray, isNull, max } from 'drizzle-orm'
import { getDb, schema } from '@/db'
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
  const hoja = hojaActual()
  const filas = await getDb()
    .select({ clave: schema.notificaciones.clave })
    .from(schema.notificaciones)
    .where(
      and(eq(schema.notificaciones.sheetId, hoja), inArray(schema.notificaciones.clave, claves)),
    )
  return new Set(filas.map((f) => f.clave))
}

/** Tope de avisos que viaja al navegador. El panel no es un histórico. */
const TOPE_PANEL = 100

export async function sondeoDe(correo: string): Promise<Sondeo> {
  const db = getDb()
  const hoja = hojaActual()

  const [tope] = await db
    .select({ valor: max(schema.notificaciones.id) })
    .from(schema.notificaciones)
    .where(eq(schema.notificaciones.sheetId, hoja))

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
    .where(
      and(
        eq(schema.notificaciones.sheetId, hoja),
        isNull(schema.notificacionesLeidas.notificacionId),
      ),
    )
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
  const hoja = hojaActual()
  const pendientes = await getDb()
    .select({ id: schema.notificaciones.id })
    .from(schema.notificaciones)
    .where(and(eq(schema.notificaciones.sheetId, hoja), eq(schema.notificaciones.fila, fila)))
  await marcarLeidas(
    correo,
    pendientes.map((p) => p.id),
  )
}
