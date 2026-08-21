export type AdjuntoSalida = { nombre: string; tipo: string; contenido: Uint8Array }

export const LIMITE_GMAIL_BYTES = 25 * 1024 * 1024

/**
 * base64 infla los datos un tercio, y el límite de Gmail aplica al correo
 * codificado: un archivo de 20 MB pesa unos 27 MB al enviarse.
 */
export function pesoCodificado(adjuntos: AdjuntoSalida[]): number {
  return adjuntos.reduce((total, a) => total + Math.ceil(a.contenido.length / 3) * 4, 0)
}

/**
 * Codifica un texto de cabecera cuando trae algo que no sea ASCII imprimible.
 *
 * Las cabeceras de un correo son ASCII de siete bits: una «ó» suelta ahí no viaja, y
 * los clientes la muestran como caracteres rotos —«AtenciÃƒÂ³n»—. La regla es de la
 * RFC 2047 y aplica a todas las cabeceras con texto libre, no solo al asunto.
 */
function codificarCabecera(texto: string): string {
  if (!/[^\x20-\x7E]/.test(texto)) return texto
  return `=?UTF-8?B?${Buffer.from(texto, 'utf8').toString('base64')}?=`
}

/**
 * Codifica el nombre visible de una dirección, dejando intacta la dirección misma.
 *
 * `Atención a Siniestros | Gplus Seguros <buzon@…>` se parte en dos: el nombre se
 * codifica y el `<buzon@…>` se queda tal cual, porque la RFC 2047 **no** permite
 * codificar la dirección —un `=?UTF-8?B?…?=` ahí dejaría el correo sin destinatario
 * válido—.
 *
 * Este defecto salió el 20/8/2026, al primer correo de siniestros. La Mesa de Control
 * nunca lo mostró porque «Mesa de Control | Gplus Seguros» es ASCII puro: el día que
 * un área con acento en el nombre empezó a escribir, apareció.
 */
export function codificarRemitente(de: string): string {
  const m = de.match(/^(.*?)\s*(<[^<>]+>)\s*$/)
  if (!m) return codificarCabecera(de)
  const [, nombre, direccion] = m
  if (!nombre.trim()) return direccion
  return `${codificarCabecera(nombre.trim())} ${direccion}`
}

const nombreSeguro = (nombre: string) => nombre.replace(/["\\\r\n]/g, '_')

/**
 * El nombre del archivo, en las dos formas que entienden los clientes de correo.
 *
 * `filename=` es ASCII por la misma regla de las cabeceras, así que un adjunto que se
 * llame «póliza.pdf» llega con el nombre roto. `filename*=` es la forma de la RFC 2231
 * que sí admite UTF-8; se manda junto con la otra para que un cliente viejo tenga algo
 * que leer. Solo se agrega cuando hace falta, para no cambiar los correos que ya
 * salían bien.
 */
function cabecerasDeNombre(nombre: string): string {
  const limpio = nombreSeguro(nombre)
  const base = `filename="${limpio}"`
  if (!/[^\x20-\x7E]/.test(limpio)) return base
  return `${base}; filename*=UTF-8''${encodeURIComponent(limpio)}`
}

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
    `From: ${codificarRemitente(mensaje.de)}`,
    `To: ${mensaje.para}`,
    ...(mensaje.cc.length ? [`Cc: ${mensaje.cc.join(', ')}`] : []),
    `Subject: ${codificarCabecera(mensaje.asunto)}`,
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
    `Content-Disposition: attachment; ${cabecerasDeNombre(a.nombre)}`,
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
