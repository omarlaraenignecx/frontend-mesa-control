/**
 * Subida de archivos al Drive de la mesa.
 *
 * Los adjuntos que la mesa agrega a un caso no pueden ir a la hoja: las columnas
 * de adjuntos del formulario están protegidas sin editores y un enlace ahí
 * devolvería 403. Viven en una carpeta que crea esta misma aplicación —lo único
 * que el permiso `drive.file` alcanza— y su registro queda en Postgres.
 */
export type DepsDrive = {
  fetch: typeof globalThis.fetch
  accessToken: string
}

export const NOMBRE_CARPETA = 'Mesa de Control · Archivos'

/** Tope por archivo. Drive aguanta mucho más; esto acota el gasto de la función. */
export const LIMITE_BYTES = 25 * 1024 * 1024

/** Tope de archivos por subida, para que un clic accidental no cargue doscientos. */
export const TOPE_ARCHIVOS = 10

const API = 'https://www.googleapis.com/drive/v3/files'
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files'

function concatenar(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((n, p) => n + p.length, 0)
  const salida = new Uint8Array(total)
  let offset = 0
  for (const p of partes) {
    salida.set(p, offset)
    offset += p.length
  }
  return salida
}

/**
 * Arma el cuerpo `multipart/related` que pide la API de Drive: una parte con los
 * metadatos en JSON y otra con el contenido.
 *
 * Se construye sobre bytes y no sobre cadenas: pasar un PDF o un PNG por una
 * cadena lo daña, porque los bytes que no son UTF-8 válido se sustituyen.
 */
export function cuerpoMultiparte(
  metadatos: object,
  tipo: string,
  contenido: Uint8Array,
): { cuerpo: Uint8Array; contentType: string } {
  const frontera = `mesa-${Math.random().toString(36).slice(2)}-${contenido.length}`
  const cod = new TextEncoder()

  const encabezado = cod.encode(
    `--${frontera}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadatos)}\r\n` +
      `--${frontera}\r\n` +
      `Content-Type: ${tipo}\r\n\r\n`,
  )
  const cierre = cod.encode(`\r\n--${frontera}--\r\n`)

  return {
    cuerpo: concatenar([encabezado, contenido, cierre]),
    contentType: `multipart/related; boundary=${frontera}`,
  }
}

async function revisar(respuesta: Response): Promise<void> {
  if (respuesta.ok) return
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new Error(
      'Google rechazó la operación sobre Drive. Lo más probable es que falte el permiso de escritura: pide al administrador que vuelva a autorizar el acceso en Ajustes.',
    )
  }
  throw new Error(`Drive respondió ${respuesta.status} al procesar el archivo.`)
}

export async function crearCarpeta(deps: DepsDrive): Promise<string> {
  const respuesta = await deps.fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deps.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: NOMBRE_CARPETA,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  await revisar(respuesta)
  const { id } = (await respuesta.json()) as { id: string }
  return id
}

export async function subirArchivo(
  deps: DepsDrive,
  archivo: { carpetaId: string; nombre: string; tipo: string; contenido: Uint8Array },
): Promise<{ id: string; bytes: number }> {
  const { cuerpo, contentType } = cuerpoMultiparte(
    { name: archivo.nombre, parents: [archivo.carpetaId] },
    archivo.tipo || 'application/octet-stream',
    archivo.contenido,
  )

  const respuesta = await deps.fetch(`${SUBIDA}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deps.accessToken}`,
      'content-type': contentType,
    },
    body: cuerpo,
  })
  await revisar(respuesta)
  const { id } = (await respuesta.json()) as { id: string }
  return { id, bytes: archivo.contenido.length }
}

/**
 * Descarga el contenido para servirlo por nuestra propia ruta. El archivo de
 * Drive no se comparte con nadie: se pide con la credencial de la mesa, igual que
 * los adjuntos del correo.
 */
export async function descargarArchivo(
  deps: DepsDrive,
  id: string,
): Promise<{ contenido: ArrayBuffer; tipo: string }> {
  const respuesta = await deps.fetch(`${API}/${encodeURIComponent(id)}?alt=media`, {
    headers: { Authorization: `Bearer ${deps.accessToken}` },
  })
  await revisar(respuesta)
  return {
    contenido: await respuesta.arrayBuffer(),
    tipo: respuesta.headers.get('content-type') ?? 'application/octet-stream',
  }
}
