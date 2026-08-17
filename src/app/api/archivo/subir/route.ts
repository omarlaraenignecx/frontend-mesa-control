import { revalidatePath } from 'next/cache'
import { requerirUsuario } from '@/lib/auth/guard'
import { carpetaDeArchivos, depsDrive, registrarArchivo } from '@/lib/casos/archivos'
import { LIMITE_BYTES, TOPE_ARCHIVOS, subirArchivo } from '@/lib/google/drive-subida'

const MB = 1024 * 1024

/**
 * Recibe los archivos que la mesa adjunta a un caso.
 *
 * Es una ruta y no una Server Action porque mueve archivos de varios megas y así
 * no depende del tope del cuerpo de las acciones, que la aplicación tuvo que
 * subir a 25 MB para poder adjuntar al correo (ver `lib/correo/limites.ts`). Aquí
 * el límite es el de esta ruta y nada más.
 *
 * No se restringe el tipo de archivo a propósito: la mesa adjunta capturas, PDF,
 * correos exportados y lo que haga falta, y nada de eso se ejecuta —se guarda en
 * Drive y se sirve como descarga—.
 */
export async function POST(request: Request) {
  const usuario = await requerirUsuario()

  let datos: FormData
  try {
    datos = await request.formData()
  } catch {
    return Response.json({ ok: false, error: 'No se pudo leer el envío.' }, { status: 400 })
  }

  const fila = Number(datos.get('fila'))
  if (!Number.isInteger(fila) || fila < 2) {
    return Response.json({ ok: false, error: 'Caso no válido.' }, { status: 400 })
  }

  const archivos = datos.getAll('archivos').filter((a): a is File => a instanceof File)
  if (archivos.length === 0) {
    return Response.json({ ok: false, error: 'No elegiste ningún archivo.' }, { status: 400 })
  }
  if (archivos.length > TOPE_ARCHIVOS) {
    return Response.json(
      { ok: false, error: `Máximo ${TOPE_ARCHIVOS} archivos por vez.` },
      { status: 400 },
    )
  }
  const pesado = archivos.find((a) => a.size > LIMITE_BYTES)
  if (pesado) {
    return Response.json(
      {
        ok: false,
        error: `"${pesado.name}" pesa ${(pesado.size / MB).toFixed(1)} MB y el límite son ${Math.round(
          LIMITE_BYTES / MB,
        )} MB. Súbelo a Drive y deja el enlace en las observaciones.`,
      },
      { status: 413 },
    )
  }

  try {
    const carpetaId = await carpetaDeArchivos()
    const deps = await depsDrive()

    for (const archivo of archivos) {
      const contenido = new Uint8Array(await archivo.arrayBuffer())
      const { id, bytes } = await subirArchivo(deps, {
        carpetaId,
        // El nombre lleva la fila delante para que la carpeta de Drive se
        // entienda sola, sin consultar la base.
        nombre: `[${fila}] ${archivo.name}`,
        tipo: archivo.type,
        contenido,
      })
      await registrarArchivo({
        fila,
        driveFileId: id,
        nombre: archivo.name,
        tipo: archivo.type || 'application/octet-stream',
        bytes,
        subidoPor: usuario.correo,
      })
    }
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : 'No se pudieron subir los archivos.' },
      { status: 502 },
    )
  }

  revalidatePath(`/caso/${fila}`)
  return Response.json({ ok: true, subidos: archivos.length })
}
