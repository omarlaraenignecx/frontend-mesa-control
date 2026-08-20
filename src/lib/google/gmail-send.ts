import {
  LIMITE_GMAIL_BYTES,
  aBase64Url,
  componerMime,
  pesoCodificado,
  type AdjuntoSalida,
} from '@/lib/correo/mime'
import type { DepsGmail } from './gmail-thread'

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

const enMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1)

export class CorreoDemasiadoGrandeError extends Error {
  constructor(bytes: number) {
    super(
      `Los archivos pesan ${enMb(bytes)} MB al codificarse y Gmail acepta hasta ${enMb(
        LIMITE_GMAIL_BYTES,
      )} MB por correo. Quita o comprime alguno.`,
    )
    this.name = 'CorreoDemasiadoGrandeError'
  }
}

export type MensajeSalida = {
  /** Remitente completo, con nombre visible. Lo arma `remitenteDe(marca)`. */
  de: string
  para: string
  cc: string[]
  asunto: string
  html: string
  texto: string
  adjuntos: AdjuntoSalida[]
  enRespuestaA?: string
}

/**
 * Envía por el buzón que traiga el token de `deps`.
 *
 * El remitente viaja en el mensaje y no es una constante: desde que existe el módulo
 * de siniestros hay dos buzones, y el `de` tiene que corresponder al token con el que
 * se está llamando a Gmail. Google rechaza un `From` que no sea de la cuenta
 * autenticada, así que una constante aquí sería un envío fallido o, peor, un correo
 * saliendo del área equivocada.
 *
 * Cuando se pasa `threadId`, Gmail agrupa el mensaje en la conversación
 * existente; las cabeceras In-Reply-To y References hacen que también lo agrupen
 * los clientes de correo del solicitante.
 */
export async function enviarCorreo(
  deps: DepsGmail,
  mensaje: MensajeSalida,
  threadId?: string,
): Promise<{ id: string; threadId: string }> {
  const peso = pesoCodificado(mensaje.adjuntos)
  if (peso > LIMITE_GMAIL_BYTES) throw new CorreoDemasiadoGrandeError(peso)

  const mime = componerMime(mensaje)

  const respuesta = await deps.fetch(`${BASE}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deps.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ raw: aBase64Url(mime), ...(threadId ? { threadId } : {}) }),
  })

  if (respuesta.status === 403) {
    throw new Error('La cuenta de correo autorizada no tiene permiso para enviar.')
  }
  if (respuesta.status === 429) {
    throw new Error('Google aplicó un límite de envío. Intenta de nuevo en un momento.')
  }
  if (!respuesta.ok) {
    throw new Error(`Gmail respondió ${respuesta.status} al enviar el correo.`)
  }

  const cuerpo = (await respuesta.json()) as { id?: string; threadId?: string }
  if (!cuerpo.id || !cuerpo.threadId) {
    throw new Error('Gmail aceptó el correo pero respondió sin identificador de conversación.')
  }
  return { id: cuerpo.id, threadId: cuerpo.threadId }
}
