import { desc, eq } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import type { Cambio } from './seguimiento'

type TipoBitacora = 'guardado' | 'bloqueo_forzado' | 'folio_capturado'

/** Un registro por campo modificado: usuario, valor anterior, nuevo y fecha (RNF-04). */
export async function registrarCambios(
  fila: number,
  folio: string | null,
  correoUsuario: string,
  cambios: Cambio[],
  tipo: TipoBitacora = 'guardado',
): Promise<void> {
  if (cambios.length === 0) return
  await getDb()
    .insert(schema.bitacora)
    .values(
      cambios.map((c) => ({
        fila,
        folio,
        correoUsuario,
        campo: c.etiqueta,
        valorAnterior: c.anterior,
        valorNuevo: c.nuevo,
        tipo,
      })),
    )
}

export async function registrarAccion(
  fila: number,
  folio: string | null,
  correoUsuario: string,
  campo: string,
  detalle: string,
  tipo: TipoBitacora,
): Promise<void> {
  await getDb().insert(schema.bitacora).values({
    fila,
    folio,
    correoUsuario,
    campo,
    valorAnterior: null,
    valorNuevo: detalle,
    tipo,
  })
}

export async function leerBitacora(fila: number, limite = 50) {
  return getDb()
    .select()
    .from(schema.bitacora)
    .where(eq(schema.bitacora.fila, fila))
    .orderBy(desc(schema.bitacora.creadoEn))
    .limit(limite)
}
