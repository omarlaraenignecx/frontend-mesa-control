import { describe, expect, it, vi } from 'vitest'
import { CorreoDemasiadoGrandeError, enviarCorreo } from './gmail-send'

const DEPS = (fetchMock: typeof globalThis.fetch) => ({
  fetch: fetchMock,
  accessToken: 'ya29.token',
  correoBuzon: 'mesadecontrol@gplusseguros.mx',
})

const MENSAJE = {
  de: 'Mesa de Control | Gplus Seguros <mesadecontrol@gplusseguros.mx>',
  para: 'comercial28@garantiplus.mx',
  cc: [] as string[],
  asunto: 'Seguimiento de Caso | Gplus Seguros | 7000',
  html: '<p>Buen día</p>',
  texto: 'Buen día',
  adjuntos: [],
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

describe('enviarCorreo', () => {
  it('devuelve el id del mensaje y del hilo que asignó Gmail', async () => {
    const fetchMock = respuesta({ id: 'm1', threadId: 't1' })
    const r = await enviarCorreo(DEPS(fetchMock), MENSAJE)
    expect(r).toEqual({ id: 'm1', threadId: 't1' })
  })

  it('el remitente viaja en el mensaje, no en una constante del módulo', async () => {
    // Hay dos buzones desde que existe el módulo de siniestros, y Google rechaza un
    // From que no sea de la cuenta autenticada.
    const fetchMock = respuesta({ id: 'm1', threadId: 't1' })
    await enviarCorreo(DEPS(fetchMock), {
      ...MENSAJE,
      de: 'Atención a Siniestros | Gplus Seguros <jose.mendoza@gplusseguros.mx>',
    })
    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const { raw } = JSON.parse(String((init as RequestInit).body))
    const mime = Buffer.from(String(raw).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    expect(mime).toContain('jose.mendoza@gplusseguros.mx')
    expect(mime).not.toContain('mesadecontrol@')
  })

  it('manda el correo como raw en base64url', async () => {
    const fetchMock = respuesta({ id: 'm1', threadId: 't1' })
    await enviarCorreo(DEPS(fetchMock), MENSAJE)
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toContain('/messages/send')
    expect(init.method).toBe('POST')
    const cuerpo = JSON.parse(init.body as string) as { raw: string }
    expect(cuerpo.raw).toBeDefined()
    expect(cuerpo.raw).not.toMatch(/[+/=]/)
    // El MIME decodificado debe traer el destinatario y el asunto.
    const mime = Buffer.from(cuerpo.raw, 'base64url').toString('utf8')
    expect(mime).toContain('To: comercial28@garantiplus.mx')
    expect(mime).toContain('Seguimiento de Caso')
  })

  it('el remitente es siempre el buzón de la mesa', async () => {
    const fetchMock = respuesta({ id: 'm1', threadId: 't1' })
    await enviarCorreo(DEPS(fetchMock), MENSAJE)
    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const mime = Buffer.from(
      (JSON.parse(init.body as string) as { raw: string }).raw,
      'base64url',
    ).toString('utf8')
    expect(mime).toContain('From: Mesa de Control | Gplus Seguros <mesadecontrol@gplusseguros.mx>')
  })

  it('al responder incluye el threadId y la cabecera In-Reply-To', async () => {
    const fetchMock = respuesta({ id: 'm2', threadId: 't1' })
    await enviarCorreo(DEPS(fetchMock), { ...MENSAJE, enRespuestaA: '<abc@mail.gmail.com>' }, 't1')
    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const cuerpo = JSON.parse(init.body as string) as { raw: string; threadId?: string }
    expect(cuerpo.threadId).toBe('t1')
    const mime = Buffer.from(cuerpo.raw, 'base64url').toString('utf8')
    expect(mime).toContain('In-Reply-To: <abc@mail.gmail.com>')
  })

  it('no manda threadId en el primer correo del caso', async () => {
    const fetchMock = respuesta({ id: 'm1', threadId: 't1' })
    await enviarCorreo(DEPS(fetchMock), MENSAJE)
    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(JSON.parse(init.body as string).threadId).toBeUndefined()
  })

  it('rechaza el envío antes de llamar a Gmail si excede el límite de adjuntos', async () => {
    const fetchMock = respuesta({ id: 'm1', threadId: 't1' })
    const grande = {
      nombre: 'enorme.zip',
      tipo: 'application/zip',
      contenido: new Uint8Array(26 * 1024 * 1024),
    }
    await expect(
      enviarCorreo(DEPS(fetchMock), { ...MENSAJE, adjuntos: [grande] }),
    ).rejects.toBeInstanceOf(CorreoDemasiadoGrandeError)
    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  it('el error de tamaño dice cuánto pesa y cuál es el límite', async () => {
    const fetchMock = respuesta({ id: 'm1', threadId: 't1' })
    const grande = {
      nombre: 'enorme.zip',
      tipo: 'application/zip',
      contenido: new Uint8Array(26 * 1024 * 1024),
    }
    await expect(
      enviarCorreo(DEPS(fetchMock), { ...MENSAJE, adjuntos: [grande] }),
    ).rejects.toThrow(/MB/)
  })

  it('acepta un adjunto que cabe en el límite', async () => {
    const fetchMock = respuesta({ id: 'm1', threadId: 't1' })
    const chico = {
      nombre: 'factura.pdf',
      tipo: 'application/pdf',
      contenido: new Uint8Array(1024),
    }
    await expect(
      enviarCorreo(DEPS(fetchMock), { ...MENSAJE, adjuntos: [chico] }),
    ).resolves.toBeDefined()
  })

  it('traduce el 403 a un mensaje sobre el permiso de envío', async () => {
    const fetchMock = respuesta({ error: { code: 403 } }, 403)
    await expect(enviarCorreo(DEPS(fetchMock), MENSAJE)).rejects.toThrow(/permiso para enviar/)
  })

  it('explica el límite de cuota al enviar', async () => {
    const fetchMock = respuesta({ error: { code: 429 } }, 429)
    await expect(enviarCorreo(DEPS(fetchMock), MENSAJE)).rejects.toThrow(/l[íi]mit/i)
  })

  it('falla con mensaje claro si Gmail responde sin threadId', async () => {
    const fetchMock = respuesta({ id: 'm1' })
    await expect(enviarCorreo(DEPS(fetchMock), MENSAJE)).rejects.toThrow(/sin identificador/)
  })
})
