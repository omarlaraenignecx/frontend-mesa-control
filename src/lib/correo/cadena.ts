import type { Hilo } from '@/lib/google/gmail-thread'
import { CORREO_MESA } from './render-correo'

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

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
 */
export function renderCadena(
  hilo: Hilo,
  v: VariablesCadena,
): { html: string; texto: string } {
  const mensajes = [...hilo.mensajes].sort((a, b) => a.fechaIso.localeCompare(b.fechaIso))

  const bloquesHtml = mensajes
    .map((m) => {
      const quien = m.deLaMesa ? 'Mesa de Control | Gplus Seguros' : m.autor
      const cuerpo = m.texto.trim()
        ? escapar(m.texto.trim()).replace(/\n/g, '<br>')
        : `<em style="color:#8a94a1">${SIN_TEXTO}</em>`
      const archivos = m.adjuntos.length
        ? `<div style="margin-top:10px;font-size:13px;color:#5a6572">Archivos: ${m.adjuntos
            .map((a) => escapar(a.nombre))
            .join(' · ')}</div>`
        : ''
      const fondo = m.deLaMesa ? '#eef4fb' : '#f6f7f9'
      return `<tr><td style="padding:0 24px 14px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${fondo};border:1px solid #e3e8ee;border-radius:10px">
                <tr><td style="padding:14px 16px">
                  <div style="font-size:13px;color:#5a6572;margin-bottom:6px">
                    <strong style="color:#1f2933">${escapar(quien)}</strong>${
                      m.correoAutor ? ` &lt;${escapar(m.correoAutor)}&gt;` : ''
                    } · ${fechaLegible(m.fechaIso)}
                  </div>
                  <div style="font-size:15px;line-height:1.6">${cuerpo}</div>
                  ${archivos}
                </td></tr>
              </table>
            </td></tr>`
    })
    .join('\n')

  const nota = v.nota.trim()
    ? `<tr><td style="padding:0 24px 18px;font-size:16px;line-height:1.6">${escapar(v.nota.trim()).replace(/\n/g, '<br>')}</td></tr>`
    : ''

  const referencia = `Caso ${escapar(v.folio)}${v.tramite ? ` · ${escapar(v.tramite)}` : ''}`

  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f5f7f9">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f9;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border:1px solid #e3e8ee;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
        <tr>
          <td style="background:#005ba9;padding:18px 24px;color:#ffffff">
            <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">Gplus Seguros</div>
            <div style="font-size:19px;font-weight:bold;margin-top:2px">Conversación del caso ${escapar(v.folio)}</div>
          </td>
        </tr>
        ${nota}
        <tr><td style="padding:18px 24px 10px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#8a94a1">
          ${mensajes.length} ${mensajes.length === 1 ? 'mensaje' : 'mensajes'}
        </td></tr>
        ${bloquesHtml}
        <tr>
          <td style="border-top:1px solid #e3e8ee;padding:18px 24px;font-size:14px;color:#5a6572">
            <div style="font-weight:bold;color:#1f2933">Mesa de Control — Gplus Seguros</div>
            <div style="margin-top:4px">Compartido por: ${escapar(v.atiende)}</div>
            <div style="margin-top:2px"><a href="mailto:${CORREO_MESA}" style="color:#005ba9;text-decoration:none">${CORREO_MESA}</a></div>
            <div style="margin-top:10px;font-size:12px;color:#8a94a1">${referencia}</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const bloquesTexto = mensajes.map((m) => {
    const quien = m.deLaMesa ? 'Mesa de Control | Gplus Seguros' : m.autor
    const archivos = m.adjuntos.length
      ? `\nArchivos: ${m.adjuntos.map((a) => a.nombre).join(' · ')}`
      : ''
    return `${quien} · ${fechaLegible(m.fechaIso)}\n${m.texto.trim() || SIN_TEXTO}${archivos}`
  })

  const texto = [
    `Conversación del caso ${v.folio}`,
    ...(v.nota.trim() ? ['', v.nota.trim()] : []),
    '',
    `${mensajes.length} ${mensajes.length === 1 ? 'mensaje' : 'mensajes'}`,
    '',
    bloquesTexto.join('\n\n----------\n\n'),
    '',
    '---',
    'Mesa de Control — Gplus Seguros',
    `Compartido por: ${v.atiende}`,
    CORREO_MESA,
    `Caso ${v.folio}${v.tramite ? ` · ${v.tramite}` : ''}`,
  ].join('\n')

  return { html, texto }
}
