import { describe, expect, it } from 'vitest'
import { LIMITE_GMAIL_BYTES, aBase64Url, componerMime, pesoCodificado } from './mime'

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
