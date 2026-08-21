import { requerirUsuario } from '@/lib/auth/guard'
import { buzonDelCaso } from '@/lib/casos/buzon'
import { cargarCaso } from '@/lib/casos/consulta'
import { leerVinculo } from '@/lib/casos/hilo'
import { leerAdjunto, leerHilo, ubicarAdjunto } from '@/lib/google/gmail-thread'

/**
 * Sirve un adjunto del hilo del caso. No se almacena nada: se pide a Gmail con
 * la credencial de la mesa y se entrega al navegador.
 *
 * El adjunto se identifica por la posición que ocupa en su mensaje, no por el
 * attachmentId: Gmail lo regenera en cada lectura, así que un id puesto en la
 * URL deja de ser válido en la petición siguiente.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fila: string; mensaje: string; indice: string }> },
) {
  await requerirUsuario()
  const { fila: filaTexto, mensaje: mensajeId, indice: indiceTexto } = await params
  const fila = Number(filaTexto)
  const indice = Number(indiceTexto)

  if (!Number.isInteger(fila) || !Number.isInteger(indice)) {
    return new Response('Referencia de archivo no válida.', { status: 400 })
  }

  const vinculo = await leerVinculo(fila)
  if (!vinculo) {
    return new Response('Ese caso no tiene conversación registrada.', { status: 404 })
  }

  // El adjunto vive en el buzón donde vive la conversación, y eso lo decide el área
  // del caso: pedirlo con el token de la mesa daría 404 en un caso del ramo.
  const cargado = await cargarCaso(fila)
  if (!cargado) return new Response('Ese caso ya no está en la hoja.', { status: 404 })

  try {
    const { deps } = await buzonDelCaso(cargado.caso)
    const hilo = await leerHilo(deps, vinculo.threadId)

    const ubicado = ubicarAdjunto(hilo, mensajeId, indice)
    if (!ubicado) {
      return new Response('Ese archivo no pertenece a la conversación de este caso.', {
        status: 404,
      })
    }

    const contenido = await leerAdjunto(deps, ubicado.mensajeId, ubicado.adjuntoId)

    return new Response(new Uint8Array(contenido), {
      headers: {
        'content-type': ubicado.tipo,
        'content-length': String(contenido.byteLength),
        'content-disposition': `attachment; filename="${ubicado.nombre.replace(/["\\\r\n]/g, '_')}"`,
        'cache-control': 'private, no-store',
      },
    })
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'No se pudo descargar el archivo.', {
      status: 502,
    })
  }
}
