import type { Hilo } from '@/lib/google/gmail-thread'
import {
  envolverCorreo,
  escapar,
  firmaHtml,
  parrafos,
  pieTexto,
  type ImagenInline,
} from './envoltura'
import { MARCA_MESA, PALETA, type MarcaCorreo } from './marca'

/**
 * Un adjunto de la conversación, identificado por la posición que ocupa en su
 * mensaje. La posición y no el attachmentId: Gmail regenera ese id en cada
 * lectura del mensaje, así que no sirve para referirse a un archivo después.
 */
export type AdjuntoDeCadena = {
  mensajeId: string
  indice: number
  nombre: string
  bytes: number
}

export type ResumenDeCadena = { mensajes: number; adjuntos: AdjuntoDeCadena[] }

export type VariablesCadena = {
  folio: string
  tramite: string
  nota: string
  atiende: string
}

/** Lo que el modal necesita saber antes de reenviar: cuánto se va a compartir. */
export function resumenDeCadena(hilo: Hilo): ResumenDeCadena {
  const adjuntos = hilo.mensajes.flatMap((m) =>
    m.adjuntos.map((a, indice) => ({
      mensajeId: m.id,
      indice,
      nombre: a.nombre,
      bytes: a.bytes,
    })),
  )
  return { mensajes: hilo.mensajes.length, adjuntos }
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fechaLegible(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}, ${d.getHours()}:${dos(d.getMinutes())}`
}

const SIN_TEXTO = '(sin texto)'

/**
 * Compone el correo que comparte la conversación completa con un tercero.
 *
 * Es una transcripción, no un reenvío nativo de Gmail: así el que la recibe lee
 * el caso de corrido, con quién dijo qué y cuándo, en lugar de una cadena de
 * citas anidadas. Los archivos van adjuntos al mismo correo y además nombrados
 * dentro de cada mensaje, para que se sepa a qué respuesta pertenecen.
 *
 * Los mensajes del área se distinguen de los del solicitante por una franja de color
 * al canto y un fondo apenas más frío, no por dos colores distintos: quien lee esto
 * suele ser un tercero —un ajustador, una aseguradora— y lo que necesita es seguir la
 * conversación, no descifrar una clave de colores.
 */
export function renderCadena(
  hilo: Hilo,
  v: VariablesCadena,
  marca: MarcaCorreo = MARCA_MESA,
): { html: string; texto: string; imagenes: ImagenInline[] } {
  const mensajes = [...hilo.mensajes].sort((a, b) => a.fechaIso.localeCompare(b.fechaIso))

  const bloquesHtml = mensajes
    .map((m) => {
      const quien = m.deLaMesa ? `${marca.titulo} | Gplus Seguros` : m.autor
      const cuerpo = m.texto.trim()
        ? escapar(m.texto.trim()).replace(/\n/g, '<br>')
        : `<em style="color:${PALETA.textoTenue}">${SIN_TEXTO}</em>`
      const archivos = m.adjuntos.length
        ? `<div style="margin-top:10px;font-size:13px;color:${PALETA.textoTenue}">Archivos: ${m.adjuntos
            .map((a) => escapar(a.nombre))
            .join(' · ')}</div>`
        : ''
      const canto = m.deLaMesa ? PALETA.cian : PALETA.borde
      const fondo = m.deLaMesa ? PALETA.cianSuave : '#f7f9fa'
      return `        <tr><td style="padding:0 28px 12px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${fondo};border:1px solid ${PALETA.borde};border-radius:10px">
                <tr>
                  <td width="3" style="width:3px;background:${canto};font-size:0;line-height:0">&nbsp;</td>
                  <td style="padding:14px 16px">
                    <div style="font-size:13px;color:${PALETA.textoTenue};margin-bottom:6px">
                      <strong style="color:${PALETA.tinta}">${escapar(quien)}</strong>${
                        m.correoAutor ? ` &lt;${escapar(m.correoAutor)}&gt;` : ''
                      } · ${fechaLegible(m.fechaIso)}
                    </div>
                    <div style="font-size:15px;line-height:1.6;color:${PALETA.texto}">${cuerpo}</div>
                    ${archivos}
                  </td>
                </tr>
              </table>
            </td></tr>`
    })
    .join('\n')

  const nota = v.nota.trim()
    ? `        <tr><td style="padding:26px 28px 4px">${parrafos(v.nota, '0 0 12px')}</td></tr>`
    : ''

  const cuantos = `${mensajes.length} ${mensajes.length === 1 ? 'mensaje' : 'mensajes'}`

  const contenido = `        <tr>
          <td style="padding:${nota ? '10px' : '26px'} 28px 4px">
            <div style="font-size:19px;font-weight:bold;color:${PALETA.tinta}">Conversación del caso ${escapar(v.folio)}</div>
          </td>
        </tr>
${nota}
        <tr><td style="padding:14px 28px 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${PALETA.textoTenue}">
          ${cuantos}
        </td></tr>
${bloquesHtml}
        <tr><td style="height:14px;font-size:0;line-height:0">&nbsp;</td></tr>`

  const { html, imagenes } = envolverCorreo({
    marca,
    vistaPrevia: v.nota.trim() || `Conversación del caso ${v.folio} · ${cuantos}`,
    referencia: `Caso ${escapar(v.folio)}${v.tramite ? ` · ${escapar(v.tramite)}` : ''}`,
    contenido,
    firma: firmaHtml(marca, { etiqueta: 'Compartido por', valor: v.atiende }),
    // Una transcripción con varios mensajes anidados necesita más aire que una
    // respuesta suelta.
    ancho: 700,
  })

  const bloquesTexto = mensajes.map((m) => {
    const quien = m.deLaMesa ? `${marca.titulo} | Gplus Seguros` : m.autor
    const archivos = m.adjuntos.length
      ? `\nArchivos: ${m.adjuntos.map((a) => a.nombre).join(' · ')}`
      : ''
    return `${quien} · ${fechaLegible(m.fechaIso)}\n${m.texto.trim() || SIN_TEXTO}${archivos}`
  })

  const texto = [
    `Conversación del caso ${v.folio}`,
    ...(v.nota.trim() ? ['', v.nota.trim()] : []),
    '',
    cuantos,
    '',
    bloquesTexto.join('\n\n----------\n\n'),
    '',
    ...pieTexto(marca, [marca.firma.puesto, `Compartido por: ${v.atiende}`]),
    '',
    `Caso ${v.folio}${v.tramite ? ` · ${v.tramite}` : ''}`,
  ].join('\n')

  return { html, texto, imagenes }
}
