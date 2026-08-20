import { describe, expect, it } from 'vitest'
import {
  LIMITE_GMAIL_BYTES,
  aBase64Url,
  codificarRemitente,
  componerMime,
  pesoCodificado,
} from './mime'

const BASE = {
  de: 'Mesa de Control | Gplus Seguros <mesadecontrol@gplusseguros.mx>',
  para: 'comercial28@garantiplus.mx',
  cc: [] as string[],
  asunto: 'Seguimiento de Caso | Gplus Seguros | 7000',
  html: '<p>Buen día</p>',
  texto: 'Buen día',
  adjuntos: [],
}

describe('componerMime', () => {
  it('incluye las cabeceras básicas', () => {
    const mime = componerMime(BASE)
    expect(mime).toContain('From: Mesa de Control | Gplus Seguros <mesadecontrol@gplusseguros.mx>')
    expect(mime).toContain('To: comercial28@garantiplus.mx')
    expect(mime).toContain('MIME-Version: 1.0')
  })

  it('codifica el asunto en base64 para que los acentos no se rompan', () => {
    const mime = componerMime({ ...BASE, asunto: 'Cotización número 7000' })
    expect(mime).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/)
    expect(mime).not.toContain('Subject: Cotización')
  })

  it('deja el asunto tal cual cuando es puro ASCII', () => {
    expect(componerMime(BASE)).toContain('Subject: Seguimiento de Caso | Gplus Seguros | 7000')
  })

  it('omite la cabecera CC cuando no hay copias', () => {
    expect(componerMime(BASE)).not.toContain('Cc:')
  })

  it('junta las copias separadas por coma', () => {
    const mime = componerMime({ ...BASE, cc: ['a@x.mx', 'b@x.mx'] })
    expect(mime).toContain('Cc: a@x.mx, b@x.mx')
  })

  it('manda las dos alternativas, texto y HTML', () => {
    const mime = componerMime(BASE)
    expect(mime).toContain('multipart/alternative')
    expect(mime).toContain('Content-Type: text/plain; charset="UTF-8"')
    expect(mime).toContain('Content-Type: text/html; charset="UTF-8"')
  })

  it('usa multipart/mixed y codifica el adjunto en base64 cuando hay archivos', () => {
    const mime = componerMime({
      ...BASE,
      adjuntos: [
        { nombre: 'factura.pdf', tipo: 'application/pdf', contenido: new Uint8Array([1, 2, 3]) },
      ],
    })
    expect(mime).toContain('multipart/mixed')
    expect(mime).toContain('Content-Type: application/pdf; name="factura.pdf"')
    expect(mime).toContain('Content-Disposition: attachment; filename="factura.pdf"')
    expect(mime).toContain('Content-Transfer-Encoding: base64')
  })

  it('incluye In-Reply-To y References al responder, para que el cliente agrupe', () => {
    const mime = componerMime({ ...BASE, enRespuestaA: '<abc@mail.gmail.com>' })
    expect(mime).toContain('In-Reply-To: <abc@mail.gmail.com>')
    expect(mime).toContain('References: <abc@mail.gmail.com>')
  })

  it('no incluye In-Reply-To en el primer correo del caso', () => {
    expect(componerMime(BASE)).not.toContain('In-Reply-To')
  })

  it('escapa las comillas del nombre del archivo', () => {
    const mime = componerMime({
      ...BASE,
      adjuntos: [
        { nombre: 'la "buena".pdf', tipo: 'application/pdf', contenido: new Uint8Array([1]) },
      ],
    })
    expect(mime).not.toContain('filename="la "buena".pdf"')
  })

  it('separa las cabeceras del cuerpo con CRLF, como exige el formato', () => {
    expect(componerMime(BASE)).toContain('\r\n')
  })

  it('cierra los límites de cada parte', () => {
    const mime = componerMime({
      ...BASE,
      adjuntos: [{ nombre: 'a.pdf', tipo: 'application/pdf', contenido: new Uint8Array([1]) }],
    })
    const limiteMix = mime.match(/boundary="(mix_[^"]+)"/)?.[1]
    expect(limiteMix).toBeDefined()
    expect(mime).toContain(`--${limiteMix}--`)
  })
})

