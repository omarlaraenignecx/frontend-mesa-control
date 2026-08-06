import { describe, expect, it, vi } from 'vitest'
import { leerTituloHoja } from './sheet-ping'

function fetchQueResponde(status: number, cuerpo: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(cuerpo), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof globalThis.fetch
}

describe('leerTituloHoja', () => {
  it('devuelve el título del archivo', async () => {
    const fetchMock = fetchQueResponde(200, {
      properties: { title: 'Prueba formulario mesa de control' },
    })
    const titulo = await leerTituloHoja('sheet-123', {
      fetch: fetchMock,
      accessToken: 'ya29.token',
    })
    expect(titulo).toBe('Prueba formulario mesa de control')
  })

  it('pide solo el título y manda el token en el encabezado', async () => {
    const fetchMock = fetchQueResponde(200, { properties: { title: 'X' } })
    await leerTituloHoja('sheet-123', { fetch: fetchMock, accessToken: 'ya29.token' })

    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toContain('/spreadsheets/sheet-123')
    expect(String(url)).toContain('fields=properties.title')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ya29.token')
  })

  it('explica el 403 como falta de permiso sobre la hoja', async () => {
    const fetchMock = fetchQueResponde(403, {
      error: { code: 403, message: 'The caller does not have permission' },
    })
    await expect(
      leerTituloHoja('sheet-123', { fetch: fetchMock, accessToken: 'ya29.token' }),
    ).rejects.toThrow(/no tiene permiso/)
  })

  it('explica el 404 como hoja inexistente', async () => {
    const fetchMock = fetchQueResponde(404, { error: { code: 404, message: 'Not found' } })
    await expect(
      leerTituloHoja('sheet-inexistente', { fetch: fetchMock, accessToken: 'ya29.token' }),
    ).rejects.toThrow(/no existe/)
  })
})
