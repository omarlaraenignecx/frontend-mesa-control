import { and, eq } from 'drizzle-orm'
import { getDb, schema } from '@/db'

export type EstadoBloqueo = {
  fila: number
  correoDueno: string
  tomadoEn: Date
  ultimoLatido: Date
}

export async function leerBloqueo(fila: number): Promise<EstadoBloqueo | null> {
  const [b] = await getDb()
    .select()
    .from(schema.bloqueos)
    .where(eq(schema.bloqueos.fila, fila))
    .limit(1)
  return b ?? null
}

/**
 * Se toma al abrir el caso. No expira por tiempo: la liberación es manual, por
 * el dueño o forzada por cualquiera, según decidió el área. El latido solo sirve
 * para mostrar cuánto lleva sin actividad y ayudar a decidir si conviene forzar.
 */
export async function adquirirBloqueo(
  fila: number,
  correo: string,
): Promise<{ ok: true } | { ok: false; bloqueo: EstadoBloqueo }> {
  const existente = await leerBloqueo(fila)
  if (existente && existente.correoDueno !== correo) return { ok: false, bloqueo: existente }

  if (existente) {
    await getDb()
      .update(schema.bloqueos)
      .set({ ultimoLatido: new Date() })
      .where(eq(schema.bloqueos.fila, fila))
    return { ok: true }
  }

  await getDb().insert(schema.bloqueos).values({ fila, correoDueno: correo }).onConflictDoNothing()

  // Si otra persona ganó la carrera, su bloqueo es el que vale.
  const tras = await leerBloqueo(fila)
  if (tras && tras.correoDueno !== correo) return { ok: false, bloqueo: tras }
  return { ok: true }
}

export async function latir(fila: number, correo: string): Promise<void> {
  await getDb()
    .update(schema.bloqueos)
    .set({ ultimoLatido: new Date() })
    .where(and(eq(schema.bloqueos.fila, fila), eq(schema.bloqueos.correoDueno, correo)))
}

export async function liberarBloqueo(fila: number, correo: string): Promise<void> {
  await getDb()
    .delete(schema.bloqueos)
    .where(and(eq(schema.bloqueos.fila, fila), eq(schema.bloqueos.correoDueno, correo)))
}

/** Devuelve el correo de quien lo tenía, para poder registrarlo en la bitácora. */
export async function forzarBloqueo(fila: number): Promise<string | null> {
  const previo = await leerBloqueo(fila)
  await getDb().delete(schema.bloqueos).where(eq(schema.bloqueos.fila, fila))
  return previo?.correoDueno ?? null
}
