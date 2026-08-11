export type AdjuntoSalida = { nombre: string; tipo: string; contenido: Uint8Array }

export const LIMITE_GMAIL_BYTES = 25 * 1024 * 1024

/**
 * base64 infla los datos un tercio, y el límite de Gmail aplica al correo
 * codificado: un archivo de 20 MB pesa unos 27 MB al enviarse.
 */
export function pesoCodificado(adjuntos: AdjuntoSalida[]): number {
  return adjuntos.reduce((total, a) => total + Math.ceil(a.contenido.length / 3) * 4, 0)
}

/** Los acentos del asunto viajan codificados, o llegan como caracteres raros. */
function codificarAsunto(asunto: string): string {
  if (!/[^\x20-\x7E]/.test(asunto)) return asunto
  return `=?UTF-8?B?${Buffer.from(asunto, 'utf8').toString('base64')}?=`
}

const nombreSeguro = (nombre: string) => nombre.replace(/["\\\r\n]/g, '_')

/** base64 en líneas de 76 caracteres, como pide el formato MIME. */
function troncear(base64: string): string {
  return base64.replace(/(.{76})/g, '$1\r\n')
}

/** Hash estable para los boundaries; no necesita ser criptográfico. */
function hashDe(texto: string): number {
  let h = 0
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0
  return h
}

export function componerMime(mensaje: {
  de: string
  para: string
  cc: string[]
  asunto: string
  html: string
  texto: string
  adjuntos: AdjuntoSalida[]
  enRespuestaA?: string
}): string {
  const limiteAlt = `alt_${Math.abs(hashDe(mensaje.asunto + mensaje.texto)).toString(36)}`
  const limiteMix = `mix_${Math.abs(hashDe(mensaje.para + mensaje.asunto)).toString(36)}`
  const hayAdjuntos = mensaje.adjuntos.length > 0

  const cabeceras = [
    `From: ${mensaje.de}`,
    `To: ${mensaje.para}`,
    ...(mensaje.cc.length ? [`Cc: ${mensaje.cc.join(', ')}`] : []),
    `Subject: ${codificarAsunto(mensaje.asunto)}`,
    'MIME-Version: 1.0',
    ...(mensaje.enRespuestaA
      ? [`In-Reply-To: ${mensaje.enRespuestaA}`, `References: ${mensaje.enRespuestaA}`]
      : []),
  ]

  const alternativa = [
    `Content-Type: multipart/alternative; boundary="${limiteAlt}"`,
    '',
    `--${limiteAlt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    mensaje.texto,
    '',
    `--${limiteAlt}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    mensaje.html,
    '',
    `--${limiteAlt}--`,
  ]

  if (!hayAdjuntos) return [...cabeceras, ...alternativa].join('\r\n')

  const partesAdjuntos = mensaje.adjuntos.flatMap((a) => [
    `--${limiteMix}`,
    `Content-Type: ${a.tipo}; name="${nombreSeguro(a.nombre)}"`,
    `Content-Disposition: attachment; filename="${nombreSeguro(a.nombre)}"`,
    'Content-Transfer-Encoding: base64',
    '',
    troncear(Buffer.from(a.contenido).toString('base64')),
    '',
  ])

  return [
    ...cabeceras,
    `Content-Type: multipart/mixed; boundary="${limiteMix}"`,
    '',
    `--${limiteMix}`,
    ...alternativa,
    '',
    ...partesAdjuntos,
    `--${limiteMix}--`,
  ].join('\r\n')
}

export function aBase64Url(mime: string): string {
  return Buffer.from(mime, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
