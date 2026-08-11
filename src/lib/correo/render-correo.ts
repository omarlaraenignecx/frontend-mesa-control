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
    '---',
    'Mesa de Control — Gplus Seguros',
    `Atiende: ${v.atiende}`,
    CORREO_MESA,
    `Caso ${v.folio}${v.tramite ? ` · ${v.tramite}` : ''}`,
  ].join('\n')

  return { html, texto }
}
