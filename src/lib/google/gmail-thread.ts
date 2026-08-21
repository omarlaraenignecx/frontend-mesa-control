import { consultaDeBusqueda } from '@/lib/correo/asunto'
import { limpiarCuerpo } from '@/lib/correo/html-a-texto'

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

export type DepsGmail = {
  fetch: typeof globalThis.fetch
  accessToken: string
  /** El buzón por el que se está leyendo: sirve para reconocer los mensajes propios. */
  correoBuzon: string
}

export type AdjuntoEntrante = { id: string; nombre: string; tipo: string; bytes: number }

/** Un mensaje ya listo para pintarse como burbuja. Serializable: sin Date. */
export type MensajeChat = {
  id: string
  messageId: string | null
  deLaMesa: boolean
  autor: string
  correoAutor: string
  fechaIso: string
  texto: string
  adjuntos: AdjuntoEntrante[]
}

export type Hilo = { threadId: string; mensajes: MensajeChat[] }

type ParteGmail = {
  mimeType?: string
  filename?: string
  headers?: { name?: string; value?: string }[]
  body?: { data?: string; attachmentId?: string; size?: number }
  parts?: ParteGmail[]
}

type MensajeGmail = {
  id?: string
  internalDate?: string
  payload?: ParteGmail
}

async function pedir(deps: DepsGmail, url: string) {
  const respuesta = await deps.fetch(url, {
    headers: { Authorization: `Bearer ${deps.accessToken}` },
  })

  if (respuesta.status === 404) {
    throw new Error('La conversación no existe o ya no está en el buzón de la mesa.')
  }
  if (respuesta.status === 403) {
    throw new Error('La cuenta de la mesa no tiene permiso para leer el correo.')
  }
  if (respuesta.status === 429) {
    throw new Error('Google limitó las consultas de correo. Intenta de nuevo en un momento.')
  }
  if (!respuesta.ok) {
    throw new Error(`Gmail respondió ${respuesta.status} al leer la conversación.`)
  }
  return respuesta
}

function cabecera(payload: ParteGmail | undefined, nombre: string): string | null {
  const h = payload?.headers?.find((x) => x.name?.toLowerCase() === nombre.toLowerCase())
  return h?.value ?? null
}

function decodificar(data: string | undefined): string {
  if (!data) return ''
  return Buffer.from(data, 'base64url').toString('utf8')
}

/** Recorre las partes en profundidad buscando el primer cuerpo del tipo pedido. */
function buscarCuerpo(parte: ParteGmail | undefined, tipo: string): string {
  if (!parte) return ''
  if (parte.mimeType === tipo && parte.body?.data && !parte.filename) {
    return decodificar(parte.body.data)
  }
  for (const hija of parte.parts ?? []) {
    const encontrado = buscarCuerpo(hija, tipo)
    if (encontrado) return encontrado
  }
  return ''
}

/** Adjunto es toda parte con nombre de archivo y su propio identificador. */
function buscarAdjuntos(parte: ParteGmail | undefined, acumulado: AdjuntoEntrante[] = []) {
  if (!parte) return acumulado
  if (parte.filename && parte.body?.attachmentId) {
    acumulado.push({
      id: parte.body.attachmentId,
      nombre: parte.filename,
      tipo: parte.mimeType ?? 'application/octet-stream',
      bytes: parte.body.size ?? 0,
    })
  }
  for (const hija of parte.parts ?? []) buscarAdjuntos(hija, acumulado)
  return acumulado
}

function partirRemitente(valor: string | null): { autor: string; correo: string } {
  if (!valor) return { autor: '(desconocido)', correo: '' }
  const conNombre = valor.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (conNombre) {
    const nombre = conNombre[1].trim()
    const correo = conNombre[2].trim()
    return { autor: nombre || correo, correo }
  }
  const suelto = valor.trim()
  return { autor: suelto, correo: suelto }
}

export function normalizarMensaje(mensaje: MensajeGmail, correoBuzon: string): MensajeChat {
  const payload = mensaje.payload
  const { autor, correo } = partirRemitente(cabecera(payload, 'From'))

  const texto = limpiarCuerpo({
    texto: buscarCuerpo(payload, 'text/plain'),
    html: buscarCuerpo(payload, 'text/html'),
  })

  const fecha = new Date(Number(mensaje.internalDate ?? 0))

  return {
    id: mensaje.id ?? '',
    messageId: cabecera(payload, 'Message-ID'),
    deLaMesa: correo.trim().toLowerCase() === correoBuzon.trim().toLowerCase(),
    autor,
    correoAutor: correo,
    fechaIso: Number.isNaN(fecha.getTime()) ? new Date(0).toISOString() : fecha.toISOString(),
    texto,
    adjuntos: buscarAdjuntos(payload),
  }
}

export async function leerHilo(deps: DepsGmail, threadId: string): Promise<Hilo> {
  const respuesta = await pedir(deps, `${BASE}/threads/${threadId}?format=full`)
  const cuerpo = (await respuesta.json()) as { id?: string; messages?: MensajeGmail[] }

  const mensajes = (cuerpo.messages ?? [])
    .map((m) => normalizarMensaje(m, deps.correoBuzon))
    .sort((a, b) => a.fechaIso.localeCompare(b.fechaIso))

  return { threadId: cuerpo.id ?? threadId, mensajes }
}

/**
 * Respaldo del vínculo caso↔hilo: si el threadId guardado se perdió, o el
 * solicitante abrió un correo nuevo conservando el asunto, el hilo se reencuentra
 * buscando la frase exacta.
 */
export async function buscarHilo(deps: DepsGmail, folio: string): Promise<string | null> {
  const q = encodeURIComponent(consultaDeBusqueda(folio))
  const respuesta = await pedir(deps, `${BASE}/threads?q=${q}&maxResults=5`)
  const cuerpo = (await respuesta.json()) as { threads?: { id?: string }[] }
  return cuerpo.threads?.[0]?.id ?? null
}

/**
 * Ubica un adjunto por la posición que ocupa en su mensaje.
 *
 * La posición es la referencia estable: el `attachmentId` que devuelve Gmail
 * cambia en cada lectura del mensaje, así que ponerlo en una URL y compararlo
 * después nunca coincide. El id se toma siempre de la lectura actual del hilo.
 *
 * Además valida que el mensaje pertenezca al hilo del caso, de modo que nadie
 * alcance otra conversación del buzón manipulando la URL.
 */
export function ubicarAdjunto(
  hilo: Hilo,
  mensajeId: string,
  indice: number,
): { mensajeId: string; adjuntoId: string; nombre: string; tipo: string } | null {
  if (!Number.isInteger(indice) || indice < 0) return null
  const mensaje = hilo.mensajes.find((m) => m.id === mensajeId)
  const adjunto = mensaje?.adjuntos[indice]
  if (!mensaje || !adjunto) return null
  return {
    mensajeId: mensaje.id,
    adjuntoId: adjunto.id,
    nombre: adjunto.nombre,
    tipo: adjunto.tipo,
  }
}

/** Descarga el contenido de un adjunto. Se usa desde la ruta de descarga. */
export async function leerAdjunto(
  deps: DepsGmail,
  mensajeId: string,
  adjuntoId: string,
): Promise<Uint8Array> {
  const respuesta = await pedir(
    deps,
    `${BASE}/messages/${mensajeId}/attachments/${adjuntoId}`,
  )
  const cuerpo = (await respuesta.json()) as { data?: string }
  if (!cuerpo.data) throw new Error('Gmail no devolvió el contenido del adjunto.')
  return new Uint8Array(Buffer.from(cuerpo.data, 'base64url'))
}
