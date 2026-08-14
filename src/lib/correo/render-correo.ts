export type Variables = {
  solicitante: string
  folio: string
  agencia: string
  tramite: string
  atiende: string
}

export const CORREO_MESA = 'mesadecontrol@gplusseguros.mx'
export const REMITENTE = `Mesa de Control | Gplus Seguros <${CORREO_MESA}>`

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
export function renderCorreo(cuerpoTexto: string, v: Variables): { html: string; texto: string } {
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

  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f5f7f9">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f9;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #e3e8ee;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
        <tr>
          <td style="background:#005ba9;padding:18px 24px;color:#ffffff">
            <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">Gplus Seguros</div>
            <div style="font-size:19px;font-weight:bold;margin-top:2px">Mesa de Control</div>
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
            <div style="font-weight:bold;color:#1f2933">Mesa de Control — Gplus Seguros</div>
            <div style="margin-top:4px">Atiende: ${escapar(v.atiende)}</div>
            <div style="margin-top:2px"><a href="mailto:${CORREO_MESA}" style="color:#005ba9;text-decoration:none">${CORREO_MESA}</a></div>
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
    'Mesa de Control — Gplus Seguros',
    `Atiende: ${v.atiende}`,
    CORREO_MESA,
    `Caso ${v.folio}${v.tramite ? ` · ${v.tramite}` : ''}`,
  ].join('\n')

  return { html, texto }
}
