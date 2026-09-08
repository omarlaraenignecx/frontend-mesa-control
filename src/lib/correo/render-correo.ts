import {
  avisoHtml,
  envolverCorreo,
  escapar,
  firmaHtml,
  parrafos,
  pieTexto,
  type ImagenInline,
} from './envoltura'
import { MARCA_MESA, type MarcaCorreo } from './marca'

export {
  CORREO_MESA,
  MARCA_MESA,
  PALETA,
  remitenteDe,
  type MarcaCorreo,
} from './marca'

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

/**
 * Aviso fijo que va en todos los correos que salen de la mesa.
 *
 * No vive en las plantillas que edita el área: si estuviera ahí, se podría borrar
 * al corregir un texto y bastaría una plantilla sin él para perder el hilo del
 * caso. Responder al mismo mensaje es lo que mantiene la conversación en el
 * `threadId` que la aplicación guardó para esta fila; un correo nuevo abre otra
 * conversación que ya no se ve dentro del caso.
 *
 * Está escrito **sin tutear ni hablar de usted** porque lo firman las dos áreas y no
 * tratan igual a quien les lee: la mesa tutea a las agencias, con las que trabaja a
 * diario, y siniestros habla de usted a un cliente al que le acaba de pasar algo.
 * Redactado en cualquiera de los dos tratos, uno de los dos correos salía
 * contradiciéndose a sí mismo a media página.
 */
export function avisoDeRespuesta(folio: string): { titulo: string; detalle: string } {
  const referencia = folio.trim() ? `del caso ${folio.trim()}` : 'de la solicitud'
  return {
    titulo: 'La conversación continúa en este correo',
    detalle:
      `Al usar el botón Responder de este mensaje, la respuesta queda en la ` +
      `conversación ${referencia} y se atiende ahí mismo. Un correo nuevo se separa ` +
      `del expediente y retrasa la atención.`,
  }
}

/** La referencia del caso, tal como se lee en la banda superior del correo. */
function referenciaDe(v: Variables): string {
  return `Caso ${escapar(v.folio)}${v.tramite ? ` · ${escapar(v.tramite)}` : ''}`
}

/**
 * El correo que sale a la agencia o al cliente.
 *
 * El cuerpo lo escribe el área, no la aplicación: se escapa antes de insertarlo para
 * que un signo de menor que no rompa el correo de quien lo reciba. Todo lo demás
 * —cabecera, aviso, firma y pie— lo pone el chasis de `envolverCorreo`.
 */
export function renderCorreo(
  cuerpoTexto: string,
  v: Variables,
  marca: MarcaCorreo = MARCA_MESA,
): { html: string; texto: string; imagenes: ImagenInline[] } {
  const aviso = avisoDeRespuesta(v.folio)

  const contenido = `        <tr>
          <td style="padding:28px 28px 8px">
            ${parrafos(cuerpoTexto)}
          </td>
        </tr>
        <tr>
          <td style="padding:12px 28px 26px">
            ${avisoHtml(aviso.titulo, aviso.detalle)}
          </td>
        </tr>`

  const { html, imagenes } = envolverCorreo({
    marca,
    // La bandeja enseña el arranque del mensaje del área, que es lo que de verdad
    // distingue un correo de otro; el nombre del área ya va en el remitente.
    vistaPrevia: cuerpoTexto,
    referencia: referenciaDe(v),
    contenido,
    firma: firmaHtml(
      marca,
      marca.muestraQuienAtiende ? { etiqueta: 'Atiende', valor: v.atiende } : null,
    ),
  })

  const texto = [
    cuerpoTexto.trim(),
    '',
    `** ${aviso.titulo} **`,
    aviso.detalle,
    '',
    ...pieTexto(marca, [
      marca.firma.puesto,
      marca.muestraQuienAtiende ? `Atiende: ${v.atiende}` : null,
    ]),
    '',
    `Caso ${v.folio}${v.tramite ? ` · ${v.tramite}` : ''}`,
  ].join('\n')

  return { html, texto, imagenes }
}