describe('pesoCodificado', () => {
  it('cuenta la sobrecarga de base64, que infla un tercio', () => {
    const peso = pesoCodificado([
      {
        nombre: 'a.bin',
        tipo: 'application/octet-stream',
        contenido: new Uint8Array(3 * 1024 * 1024),
      },
    ])
    expect(peso).toBeGreaterThan(3 * 1024 * 1024)
    expect(peso).toBeLessThan(5 * 1024 * 1024)
  })

  it('el límite declarado es el de Gmail', () => {
    expect(LIMITE_GMAIL_BYTES).toBe(25 * 1024 * 1024)
  })

  it('sin adjuntos el peso es cero', () => {
    expect(pesoCodificado([])).toBe(0)
  })

  it('suma varios adjuntos', () => {
    const uno = { nombre: 'a', tipo: 't', contenido: new Uint8Array(1000) }
    expect(pesoCodificado([uno, uno])).toBe(pesoCodificado([uno]) * 2)
  })
})

describe('aBase64Url', () => {
  it('produce base64url, sin +, / ni =', () => {
    const codificado = aBase64Url('cuerpo con acentós y símbolos +/=')
    expect(codificado).not.toMatch(/[+/=]/)
  })

  it('el resultado se puede decodificar de vuelta', () => {
    const original = 'Seguimiento de Caso | Gplus Seguros | 7000'
    const ida = aBase64Url(original)
    expect(Buffer.from(ida, 'base64url').toString('utf8')).toBe(original)
  })
})

describe('acentos en las cabeceras', () => {
  it('codifica el nombre del remitente y deja intacta la dirección', () => {
    // El defecto del 20/8/2026: «Atención a Siniestros» llegó como «AtenciÃƒÂ³n».
    // Las cabeceras son ASCII de siete bits; el nombre va en base64 de la RFC 2047 y
    // la dirección **no**, o el correo se queda sin remitente válido.
    const de = 'Atención a Siniestros | Gplus Seguros <mesadecontrol@gplusseguros.mx>'
    const codificado = codificarRemitente(de)
    expect(codificado).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?= <mesadecontrol@gplusseguros\.mx>$/)
    const [, base64] = codificado.match(/=\?UTF-8\?B\?([^?]+)\?=/)!
    expect(Buffer.from(base64, 'base64').toString('utf8')).toBe(
      'Atención a Siniestros | Gplus Seguros',
    )
  })

  it('deja tal cual un remitente que ya es ASCII', () => {
    // Los correos de la mesa salen así todos los días: no se toca ni un byte.
    const de = 'Mesa de Control | Gplus Seguros <mesadecontrol@gplusseguros.mx>'
    expect(codificarRemitente(de)).toBe(de)
  })

  it('una dirección sin nombre visible se queda sola', () => {
    expect(codificarRemitente('<a@b.mx>')).toBe('<a@b.mx>')
  })

  it('el From del MIME va codificado', () => {
    const mime = componerMime({
      de: 'Atención a Siniestros | Gplus Seguros <buzon@gplusseguros.mx>',
      para: 'cliente@x.mx',
      cc: [],
      asunto: 'Seguimiento de Caso | Gplus Seguros | 9004',
      html: '<p>hola</p>',
      texto: 'hola',
      adjuntos: [],
    })
    expect(mime).toContain('From: =?UTF-8?B?')
    expect(mime).toContain('<buzon@gplusseguros.mx>')
    // Y el acento no viaja crudo en ninguna cabecera.
    const cabeceras = mime.slice(0, mime.indexOf('\r\n\r\n'))
    expect(cabeceras).not.toContain('Atención')
  })

  it('un adjunto con acentos lleva el nombre en las dos formas', () => {
    const mime = componerMime({
      de: 'Mesa de Control <m@x.mx>',
      para: 'a@b.mx',
      cc: [],
      asunto: 'x',
      html: '<p>x</p>',
      texto: 'x',
      adjuntos: [{ nombre: 'póliza.pdf', tipo: 'application/pdf', contenido: new Uint8Array([1]) }],
    })
    expect(mime).toContain('filename="póliza.pdf"')
    expect(mime).toContain("filename*=UTF-8''p%C3%B3liza.pdf")
  })

  it('un adjunto sin acentos no cambia', () => {
    const mime = componerMime({
      de: 'Mesa de Control <m@x.mx>',
      para: 'a@b.mx',
      cc: [],
      asunto: 'x',
      html: '<p>x</p>',
      texto: 'x',
      adjuntos: [{ nombre: 'poliza.pdf', tipo: 'application/pdf', contenido: new Uint8Array([1]) }],
    })
    expect(mime).toContain('filename="poliza.pdf"')
    expect(mime).not.toContain('filename*=')
  })
})
