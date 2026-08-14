import { and, asc, eq } from 'drizzle-orm'
import { getDb } from '@/db/index'
import { ajustesApp, archivosCaso } from '@/db/schema'
import { accessTokenDeLaMesa } from '@/lib/google/auth-mesa'
import { crearCarpeta, type DepsDrive } from '@/lib/google/drive-subida'

const CLAVE_CARPETA = 'carpeta_drive_archivos'

/**
 * La hoja a la que pertenece lo que se está mirando. Entra en la identidad de
 * cada archivo porque la base es compartida entre la copia y la hoja real, y el
 * número de fila por sí solo no distingue un caso de otro.
 */
function hojaActual(): string {
  const id = process.env.SHEET_ID
  if (!id) throw new Error('Falta SHEET_ID: no se puede saber a qué hoja pertenece el archivo.')
  return id
}

export async function depsDrive(): Promise<DepsDrive> {
  return { fetch: globalThis.fetch, accessToken: await accessTokenDeLaMesa() }
}

/**
 * El id de la carpeta donde van los archivos, creándola la primera vez.
 *
 * Se guarda en lugar de buscarla por nombre en cada subida: si alguien la renombra
 * o la mueve en Drive, los archivos siguen cayendo en el mismo lugar y no se
 * crea una segunda carpeta silenciosamente.
 */
export async function carpetaDeArchivos(): Promise<string> {
  const db = getDb()
  const [guardada] = await db
    .select()
    .from(ajustesApp)
    .where(eq(ajustesApp.clave, CLAVE_CARPETA))
    .limit(1)
  if (guardada) return guardada.valor

  const id = await crearCarpeta(await depsDrive())
  // `onConflictDoNothing` y relectura: si dos subidas simultáneas crearan cada
  // una su carpeta, gana la que se guardó primero y las dos usan esa.
  await db
    .insert(ajustesApp)
    .values({ clave: CLAVE_CARPETA, valor: id })
    .onConflictDoNothing({ target: ajustesApp.clave })
  const [confirmada] = await db
    .select()
    .from(ajustesApp)
    .where(eq(ajustesApp.clave, CLAVE_CARPETA))
    .limit(1)
  return confirmada?.valor ?? id
}

export async function registrarArchivo(datos: {
  fila: number
  driveFileId: string
  nombre: string
  tipo: string
  bytes: number
  subidoPor: string
}): Promise<void> {
  await getDb()
    .insert(archivosCaso)
    .values({ ...datos, sheetId: hojaActual() })
}

export type ArchivoDeLaMesa = {
  id: number
  nombre: string
  bytes: number
  subidoPor: string
}

export async function listarArchivos(fila: number): Promise<ArchivoDeLaMesa[]> {
  const filas = await getDb()
    .select()
    .from(archivosCaso)
    .where(and(eq(archivosCaso.sheetId, hojaActual()), eq(archivosCaso.fila, fila)))
    .orderBy(asc(archivosCaso.creadoEn))
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    bytes: f.bytes,
    subidoPor: f.subidoPor,
  }))
}

/**
 * Busca por el id interno y no por el de Drive: así la URL de descarga no expone
 * identificadores de Google, y solo se sirve lo que está registrado.
 *
 * Filtra también por hoja, para que un archivo subido contra la copia no se pueda
 * descargar desde producción con solo acertar el número.
 */
export async function buscarArchivo(id: number) {
  const [fila] = await getDb()
    .select()
    .from(archivosCaso)
    .where(and(eq(archivosCaso.id, id), eq(archivosCaso.sheetId, hojaActual())))
    .limit(1)
  return fila ?? null
}
