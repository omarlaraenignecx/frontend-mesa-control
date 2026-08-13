import { describe, expect, it, vi } from 'vitest'
import { NOMBRE_CARPETA, crearCarpeta, cuerpoMultiparte, subirArchivo } from './drive-subida'

function fetchQueResponde(status: number, cuerpo: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(cuerpo), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof globalThis.fetch
}

const decodificar = (u: Uint8Array) => new TextDecoder().decode(u)

describe('cuerpoMultiparte', () => {
  it('arma las dos partes que pide Drive: metadatos JSON y contenido', () => {
    const { cuerpo, contentType } = cuerpoMultiparte(
      { name: 'captura.png', parents: ['carpeta-1'] },
      'image/png',
      new Uint8Array([1, 2, 3]),
    )
    const texto = decodificar(cuerpo)
    const frontera = contentType.match(/boundary=(.+)$/)![1]

    expect(contentType).toContain('multipart/related')
    expect(texto).toContain(`--${frontera}`)
    expect(texto).toContain('Content-Type: application/json')
    expect(texto).toContain('"name":"captura.png"')
    expect(texto).toContain('"parents":["carpeta-1"]')
    expect(texto).toContain('Content-Type: image/png')
    expect(texto.endsWith(`--${frontera}--\r\n`)).toBe(true)
  })

  it('no corrompe el contenido binario', () => {
    // El cuerpo se arma sobre bytes y no sobre cadenas justo por esto: un PDF o
    // un PNG pasados por una cadena salen dañados.
    const bytes = new Uint8Array([0, 255, 13, 10, 128])
    const { cuerpo } = cuerpoMultiparte({ name: 'x' }, 'application/octet-stream', bytes)

    const posicion = cuerpo.findIndex(
      (_, i) =>
        cuerpo[i] === 0 &&
        cuerpo[i + 1] === 255 &&
        cuerpo[i + 2] === 13 &&
        cuerpo[i + 3] === 10 &&
        cuerpo[i + 4] === 128,
    )
    expect(posicion).toBeGreaterThan(0)
  })

  it('la frontera no aparece dentro del contenido', () => {
    // Si la frontera apareciera en los bytes del archivo, Drive cortaría el
    // cuerpo por el lugar equivocado.
    const { cuerpo, contentType } = cuerpoMultiparte({ name: 'x' }, 'text/plain', new Uint8Array())
    const frontera = contentType.match(/boundary=(.+)$/)![1]
    expect(decodificar(cuerpo).split(frontera)).toHaveLength(4) // apertura, medio y cierre
  })
})

describe('subirArchivo', () => {
  it('sube con uploadType=multipart y devuelve el id que dio Drive', async () => {
    const fetchMock = fetchQueResponde(200, { id: 'archivo-9', size: '3' })
    const r = await subirArchivo(
      { fetch: fetchMock, accessToken: 'token' },
      {
        carpetaId: 'carpeta-1',
        nombre: 'captura.png',
        tipo: 'image/png',
        contenido: new Uint8Array([1, 2, 3]),
      },
    )

    expect(r).toEqual({ id: 'archivo-9', bytes: 3 })
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toContain('uploadType=multipart')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token')
  })

  it('cae en un tipo genérico cuando el navegador no informa el del archivo', async () => {
    const fetchMock = fetchQueResponde(200, { id: 'archivo-9' })
    await subirArchivo(
      { fetch: fetchMock, accessToken: 'token' },
      { carpetaId: 'c', nombre: 'sin-extension', tipo: '', contenido: new Uint8Array([1]) },
    )
    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(decodificar(init.body as Uint8Array)).toContain('Content-Type: application/octet-stream')
  })

  it('un 403 se explica en términos del permiso que falta', async () => {
    const fetchMock = fetchQueResponde(403, { error: { code: 403 } })
    await expect(
      subirArchivo(
        { fetch: fetchMock, accessToken: 'token' },
        { carpetaId: 'c', nombre: 'x', tipo: 'text/plain', contenido: new Uint8Array([1]) },
      ),
    ).rejects.toThrow(/autoriz/i)
  })

  it('cualquier otro error de Drive llega con su código', async () => {
    const fetchMock = fetchQueResponde(500, { error: { code: 500 } })
    await expect(
      subirArchivo(
        { fetch: fetchMock, accessToken: 'token' },
        { carpetaId: 'c', nombre: 'x', tipo: 'text/plain', contenido: new Uint8Array([1]) },
      ),
    ).rejects.toThrow(/500/)
  })
})

describe('crearCarpeta', () => {
  it('crea la carpeta con el nombre acordado y el tipo de carpeta', async () => {
    const fetchMock = fetchQueResponde(200, { id: 'carpeta-nueva' })
    expect(await crearCarpeta({ fetch: fetchMock, accessToken: 'token' })).toBe('carpeta-nueva')

    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const cuerpo = JSON.parse(init.body as string) as Record<string, unknown>
    expect(cuerpo.name).toBe(NOMBRE_CARPETA)
    expect(cuerpo.mimeType).toBe('application/vnd.google-apps.folder')
  })
})
