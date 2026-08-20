import { describe, expect, it, vi } from 'vitest'
import { buscarHilo, leerHilo, normalizarMensaje, ubicarAdjunto } from './gmail-thread'

const CORREO_MESA = 'mesadecontrol@gplusseguros.mx'
const DEPS = (fetchMock: typeof globalThis.fetch) => ({
  fetch: fetchMock,
  accessToken: 'ya29.token',
  correoBuzon: CORREO_MESA,
})

function b64(texto: string) {
  return Buffer.from(texto, 'utf8').toString('base64url')
}

const MENSAJE_DE_LA_MESA = {
  id: 'm1',
  internalDate: '1754425000000',
  payload: {
    mimeType: 'multipart/alternative',
    headers: [
      { name: 'From', value: 'Mesa de Control | Gplus Seguros <mesadecontrol@gplusseguros.mx>' },
      { name: 'Subject', value: 'Seguimiento de Caso | Gplus Seguros | 7000' },
      { name: 'Message-ID', value: '<abc@mail.gmail.com>' },
    ],
    parts: [
      { mimeType: 'text/plain', body: { data: b64('Buen día Ricardo') } },
      { mimeType: 'text/html', body: { data: b64('<p>Buen día Ricardo</p>') } },
    ],
  },
}

const RESPUESTA_CON_ADJUNTO = {
  id: 'm2',
  internalDate: '1754430000000',
  payload: {
    mimeType: 'multipart/mixed',
    headers: [
      { name: 'From', value: 'Ricardo Hernandez <comercial28@garantiplus.mx>' },
      { name: 'Subject', value: 'Re: Seguimiento de Caso | Gplus Seguros | 7000' },
    ],
    parts: [
      {
        mimeType: 'multipart/alternative',
        parts: [
          {
            mimeType: 'text/plain',
            body: { data: b64('Adjunto la factura\n\nEl mar, 5 ago 2026, Mesa escribió:\n> Buen día') },
          },
        ],
      },
      {
        mimeType: 'application/pdf',
        filename: 'factura.pdf',
        body: { attachmentId: 'att1', size: 12345 },
      },
    ],
  },
}

function respuesta(cuerpo: unknown, status = 200) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(cuerpo), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof globalThis.fetch
}

