export type Variables = {
  solicitante: string
  folio: string
  agencia: string
  tramite: string
  atiende: string
  /**
   * Variables propias de un caso de siniestros. Opcionales porque en la mesa no
   * existen: una plantilla que las use en un caso de la mesa deja el `{{marcador}}`
   * tal cual, que es lo que hace `sustituirVariables` con lo que no conoce, y así se
   * ve el error en lugar de mandar una frase a medias.
   */
  cliente?: string
  aseguradora?: string
  numeroSiniestro?: string
  poliza?: string
  tipoSiniestro?: string
}

export const CORREO_MESA = 'mesadecontrol@gplusseguros.mx'

/**
 * La identidad con la que sale un correo: qué dice la banda, de qué color es y con
 * qué firma cierra.
 *
 * Existe porque hay dos áreas escribiendo desde la misma herramienta y no se parecen:
 * la Mesa de Control firma como equipo —«Atiende: quien lo tomó»— y Atención a
 * Siniestros firma como la persona que lleva el caso, con su puesto y su teléfono,
 * porque del otro lado hay un cliente con un siniestro encima y quiere saber a quién
 * le está hablando.
 */
export type MarcaCorreo = {
  /** Rótulo de la banda superior, bajo «Gplus Seguros». */
  titulo: string
  /** Color de la banda. */
  color: string
  firma: {
    nombre: string
    puesto: string | null
    telefono: string | null
    correo: string
  }
  /** Si el pie dice además quién del equipo está atendiendo. */
  muestraQuienAtiende: boolean
}

/**
 * La marca de la Mesa de Control, tal como salían sus correos antes de que hubiera
 * dos áreas. No se toca: son los correos que salen a diario a las agencias.
 */
export const MARCA_MESA: MarcaCorreo = {
  titulo: 'Mesa de Control',
  color: '#005ba9',
  firma: {
    nombre: 'Mesa de Control — Gplus Seguros',
    puesto: null,
    telefono: null,
    correo: CORREO_MESA,
  },
  muestraQuienAtiende: true,
}

/**
 * Cómo se anuncia el remitente en la cabecera del mensaje.
 *
 * El correo va aparte y no sale de `marca.firma`: el `From` **tiene que ser la cuenta
 * autenticada** con la que se está llamando a Gmail. Cuando no lo es, Gmail no falla
 * —lo reescribe en silencio, salvo que sea un alias verificado—, así que confiar en
 * el `From` que uno puso es engañarse. La firma del pie es otra cosa: son los datos de
 * contacto de la persona, y con el buzón provisional encendido no coinciden.
 */
export function remitenteDe(marca: MarcaCorreo, correoBuzon: string): string {
  return `${marca.titulo} | Gplus Seguros <${correoBuzon}>`
}

/**
 * Las variables de un caso, listas para la plantilla.
 *
 * La aseguradora sale primero de la que registró el área en el seguimiento y solo
 * después de la que declaró el solicitante: la primera es la que de verdad está
 * atendiendo el siniestro, y es la que el cliente espera leer.
 */
export function variablesDelCaso(
  caso: {
    nombreSolicitante: string | null
    agencia: string | null
    tipoTramite: string | null
    nombreCliente: string | null
    aseguradoraSeguimiento: string | null
    aseguradoraDeclarada: string | null
    numeroSiniestro: string | null
    tipoSiniestro: string | null
    poliza: string | null
  },
  folio: string,
  usuario: { nombreEnHoja: string | null; correo: string },
): Variables {
  return {
    solicitante: caso.nombreSolicitante ?? 'buen día',
    folio,
    agencia: caso.agencia ?? '',
    tramite: caso.tipoTramite ?? '',
    atiende: usuario.nombreEnHoja ?? usuario.correo,
    cliente: caso.nombreCliente ?? '',
    aseguradora: caso.aseguradoraSeguimiento ?? caso.aseguradoraDeclarada ?? '',
    numeroSiniestro: caso.numeroSiniestro ?? '',
    poliza: caso.poliza ?? '',
    tipoSiniestro: caso.tipoSiniestro ?? '',
  }
}

