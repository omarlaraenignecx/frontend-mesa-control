import type { DepsGmail } from './gmail-thread'

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

/** Tope por consulta. El buzón de la mesa recibe decenas de correos al día. */
const TOPE = 50

async function pedir(deps: DepsGmail, url: string): Promise<unknown> {
  const respuesta = await deps.fetch(url, {
    headers: { Authorization: `Bearer ${deps.accessToken}` },
  })
  if (!respuesta.ok) {
    throw new Error(`Gmail respondió ${respuesta.status} al revisar el buzón de la mesa.`)
  }
  return respuesta.json()
}

/**
 * Los mensajes que entraron al buzón de la mesa en los últimos días.
 *
 * `messages.list` ya devuelve el `threadId` de cada mensaje, así que una sola
 * llamada basta para saber a qué conversación pertenece cada uno: no hay una
 * petición por mensaje. `-from:me` descarta lo que la mesa envió, que no es una
 * respuesta que haya que avisar.
 *
 * La ventana es de una semana y no de un día: si los flujos o la aplicación se
 * caen un fin de semana, lo que llegó en ese hueco tiene que seguir apareciendo al
 * volver. Releer no cuesta —la consulta es una sola y la clave única descarta lo
 * repetido—, y en el buzón real las respuestas de las agencias llegan con dos y
 * tres días de separación, así que una ventana corta sí perdería avisos.
 */
export async function mensajesRecientes(
  deps: DepsGmail,
  dias = 7,
): Promise<{ id: string; threadId: string }[]> {
  const q = encodeURIComponent(`in:inbox newer_than:${dias}d -from:me`)
  const cuerpo = (await pedir(deps, `${BASE}/messages?q=${q}&maxResults=${TOPE}`)) as {
    messages?: { id: string; threadId: string }[]
  }
  return (cuerpo.messages ?? []).map((m) => ({ id: m.id, threadId: m.threadId }))
}

/** Solo las cabeceras: el aviso dice quién escribió, no qué escribió. */
export async function metadatosDeMensaje(
  deps: DepsGmail,
  id: string,
): Promise<{ autor: string }> {
  const cuerpo = (await pedir(
    deps,
    `${BASE}/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From`,
  )) as { payload?: { headers?: { name: string; value: string }[] } }

  const de = cuerpo.payload?.headers?.find((h) => h.name.toLowerCase() === 'from')?.value ?? ''
  // `Ana Pérez <ana@agencia.mx>` o `"Pérez, Ana" <ana@agencia.mx>` o el correo solo.
  const conNombre = de.match(/^\s*"?([^"<]+?)"?\s*</)
  return { autor: (conNombre?.[1] ?? de).trim() || 'un remitente' }
}
