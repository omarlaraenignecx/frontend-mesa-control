import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb, schema } from '@/db'
import type { Caso } from '@/lib/casos/caso'
import { depsDeGoogle } from '@/lib/casos/consulta'
import { mensajesRecientes, metadatosDeMensaje } from '@/lib/google/gmail-buzon'
import type { DepsGmail } from '@/lib/google/gmail-thread'
import { leerCasos } from '@/lib/google/sheet-reader'
import { moduloPorClave, type Modulo } from '@/lib/modulos/modulo'
import { clavesExistentes, guardarNotificaciones, hojaActual } from './almacen'
import { claveDeCorreo } from './claves'
import type { NotificacionNueva } from './tipos'

/** El caso al que pertenece un folio, en la hoja que este despliegue atiende. */
function casoPorFolio(casos: Caso[], folio: string): Caso | null {
  return casos.find((c) => c.folio?.trim() === folio.trim()) ?? null
}

export type Revision = {
  mensajes: number
  avisos: number
}

/**
 * Revisa una bandeja y crea los avisos de las respuestas que pertenecen a un caso de
 * ese módulo.
 *
 * El mapeo mensaje → caso va por el **folio** del hilo y no por la fila guardada en
 * `casos_hilo`: esa tabla no lleva la hoja, así que su fila 7181 puede ser de la copia
 * de pruebas o de la productiva. El folio se busca en la hoja que este despliegue
 * sirve, y si no está, el mensaje no genera aviso aquí —es de la otra—.
 *
 * **El filtro por módulo sobre `casos_hilo` no es decorativo.** Los dos módulos pueden
 * compartir buzón —pasa mientras siniestros usa la cuenta de la mesa, y es el escenario
 * con el que se probó—, y sin él cada revisión recogería los hilos de la otra: la
 * primera en correr se quedaría con todas las respuestas y las metería en su propia
 * campanita. Con buzones distintos el filtro no hace nada; el día que coincidan, es lo
 * único que sostiene la separación.
 */
export async function revisarCorreos(modulo: Modulo, deps: DepsGmail): Promise<Revision> {
  const hoja = hojaActual()
  const mensajes = await mensajesRecientes(deps)
  if (mensajes.length === 0) return { mensajes: 0, avisos: 0 }

  const hilos = [...new Set(mensajes.map((m) => m.threadId))]
  const vinculos = await getDb()
    .select()
    .from(schema.casosHilo)
    .where(and(inArray(schema.casosHilo.threadId, hilos), eq(schema.casosHilo.modulo, modulo)))

  const folioDeHilo = new Map(vinculos.map((v) => [v.threadId, v.folioUsado]))
  const deCasos = mensajes.filter((m) => folioDeHilo.has(m.threadId))
  const yaEstan = await clavesExistentes(deCasos.map((m) => claveDeCorreo(hoja, m.id)))
  const pendientes = deCasos.filter((m) => !yaEstan.has(claveDeCorreo(hoja, m.id)))

  // Salida temprana antes de leer la hoja: en el caso normal —nada nuevo— esto ahorra
  // la lectura de las 1,400 peticiones cada minuto.
  if (pendientes.length === 0) return { mensajes: mensajes.length, avisos: 0 }

  const { casos } = await leerCasos(await depsDeGoogle())
  const config = moduloPorClave(modulo)

  const nuevas: NotificacionNueva[] = []
  const filasTocadas = new Set<number>()
  for (const m of pendientes) {
    const folio = folioDeHilo.get(m.threadId)
    if (!folio) continue
    const caso = casoPorFolio(casos, folio)
    if (caso === null) continue // el folio no vive en esta hoja: no es nuestro caso
    const { autor } = await metadatosDeMensaje(deps, m.id)
    nuevas.push({
      modulo,
      tipo: 'correo_recibido',
      fila: caso.fila,
      folio,
      titulo: `Respuesta de ${autor}`,
      detalle: `Caso ${folio}`,
      clave: claveDeCorreo(hoja, m.id),
    })
    filasTocadas.add(caso.fila)
  }

  const avisos = await guardarNotificaciones(nuevas)
  for (const fila of filasTocadas) revalidatePath(config.rutaCaso(fila))

  return { mensajes: mensajes.length, avisos }
}
