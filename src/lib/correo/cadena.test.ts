import { describe, expect, it } from 'vitest'
import type { Hilo } from '@/lib/google/gmail-thread'
import { renderCadena, resumenDeCadena } from './cadena'

const HILO: Hilo = {
  threadId: 't1',
  mensajes: [
    {
      id: 'm1',
      messageId: '<a@mail>',
      deLaMesa: true,
      autor: 'Mesa de Control | Gplus Seguros',
      correoAutor: 'mesadecontrol@gplusseguros.mx',
      fechaIso: new Date(2026, 7, 11, 9, 30).toISOString(),
      texto: 'Buen día Ricardo, ya solicitamos la emisión.',
      adjuntos: [],
    },
    {
      id: 'm2',
      messageId: '<b@mail>',
      deLaMesa: false,
      autor: 'Ricardo Hernandez',
      correoAutor: 'comercial28@garantiplus.mx',
      fechaIso: new Date(2026, 7, 11, 11, 0).toISOString(),
      texto: 'Adjunto la factura y la <identificación> del cliente.',
      adjuntos: [
        { id: 'att1', nombre: 'factura.pdf', tipo: 'application/pdf', bytes: 120_000 },
        { id: 'att2', nombre: 'ine.jpg', tipo: 'image/jpeg', bytes: 900_000 },
      ],
    },
  ],
}

const VARIABLES = { folio: '9002', tramite: 'Emisión', nota: '', atiende: 'Keynor Rivas' }

describe('resumenDeCadena', () => {
  it('cuenta los mensajes de la conversación', () => {
    expect(resumenDeCadena(HILO).mensajes).toBe(2)
  })

  it('lista los adjuntos con la posición que los identifica', () => {
    // La posición es la referencia estable: el attachmentId de Gmail cambia en
    // cada lectura del mensaje.
    expect(resumenDeCadena(HILO).adjuntos).toEqual([
      { mensajeId: 'm2', indice: 0, nombre: 'factura.pdf', bytes: 120_000 },
      { mensajeId: 'm2', indice: 1, nombre: 'ine.jpg', bytes: 900_000 },
    ])
  })

  it('un hilo sin archivos no reporta ninguno', () => {
    const solo = { ...HILO, mensajes: [HILO.mensajes[0]] }
    expect(resumenDeCadena(solo)).toEqual({ mensajes: 1, adjuntos: [] })
  })
})

describe('renderCadena', () => {
  it('transcribe los mensajes en orden, del más antiguo al más reciente', () => {
    const { texto } = renderCadena(HILO, VARIABLES)
    expect(texto.indexOf('ya solicitamos la emisión')).toBeLessThan(
      texto.indexOf('Adjunto la factura'),
    )
  })

  it('dice quién escribió cada mensaje', () => {
    const { texto } = renderCadena(HILO, VARIABLES)
    expect(texto).toContain('Mesa de Control')
    expect(texto).toContain('Ricardo Hernandez')
  })

  it('nombra los archivos de cada mensaje', () => {
    const { html, texto } = renderCadena(HILO, VARIABLES)
    expect(texto).toContain('factura.pdf')
    expect(html).toContain('ine.jpg')
  })

  it('identifica el caso en el encabezado', () => {
    const { html, texto } = renderCadena(HILO, VARIABLES)
    expect(html).toContain('9002')
    expect(texto).toContain('9002')
  })

  it('incluye la nota de quien reenvía cuando la escribió', () => {
    const { html, texto } = renderCadena(HILO, { ...VARIABLES, nota: 'Te paso el caso, Andrés.' })
    expect(texto).toContain('Te paso el caso, Andrés.')
    expect(html).toContain('Te paso el caso, Andr')
  })

  it('escapa el texto de los mensajes: nadie escribe HTML por accidente', () => {
    const { html } = renderCadena(HILO, VARIABLES)
    expect(html).toContain('&lt;identificación&gt;')
    expect(html).not.toContain('<identificación>')
  })

  it('un mensaje sin texto no se muestra vacío y sin explicación', () => {
    const mudo: Hilo = {
      ...HILO,
      mensajes: [{ ...HILO.mensajes[0], texto: '' }],
    }
    expect(renderCadena(mudo, VARIABLES).texto).toContain('(sin texto)')
  })
})
