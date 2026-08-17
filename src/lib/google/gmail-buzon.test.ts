import { describe, expect, it, vi } from 'vitest'
import { mensajesRecientes, metadatosDeMensaje } from './gmail-buzon'

const DEPS = {
  accessToken: 'ya29.token',
  correoMesa: 'mesadecontrol@gplusseguros.mx',
}

function conRespuesta(cuerpo: unknown, status = 200) {
  return vi.fn(
    async () => new Response(JSON.stringify(cuerpo), { status }),
  ) as unknown as typeof globalThis.fetch
}

const llamadas = (f: typeof globalThis.fetch) =>
  (f as unknown as ReturnType<typeof vi.fn>).mock.calls

describe('mensajesRecientes', () => {
  it('pide lo que entró al buzón y no lo que mandó la mesa', async () => {
    const fetchMock = conRespuesta({ messages: [{ id: 'm1', threadId: 't1' }] })
    await mensajesRecientes({ ...DEPS, fetch: fetchMock }, 2)
    const url = decodeURIComponent(String(llamadas(fetchMock)[0][0]))
    expect(url).toContain('in:inbox')
    expect(url).toContain('newer_than:2d')
    expect(url).toContain('-from:me')
  })

  it('devuelve el par mensaje-hilo, que es lo único que hace falta', async () => {
    // `messages.list` ya trae el threadId: no hace falta una llamada por mensaje
    // para saber a qué conversación pertenece.
    const fetchMock = conRespuesta({
      messages: [
        { id: 'm1', threadId: 't1' },
        { id: 'm2', threadId: 't1' },
      ],
    })
    expect(await mensajesRecientes({ ...DEPS, fetch: fetchMock })).toEqual([
      { id: 'm1', threadId: 't1' },
      { id: 'm2', threadId: 't1' },
    ])
    expect(llamadas(fetchMock)).toHaveLength(1)
  })

  it('un buzón sin nada nuevo devuelve lista vacía, no falla', async () => {
    expect(await mensajesRecientes({ ...DEPS, fetch: conRespuesta({}) })).toEqual([])
  })

  it('la ventana por omisión es de una semana, para sobrevivir a un fin de semana caído', async () => {
    // En el buzón real las respuestas de las agencias llegan con dos y tres días
    // de separación: una ventana de un día perdería avisos tras cualquier pausa.
    const fetchMock = conRespuesta({})
    await mensajesRecientes({ ...DEPS, fetch: fetchMock })
    expect(decodeURIComponent(String(llamadas(fetchMock)[0][0]))).toContain('newer_than:7d')
  })

  it('explica el error de Gmail en lugar de devolver basura', async () => {
    const fetchMock = conRespuesta({ error: { code: 403 } }, 403)
    await expect(mensajesRecientes({ ...DEPS, fetch: fetchMock })).rejects.toThrow(/403/)
  })
})

describe('metadatosDeMensaje', () => {
  it('saca el autor sin descargar el cuerpo del mensaje', async () => {
    const fetchMock = conRespuesta({
      payload: { headers: [{ name: 'From', value: 'Ana Pérez <ana@agencia.mx>' }] },
    })
    const meta = await metadatosDeMensaje({ ...DEPS, fetch: fetchMock }, 'm1')
    expect(meta.autor).toBe('Ana Pérez')
    expect(String(llamadas(fetchMock)[0][0])).toContain('format=metadata')
  })

  it('cuando el remitente solo trae correo, ese es el autor', async () => {
    const fetchMock = conRespuesta({
      payload: { headers: [{ name: 'From', value: 'ana@agencia.mx' }] },
    })
    expect((await metadatosDeMensaje({ ...DEPS, fetch: fetchMock }, 'm1')).autor).toBe(
      'ana@agencia.mx',
    )
  })

  it('quita las comillas del nombre, que Gmail agrega cuando trae coma', async () => {
    const fetchMock = conRespuesta({
      payload: { headers: [{ name: 'From', value: '"Pérez, Ana" <ana@agencia.mx>' }] },
    })
    expect((await metadatosDeMensaje({ ...DEPS, fetch: fetchMock }, 'm1')).autor).toBe('Pérez, Ana')
  })

  it('sin cabecera reconocible no deja el aviso sin sujeto', async () => {
    const fetchMock = conRespuesta({ payload: { headers: [] } })
    expect((await metadatosDeMensaje({ ...DEPS, fetch: fetchMock }, 'm1')).autor).toBe(
      'un remitente',
    )
  })
})