describe('normalizarMensaje', () => {
  it('reconoce los mensajes que envió la mesa', () => {
    expect(normalizarMensaje(MENSAJE_DE_LA_MESA, CORREO_MESA).deLaMesa).toBe(true)
    expect(normalizarMensaje(RESPUESTA_CON_ADJUNTO, CORREO_MESA).deLaMesa).toBe(false)
  })

  it('extrae el nombre y el correo del autor', () => {
    const m = normalizarMensaje(RESPUESTA_CON_ADJUNTO, CORREO_MESA)
    expect(m.autor).toBe('Ricardo Hernandez')
    expect(m.correoAutor).toBe('comercial28@garantiplus.mx')
  })

  it('usa el correo como autor cuando no viene nombre', () => {
    const sinNombre = {
      ...RESPUESTA_CON_ADJUNTO,
      payload: { ...RESPUESTA_CON_ADJUNTO.payload, headers: [{ name: 'From', value: 'suelto@x.mx' }] },
    }
    expect(normalizarMensaje(sinNombre, CORREO_MESA).autor).toBe('suelto@x.mx')
  })

  it('devuelve la fecha como texto ISO, no como Date', () => {
    const m = normalizarMensaje(MENSAJE_DE_LA_MESA, CORREO_MESA)
    expect(typeof m.fechaIso).toBe('string')
    expect(m.fechaIso).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('prefiere el texto plano y le quita las citas', () => {
    expect(normalizarMensaje(RESPUESTA_CON_ADJUNTO, CORREO_MESA).texto).toBe('Adjunto la factura')
  })

  it('convierte el HTML cuando no hay texto plano', () => {
    const soloHtml = {
      ...MENSAJE_DE_LA_MESA,
      payload: {
        ...MENSAJE_DE_LA_MESA.payload,
        parts: [{ mimeType: 'text/html', body: { data: b64('<p>Solo <b>HTML</b></p>') } }],
      },
    }
    expect(normalizarMensaje(soloHtml, CORREO_MESA).texto).toBe('Solo HTML')
  })

  it('lista los adjuntos con nombre, tipo y tamaño', () => {
    const m = normalizarMensaje(RESPUESTA_CON_ADJUNTO, CORREO_MESA)
    expect(m.adjuntos).toEqual([
      { id: 'att1', nombre: 'factura.pdf', tipo: 'application/pdf', bytes: 12345 },
    ])
  })

  it('no confunde una parte de texto con un adjunto', () => {
    expect(normalizarMensaje(MENSAJE_DE_LA_MESA, CORREO_MESA).adjuntos).toEqual([])
  })

  it('conserva el Message-ID para poder responder en el hilo', () => {
    expect(normalizarMensaje(MENSAJE_DE_LA_MESA, CORREO_MESA).messageId).toBe(
      '<abc@mail.gmail.com>',
    )
  })

  it('tolera un mensaje sin cuerpo sin lanzar', () => {
    const vacio = { id: 'm3', internalDate: '1754430000000', payload: { headers: [] } }
    expect(() => normalizarMensaje(vacio, CORREO_MESA)).not.toThrow()
    expect(normalizarMensaje(vacio, CORREO_MESA).texto).toBe('')
  })

  it('lee el cuerpo cuando viene en el payload y no en partes', () => {
    const simple = {
      id: 'm4',
      internalDate: '1754430000000',
      payload: {
        mimeType: 'text/plain',
        headers: [{ name: 'From', value: 'a@x.mx' }],
        body: { data: b64('Mensaje simple') },
      },
    }
    expect(normalizarMensaje(simple, CORREO_MESA).texto).toBe('Mensaje simple')
  })

  it('compara el correo de la mesa sin distinguir mayúsculas', () => {
    const mayusculas = {
      ...MENSAJE_DE_LA_MESA,
      payload: {
        ...MENSAJE_DE_LA_MESA.payload,
        headers: [{ name: 'From', value: 'MesaDeControl@GplusSeguros.MX' }],
      },
    }
    expect(normalizarMensaje(mayusculas, CORREO_MESA).deLaMesa).toBe(true)
  })
})

describe('ubicarAdjunto', () => {
  const hilo = {
    threadId: 't1',
    mensajes: [
      normalizarMensaje(MENSAJE_DE_LA_MESA, CORREO_MESA),
      normalizarMensaje(RESPUESTA_CON_ADJUNTO, CORREO_MESA),
    ],
  }

  it('ubica el adjunto por su posición dentro del mensaje', () => {
    // El attachmentId de Gmail cambia en cada lectura del mensaje, así que la
    // referencia estable es la posición: el id se toma de la lectura actual.
    const r = ubicarAdjunto(hilo, 'm2', 0)
    expect(r).toEqual({
      mensajeId: 'm2',
      adjuntoId: 'att1',
      nombre: 'factura.pdf',
      tipo: 'application/pdf',
    })
  })

  it('devuelve null si el mensaje no está en el hilo de ese caso', () => {
    expect(ubicarAdjunto(hilo, 'ajeno', 0)).toBeNull()
  })

  it('devuelve null si la posición no existe en ese mensaje', () => {
    expect(ubicarAdjunto(hilo, 'm2', 5)).toBeNull()
    expect(ubicarAdjunto(hilo, 'm1', 0)).toBeNull()
  })

  it('devuelve null ante una posición que no es un número válido', () => {
    expect(ubicarAdjunto(hilo, 'm2', -1)).toBeNull()
    expect(ubicarAdjunto(hilo, 'm2', Number.NaN)).toBeNull()
  })
})

describe('leerHilo', () => {
  it('ordena los mensajes del más antiguo al más reciente', async () => {
    const fetchMock = respuesta({
      id: 't1',
      messages: [RESPUESTA_CON_ADJUNTO, MENSAJE_DE_LA_MESA],
    })
    const hilo = await leerHilo(DEPS(fetchMock), 't1')
    expect(hilo.mensajes.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(hilo.threadId).toBe('t1')
  })

  it('pide el formato completo, que es el que trae el cuerpo', async () => {
    const fetchMock = respuesta({ id: 't1', messages: [MENSAJE_DE_LA_MESA] })
    await leerHilo(DEPS(fetchMock), 't1')
    const [url] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toContain('format=full')
    expect(String(url)).toContain('/threads/t1')
  })

  it('explica el 404 como hilo inexistente', async () => {
    const fetchMock = respuesta({ error: { code: 404 } }, 404)
    await expect(leerHilo(DEPS(fetchMock), 'inexistente')).rejects.toThrow(/no existe/)
  })

  it('devuelve un hilo vacío sin lanzar si Gmail no manda mensajes', async () => {
    const fetchMock = respuesta({ id: 't1' })
    const hilo = await leerHilo(DEPS(fetchMock), 't1')
    expect(hilo.mensajes).toEqual([])
  })
})

describe('buscarHilo', () => {
  it('busca por el asunto exacto del caso', async () => {
    const fetchMock = respuesta({ threads: [{ id: 't9' }] })
    const id = await buscarHilo(DEPS(fetchMock), '7000')
    expect(id).toBe('t9')
    const [url] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(decodeURIComponent(String(url))).toContain(
      'subject:"Seguimiento de Caso | Gplus Seguros | 7000"',
    )
  })

  it('devuelve null cuando no hay hilo todavía', async () => {
    expect(await buscarHilo(DEPS(respuesta({})), '7000')).toBeNull()
  })

  it('toma el primero cuando hay varios hilos con el mismo asunto', async () => {
    const fetchMock = respuesta({ threads: [{ id: 'primero' }, { id: 'segundo' }] })
    expect(await buscarHilo(DEPS(fetchMock), '7000')).toBe('primero')
  })
})
