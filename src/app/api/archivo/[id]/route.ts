import { requerirUsuario } from '@/lib/auth/guard'
import { buscarArchivo, depsDrive } from '@/lib/casos/archivos'
import { descargarArchivo } from '@/lib/google/drive-subida'

/**
 * Sirve un archivo que subió la mesa. El archivo de Drive no se comparte con
 * nadie: se pide con la credencial de la mesa y se entrega al navegador, igual
 * que los adjuntos del correo. La URL lleva el id interno, no el de Drive.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario()
  const { id: idTexto } = await params
  const id = Number(idTexto)
  if (!Number.isInteger(id)) return new Response('Referencia no válida.', { status: 400 })

  const archivo = await buscarArchivo(id)
  if (!archivo) return new Response('Ese archivo no está registrado.', { status: 404 })

  try {
    const { contenido, tipo } = await descargarArchivo(await depsDrive(), archivo.driveFileId)
    return new Response(contenido, {
      headers: {
        'content-type': archivo.tipo || tipo,
        'content-length': String(contenido.byteLength),
        'content-disposition': `attachment; filename="${archivo.nombre.replace(/["\\\r\n]/g, '_')}"`,
        'cache-control': 'private, no-store',
      },
    })
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'No se pudo descargar el archivo.', {
      status: 502,
    })
  }
}