export function sustituirVariables(plantilla: string, v: Variables): string {
  return plantilla.replace(/\{\{\s*(\w+)\s*\}\}/g, (todo, nombre: string) => {
    const valor = (v as unknown as Record<string, string | undefined>)[nombre]
    return valor === undefined ? todo : valor
  })
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Aviso fijo que va en todos los correos que salen de la mesa.
 *
 * No vive en las plantillas que edita el área: si estuviera ahí, se podría borrar
 * al corregir un texto y bastaría una plantilla sin él para perder el hilo del
 * caso. Responder al mismo mensaje es lo que mantiene la conversación en el
 * `threadId` que la aplicación guardó para esta fila; un correo nuevo abre otra
 * conversación que ya no se ve dentro del caso.
 */
export function avisoDeRespuesta(folio: string): { titulo: string; detalle: string } {
  const referencia = folio.trim() ? `del caso ${folio.trim()}` : 'de tu solicitud'
  return {
    titulo: 'Responde en este mismo correo',
    detalle:
      `Para continuar, usa el botón Responder de este mensaje. Así tu respuesta ` +
      `queda en la conversación ${referencia} y la atendemos ahí mismo. ` +
      `Si escribes un correo nuevo, tu mensaje se separa del expediente y la ` +
      `atención se retrasa.`,
  }
}

/**
 * Los clientes de correo ignoran las hojas de estilo y muchos descartan lo que
 * no sea una tabla, así que el diseño va con estilos en línea sobre tablas.
 *
 * El cuerpo lo escribe la mesa, no la aplicación: se escapa antes de insertarlo
 * para que un signo de menor que no rompa el correo de la agencia.
 */
export function renderCorreo(
  cuerpoTexto: string,
  v: Variables,
  marca: MarcaCorreo = MARCA_MESA,
): { html: string; texto: string } {
  const parrafos = cuerpoTexto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;line-height:1.6">${escapar(p).replace(/\n/g, '<br>')}</p>`,
    )
    .join('\n            ')

  const referencia = `Caso ${escapar(v.folio)}${v.tramite ? ` · ${escapar(v.tramite)}` : ''}`
  const aviso = avisoDeRespuesta(v.folio)
  const { firma } = marca

  // Cada línea del pie solo aparece si trae dato: una firma con «TEL` vacío se lee
  // como un correo a medio hacer.
  const lineasFirma = [
    firma.puesto ? `<div style="margin-top:4px">${escapar(firma.puesto)}</div>` : '',
    marca.muestraQuienAtiende
      ? `<div style="margin-top:4px">Atiende: ${escapar(v.atiende)}</div>`
      : '',
    firma.telefono ? `<div style="margin-top:2px">TEL ${escapar(firma.telefono)}</div>` : '',
  ]
    .filter(Boolean)
    .join('\n            ')

  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f5f7f9">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f9;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #e3e8ee;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
        <tr>
          <td style="background:${marca.color};padding:18px 24px;color:#ffffff">
            <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">Gplus Seguros</div>
            <div style="font-size:19px;font-weight:bold;margin-top:2px">${escapar(marca.titulo)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;font-size:16px">
            ${parrafos}
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 22px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border:1px solid #f0d38a;border-radius:10px">
              <tr><td style="padding:14px 16px;font-size:15px;line-height:1.6;color:#6b5100">
                <div style="font-weight:bold">${escapar(aviso.titulo)}</div>
                <div style="margin-top:4px">${escapar(aviso.detalle)}</div>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #e3e8ee;padding:18px 24px;font-size:14px;color:#5a6572">
            <div style="font-weight:bold;color:#1f2933">${escapar(firma.nombre)}</div>
            ${lineasFirma}
            <div style="margin-top:2px"><a href="mailto:${firma.correo}" style="color:${marca.color};text-decoration:none">${escapar(firma.correo)}</a></div>
            <div style="margin-top:10px;font-size:12px;color:#8a94a1">${referencia}</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const texto = [
    cuerpoTexto.trim(),
    '',
    `** ${aviso.titulo} **`,
    aviso.detalle,
    '',
    '---',
    firma.nombre,
    firma.puesto,
    marca.muestraQuienAtiende ? `Atiende: ${v.atiende}` : null,
    firma.telefono ? `TEL ${firma.telefono}` : null,
    firma.correo,
    `Caso ${v.folio}${v.tramite ? ` · ${v.tramite}` : ''}`,
  ]
    .filter((l): l is string => Boolean(l))
    .join('\n')

  return { html, texto }
}
