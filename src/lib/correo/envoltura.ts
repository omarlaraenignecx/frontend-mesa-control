import { LOGO_GPLUS } from './marca/logo'
import { PALETA, type MarcaCorreo } from './marca'

/**
 * Una imagen que viaja dentro del correo y se dibuja en el cuerpo, no como archivo
 * adjunto que el destinatario tenga que abrir.
 *
 * `base64` ya viene codificado porque así se guarda el logo y así se manda: pasarlo a
 * bytes para volverlo a codificar en cada correo sería trabajo para llegar al mismo
 * sitio.
 */
export type ImagenInline = {
  /** Lo que el HTML pide con `src="cid:…"`. */
  cid: string
  nombre: string
  tipo: string
  base64: string
}

export function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Los párrafos del cuerpo, a partir del texto que escribió el área. */
export function parrafos(texto: string, margen = '0 0 15px'): string {
  return texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:${margen};font-size:16px;line-height:1.65;color:${PALETA.texto}">` +
        `${escapar(p).replace(/\n/g, '<br>')}</p>`,
    )
    .join('\n            ')
}

/**
 * Lo que el cliente de correo enseña en la bandeja, junto al asunto, antes de abrir
 * el mensaje.
 *
 * Sin esto toma las primeras palabras del HTML, que son las de la cabecera: la
 * bandeja se llenaba de correos que decían todos «Gplus Seguros · Mesa de Control».
 * El bloque va oculto —con todas las propiedades a la vez, porque cada cliente
 * respeta una— y termina en un relleno de espacios invisibles para que no se cuele
 * detrás el texto que sigue.
 */
function vistaPreviaOculta(texto: string): string {
  const limpio = escapar(texto.replace(/\s+/g, ' ').trim().slice(0, 140))
  if (!limpio) return ''
  return (
    `<div style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;` +
    `mso-hide:all;font-size:1px;line-height:1px;color:${PALETA.tarjeta}">${limpio}` +
    '&#8199;&#65279;'.repeat(60) +
    '</div>'
  )
}

/**
 * La firma del pie, con una línea por dato que exista.
 *
 * Cada línea es condicional a propósito: una firma con «TEL» y nada al lado se lee
 * como un correo a medio hacer, y del otro lado hay un cliente.
 */
export function firmaHtml(
  marca: MarcaCorreo,
  extra?: { etiqueta: string; valor: string } | null,
): string {
  const { firma } = marca
  const lineas = [
    firma.puesto
      ? `<div style="margin-top:3px;font-size:14px;color:${PALETA.textoTenue}">${escapar(firma.puesto)}</div>`
      : '',
    extra
      ? `<div style="margin-top:3px;font-size:14px;color:${PALETA.textoTenue}">${escapar(extra.etiqueta)}: ${escapar(extra.valor)}</div>`
      : '',
    firma.telefono
      ? `<div style="margin-top:6px;font-size:14px"><a href="tel:${escapar(firma.telefono.replace(/[^\d+]/g, ''))}" style="color:${PALETA.profundo};text-decoration:none">${escapar(firma.telefono)}</a></div>`
      : '',
    `<div style="margin-top:${firma.telefono ? 2 : 6}px;font-size:14px"><a href="mailto:${escapar(firma.correo)}" style="color:${PALETA.profundo};text-decoration:none">${escapar(firma.correo)}</a></div>`,
  ].filter(Boolean)

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="3" style="width:3px;background:${PALETA.cian};border-radius:2px">&nbsp;</td>
                <td style="padding-left:14px">
                  <div style="font-size:15px;font-weight:bold;color:${PALETA.tinta}">${escapar(firma.nombre)}</div>
                  ${lineas.join('\n                  ')}
                </td>
              </tr>
            </table>`
}

/**
 * Una tarjeta de aviso dentro del correo, en los colores de la marca.
 *
 * Antes era ámbar, de advertencia. Se cambió porque lo que dice no es un problema
 * —es una indicación de cómo seguir—, y un recuadro amarillo en un correo a un
 * cliente que acaba de tener un siniestro dice otra cosa.
 */
export function avisoHtml(titulo: string, detalle: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PALETA.cianSuave};border:1px solid #cfeaf1;border-radius:10px">
              <tr>
                <td width="4" style="width:4px;background:${PALETA.cian};font-size:0;line-height:0">&nbsp;</td>
                <td style="padding:14px 18px">
                  <div style="font-size:15px;font-weight:bold;color:${PALETA.profundo}">${escapar(titulo)}</div>
                  <div style="margin-top:5px;font-size:14px;line-height:1.6;color:${PALETA.texto}">${escapar(detalle)}</div>
                </td>
              </tr>
            </table>`
}

