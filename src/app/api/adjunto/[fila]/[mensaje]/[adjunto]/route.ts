import { requerirUsuario } from '@/lib/auth/guard'
import { depsGmail, leerVinculo } from '@/lib/casos/hilo'
import { leerAdjunto, leerHilo } from '@/lib/google/gmail-thread'

/**
 * Sirve un adjunto del hilo del caso. No se almacena nada: se pide a Gmail con
 * la credencial de la mesa y se entrega al navegador.
 *
 * Valida que el adjunto pertenezca de verdad al hilo de ese caso, para que
 * nadie pueda pedir un adjunto de otra conversación del buzón manipulando la URL.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fila: string; mensaje: string; adjunto: string }> },
) {
  await requerirUsuario()
  const { fila: filaTexto, mensaje: mensajeId, adjunto: adjuntoId } = await params
  const fila = Number(filaTexto)

  if (!Number.isInteger(fila)) {
    return new Response('Caso no válido.', { status: 400 })
  }

  const vinculo = await leerVinculo(fila)
  if (!vinculo) {
    return new Response('Ese caso no tiene conversación registrada.', { status: 404 })
  }

  try {
    const deps = await depsGmail()
    const hilo = await leerHilo(deps, vinculo.threadId)

    const mensaje = hilo.mensajes.find((m) => m.id === mensajeId)
    const adjunto = mensaje?.adjuntos.find((a) => a.id === adjuntoId)
    if (!mensaje || !adjunto) {
      return new Response('Ese archivo no pertenece a la conversación de este caso.', {
        status: 404,
      })
    }

    const contenido = await leerAdjunto(deps, mensajeId, adjuntoId)

    return new Response(new Uint8Array(contenido), {
      headers: {
        'content-type': adjunto.tipo,
        'content-length': String(contenido.byteLength),
        'content-disposition': `attachment; filename="${adjunto.nombre.replace(/["\\\r\n]/g, '_')}"`,
        'cache-control': 'private, no-store',
      },
    })
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'No se pudo descargar el archivo.', {
      status: 502,
    })
  }
}
