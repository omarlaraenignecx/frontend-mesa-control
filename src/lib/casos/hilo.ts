import { eq } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { componerAsunto } from '@/lib/correo/asunto'
import { accessTokenDeLaMesa } from '@/lib/google/auth-mesa'
import { buscarHilo, leerHilo, type DepsGmail, type Hilo } from '@/lib/google/gmail-thread'
import { moduloDelCaso, type Modulo } from '@/lib/modulos/modulo'
import { buzonDelCaso } from './buzon'
import type { Caso } from './caso'

export const CORREO_MESA = process.env.MESA_CORREO ?? 'mesadecontrol@gplusseguros.mx'

/**
 * El buzón de la mesa. Lo usan las rutas que revisan su bandeja —las que despierta
 * n8n—; para escribir o leer un caso concreto se usa `buzonDelCaso`, que resuelve el
 * buzón por el área de ese caso.
 */
export async function depsGmail(): Promise<DepsGmail> {
  return {
    fetch: globalThis.fetch,
    accessToken: await accessTokenDeLaMesa(),
    correoBuzon: CORREO_MESA,
  }
}

export async function leerVinculo(fila: number) {
  const [v] = await getDb()
    .select()
    .from(schema.casosHilo)
    .where(eq(schema.casosHilo.fila, fila))
    .limit(1)
  return v ?? null
}

export async function guardarVinculo(
  fila: number,
  threadId: string,
  folio: string,
  modulo: Modulo,
): Promise<void> {
  const valores = {
    threadId,
    asuntoNormalizado: componerAsunto(folio),
    folioUsado: folio,
    // Un threadId solo existe dentro del buzón que lo emitió. Sin esta columna, la
    // ruta que revisa la bandeja de siniestros buscaría ahí hilos de la mesa.
    modulo,
  }
  await getDb()
    .insert(schema.casosHilo)
    .values({ fila, ...valores })
    .onConflictDoUpdate({ target: schema.casosHilo.fila, set: valores })
}

export type EstadoHilo =
  | { estado: 'sin-conversacion' }
  | { estado: 'con-conversacion'; hilo: Hilo }
  | { estado: 'error'; mensaje: string }

/**
 * Resuelve la conversación de un caso. Primero por el threadId guardado; si no
 * hay, se busca por el asunto exacto, que también recupera el hilo cuando el
 * solicitante escribió un correo nuevo conservando el asunto.
 *
 * Nunca lanza: un fallo de Gmail no debe impedir trabajar el caso, así que el
 * error se devuelve para mostrarlo en el panel.
 */
export async function cargarHilo(
  fila: number,
  folio: string | null,
  caso: Pick<Caso, 'area'>,
): Promise<EstadoHilo> {
  try {
    // Por el área del caso y no por el buzón de la mesa: la conversación de un
    // siniestro vive en el buzón del ramo y ahí hay que ir a leerla.
    const { deps } = await buzonDelCaso(caso)
    const vinculo = await leerVinculo(fila)

    let threadId: string | null = vinculo?.threadId ?? null
    const folioLimpio = folio?.trim()
    if (!threadId && folioLimpio) {
      threadId = await buscarHilo(deps, folioLimpio)
      // Si se reencontró por asunto, se guarda para no volver a buscarlo.
      if (threadId) await guardarVinculo(fila, threadId, folioLimpio, moduloDelCaso(caso).clave)
    }

    if (!threadId) return { estado: 'sin-conversacion' }
    return { estado: 'con-conversacion', hilo: await leerHilo(deps, threadId) }
  } catch (e) {
    return { estado: 'error', mensaje: e instanceof Error ? e.message : 'Error desconocido' }
  }
}