const CONFIDENCIALIDAD =
  'Este mensaje y los archivos que lo acompañan son confidenciales y están dirigidos ' +
  'únicamente a su destinatario. Si lo recibió por error, le agradecemos avisarnos ' +
  'respondiendo a este correo y eliminarlo.'

/**
 * El chasis de todos los correos que salen a un cliente.
 *
 * Los clientes de correo ignoran las hojas de estilo y muchos descartan lo que no sea
 * una tabla, así que el diseño va con estilos en línea sobre tablas anidadas: es feo
 * de leer y es la única forma que llega igual a Gmail, a Outlook y al teléfono.
 *
 * La cabecera es blanca con el logo a color, como el sitio de Gplus. Ponerlo en
 * blanco sobre una banda de color obligaba a una versión monocroma del logo, y en esa
 * versión se pierden el degradado de «GPLUS» y la hoja: el logo del cliente dejaba de
 * ser el logo del cliente.
 */
export function envolverCorreo(opciones: {
  marca: MarcaCorreo
  /** Lo que se lee en la bandeja antes de abrir el correo. */
  vistaPrevia: string
  /** La referencia del caso, a la derecha del rótulo del área. */
  referencia: string
  /** El contenido, ya como filas `<tr>` de la tabla de la tarjeta. */
  contenido: string
  /** El pie con la firma, ya como HTML. */
  firma: string
  /** Ancho máximo de la tarjeta. El reenvío de una conversación pide más. */
  ancho?: number
}): { html: string; imagenes: ImagenInline[] } {
  const { marca, referencia, contenido, firma, ancho = 620 } = opciones

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:${PALETA.fondo};-webkit-font-smoothing:antialiased">
  ${vistaPreviaOculta(opciones.vistaPrevia)}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PALETA.fondo};padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${ancho}px;background:${PALETA.tarjeta};border:1px solid ${PALETA.borde};border-radius:14px;overflow:hidden;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${PALETA.texto}">
        <tr>
          <td style="padding:24px 28px 20px;background:${PALETA.tarjeta}">
            <img src="cid:${LOGO_GPLUS.cid}" width="${LOGO_GPLUS.ancho}" height="${LOGO_GPLUS.alto}" alt="Gplus Seguros" style="display:block;border:0;outline:none;text-decoration:none;width:${LOGO_GPLUS.ancho}px;height:${LOGO_GPLUS.alto}px">
          </td>
        </tr>
        <tr><td style="height:3px;background:${PALETA.cian};font-size:0;line-height:0">&nbsp;</td></tr>
        <tr>
          <td style="background:${PALETA.cianSuave};border-bottom:1px solid ${PALETA.borde};padding:11px 28px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:12px;font-weight:bold;letter-spacing:.09em;text-transform:uppercase;color:${PALETA.profundo}">${escapar(marca.titulo)}</td>
                <td align="right" style="font-size:12px;color:${PALETA.textoTenue};white-space:nowrap">${referencia}</td>
              </tr>
            </table>
          </td>
        </tr>
${contenido}
        <tr>
          <td style="border-top:1px solid ${PALETA.borde};padding:20px 28px">
            ${firma}
          </td>
        </tr>
        <tr>
          <td style="background:${PALETA.pie};border-top:1px solid ${PALETA.borde};padding:16px 28px">
            <div style="font-size:12px;color:${PALETA.gris};line-height:1.6">${CONFIDENCIALIDAD}</div>
            <div style="margin-top:8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#9aa4ae">Gplus Seguros · by EngineCX</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { html, imagenes: [LOGO_GPLUS] }
}

/** El pie de la versión en texto plano, que va en el mismo correo para quien no lee HTML. */
export function pieTexto(marca: MarcaCorreo, lineas: (string | null)[]): string[] {
  return [
    '---',
    marca.firma.nombre,
    ...lineas,
    marca.firma.telefono ? `TEL ${marca.firma.telefono}` : null,
    marca.firma.correo,
    '',
    CONFIDENCIALIDAD,
  ].filter((l): l is string => Boolean(l))
}
