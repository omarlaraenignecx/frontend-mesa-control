import { inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb, schema } from '@/db'
import type { Caso } from '@/lib/casos/caso'
import { depsDeGoogle } from '@/lib/casos/consulta'
import { depsGmail } from '@/lib/casos/hilo'
import { mensajesRecientes, metadatosDeMensaje } from '@/lib/google/gmail-buzon'
import { leerCasos } from '@/lib/google/sheet-reader'
import { moduloDelCaso } from '@/lib/modulos/modulo'
import { clavesExistentes, guardarNotificaciones, hojaActual } from '@/lib/notificaciones/almacen'
import { claveDeCorreo } from '@/lib/notificaciones/claves'
import { secretoValido } from '@/lib/notificaciones/secreto'
import type { NotificacionNueva } from '@/lib/notificaciones/tipos'

/** El caso al que pertenece un folio, en la hoja que este despliegue atiende. */
function casoPorFolio(casos: Caso[], folio: string): Caso | null {
  return casos.find((c) => c.folio?.trim() === folio.trim()) ?? null
}

/**
 * La despierta el flujo "Mesa de Control · Correos recibidos" de n8n cada minuto.
 *
 * El mapeo mensaje → caso va por el **folio** del hilo y no por la fila guardada
 * en `casos_hilo`: esa tabla no lleva la hoja, así que su fila 7181 puede ser de la
 * copia de pruebas o de la productiva. El folio se busca en la hoja que este
 * despliegue sirve, y si no está, el mensaje no genera aviso aquí —es de la otra—.
 */
export async function POST(request: Request) {
  if (!secretoValido(request.headers.get('authorization'), process.env.NOTIFICACIONES_SECRET)) {
    return Response.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  const hoja = hojaActual()
  const deps = await depsGmail()
  const mensajes = await mensajesRecientes(deps)
  if (mensajes.length === 0) return Response.json({ ok: true, mensajes: 0, avisos: 0 })

  const hilos = [...new Set(mensajes.map((m) => m.threadId))]
  const vinculos = await getDb()
    .select()
    .from(schema.casosHilo)
    .where(inArray(schema.casosHilo.threadId, hilos))

  const folioDeHilo = new Map(vinculos.map((v) => [v.threadId, v.folioUsado]))
  const deCasos = mensajes.filter((m) => folioDeHilo.has(m.threadId))
  const yaEstan = await clavesExistentes(deCasos.map((m) => claveDeCorreo(hoja, m.id)))
  const pendientes = deCasos.filter((m) => !yaEstan.has(claveDeCorreo(hoja, m.id)))

  // Salida temprana antes de leer la hoja: en el caso normal —nada nuevo— esto
  // ahorra la lectura de las 1,400 peticiones cada minuto.
  if (pendientes.length === 0) {
    return Response.json({ ok: true, mensajes: mensajes.length, avisos: 0 })
  }

  const { casos } = await leerCasos(await depsDeGoogle())

  const nuevas: NotificacionNueva[] = []
  const filasTocadas = new Set<number>()
  for (const m of pendientes) {
    const folio = folioDeHilo.get(m.threadId)
    if (!folio) continue
    const caso = casoPorFolio(casos, folio)
    if (caso === null) continue // el folio no vive en esta hoja: no es nuestro caso
    const fila = caso.fila
    const { autor } = await metadatosDeMensaje(deps, m.id)
    nuevas.push({
      // Por el área del caso y no por el buzón donde se leyó el mensaje: así el
      // aviso llega a la campanita correcta aunque la conversación siga viviendo en
      // el buzón de la mesa.
      modulo: moduloDelCaso(caso).clave,
      tipo: 'correo_recibido',
      fila,
      folio,
      titulo: `Respuesta de ${autor}`,
      detalle: `Caso ${folio}`,
      clave: claveDeCorreo(hoja, m.id),
    })
    filasTocadas.add(fila)
  }

  const avisos = await guardarNotificaciones(nuevas)
  for (const fila of filasTocadas) revalidatePath(`/caso/${fila}`)

  return Response.json({ ok: true, mensajes: mensajes.length, avisos })
}
