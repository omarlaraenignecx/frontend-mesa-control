import { describe, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/encabezados-307.json'
import { construirMapa } from './sheet-schema'
import {
  CAMPOS_ESCRIBIBLES,
  ColumnaNoEscribibleError,
  FilaCambiadaError,
  SelloNoEscritoError,
  escribirFolio,
  escribirSeguimiento,
} from './sheet-writer'

const ENCABEZADOS = fixture.encabezados as string[]
const MAPA = construirMapa(ENCABEZADOS)
const TESTIGO = { marcaTemporalTexto: '5/8/2026 15:14:58', folio: '7000' }
const DEPS_BASE = {
  accessToken: 'ya29.token',
  sheetId: 'sheet-dev',
  pestana: 'Respuestas de formulario 1',
}

/** El escritor primero relee la fila (testigo) y solo entonces escribe. */
function fetchDeEscritura(
  opciones: { marcaTemporal?: string; folio?: string; statusEscritura?: number } = {},
) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    llamadas.push({ url: String(url), init })
    const esLectura = !init?.method || init.method === 'GET'
    if (esLectura) {
      // batchGet: un valueRange por celda pedida (marca temporal y folio).
      return new Response(
        JSON.stringify({
          valueRanges: [
            { values: [[opciones.marcaTemporal ?? TESTIGO.marcaTemporalTexto]] },
            { values: [[opciones.folio ?? '7000']] },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    return new Response(JSON.stringify({ totalUpdatedCells: 3 }), {
      status: opciones.statusEscritura ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof globalThis.fetch
  return { fetchMock, llamadas }
}

const escrituras = (llamadas: { url: string; init?: RequestInit }[]) =>
  llamadas.filter((l) => l.init?.method && l.init.method !== 'GET')

describe('lista blanca de columnas', () => {
  it('declara exactamente las diez columnas de seguimiento acordadas', () => {
    expect([...CAMPOS_ESCRIBIBLES].sort()).toEqual(
      [
        'aseguradoraSeguimiento',
        'causaSeguimiento',
        'estatusFinal',
        'estatusInicial',
        'fechaAtencionFinal',
        'fechaRespuestaCorreo',
        'folioInterno',
        'observaciones',
        'quienAtendio',
        'teniaPermisos',
      ].sort(),
    )
  })

  it('rechaza escribir un campo del formulario antes de llamar a Google', async () => {
    const { fetchMock } = fetchDeEscritura()
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { tipoTramite: 'Emisión' } as never,
        TESTIGO,
      ),
    ).rejects.toBeInstanceOf(ColumnaNoEscribibleError)
    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  it('rechaza escribir el folio por la vía del seguimiento', async () => {
    const { fetchMock } = fetchDeEscritura()
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { folio: '9999' } as never,
        TESTIGO,
      ),
    ).rejects.toBeInstanceOf(ColumnaNoEscribibleError)
  })

  it('rechaza cualquier campo inventado', async () => {
    const { fetchMock } = fetchDeEscritura()
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { sla: 'x' } as never,
        TESTIGO,
      ),
    ).rejects.toBeInstanceOf(ColumnaNoEscribibleError)
  })

  it('nunca compone un rango que toque una columna de fórmula o residual', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      {
        estatusInicial: 'Atendida / Concluida',
        estatusFinal: 'Concluida',
        fechaRespuestaCorreo: '10/8/2026 12:00:00',
        fechaAtencionFinal: '10/8/2026 12:00:00',
        quienAtendio: 'Keynor',
        folioInterno: '123',
        aseguradoraSeguimiento: 'CHUBB',
        teniaPermisos: 'No',
        causaSeguimiento: 'Función de GPLUS',
        observaciones: 'nota',
      },
      TESTIGO,
    )
    const prohibidas = ['KC', 'KL', 'KM', 'KN', 'KO', 'KP', 'KQ', 'KR', 'KS', 'KT', 'KU']
    for (const { url, init } of llamadas) {
      const cuerpo = typeof init?.body === 'string' ? init.body : ''
      for (const col of prohibidas) {
        expect(decodeURIComponent(url)).not.toContain(`!${col}`)
        expect(cuerpo).not.toContain(`!${col}`)
      }
    }
  })
})

describe('revalidación de la fila', () => {
  it('escribe cuando la fila sigue siendo el mismo caso', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { estatusFinal: 'Concluida' },
      TESTIGO,
    )
    expect(escrituras(llamadas)).toHaveLength(1)
  })

  it('aborta sin escribir si la marca temporal de la fila cambió', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura({ marcaTemporal: '9/8/2026 10:00:00' })
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { estatusFinal: 'Concluida' },
        TESTIGO,
      ),
    ).rejects.toBeInstanceOf(FilaCambiadaError)
    expect(escrituras(llamadas)).toHaveLength(0)
  })

  it('aborta si el folio de la fila cambió, aunque la fecha coincida', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura({ folio: '8888' })
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { estatusFinal: 'Concluida' },
        TESTIGO,
      ),
    ).rejects.toBeInstanceOf(FilaCambiadaError)
    expect(escrituras(llamadas)).toHaveLength(0)
  })

  it('el error de fila cambiada dice qué campo no coincidió y con qué valores', async () => {
    const { fetchMock } = fetchDeEscritura({ marcaTemporal: '9/8/2026 10:00:00' })
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { estatusFinal: 'Concluida' },
        TESTIGO,
      ),
    ).rejects.toMatchObject({
      detalle: {
        campo: 'marca temporal',
        esperado: '5/8/2026 15:14:58',
        encontrado: '9/8/2026 10:00:00',
      },
    })
  })

  it('acepta un caso sin folio: el testigo compara nulo contra celda vacía', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura({ folio: '' })
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { estatusInicial: 'Atendida/en trámite' },
      { marcaTemporalTexto: '5/8/2026 15:14:58', folio: null },
    )
    expect(escrituras(llamadas)).toHaveLength(1)
  })
})

describe('forma de la escritura', () => {
  it('escribe todas las celdas en una sola petición, para no dejar la fila a medias', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      {
        estatusInicial: 'Atendida / Concluida',
        estatusFinal: 'Concluida',
        quienAtendio: 'Keynor',
        observaciones: 'nota',
      },
      TESTIGO,
    )
    expect(escrituras(llamadas)).toHaveLength(1)
    const cuerpo = JSON.parse(escrituras(llamadas)[0].init!.body as string) as {
      data: { range: string }[]
    }
    expect(cuerpo.data).toHaveLength(4)
  })

  it('escribe las fechas con USER_ENTERED para que la hoja las guarde como fecha', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { fechaRespuestaCorreo: '11/8/2026 16:07:11' },
      TESTIGO,
    )
    const hechas = escrituras(llamadas)
    expect(hechas).toHaveLength(1)
    expect(hechas[0].url).toContain('valueInputOption=USER_ENTERED')
  })

  it('separa el texto de las fechas en dos peticiones, y el texto va primero', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      {
        estatusFinal: 'Concluida',
        observaciones: 'nota',
        fechaAtencionFinal: '11/8/2026 16:07:11',
      },
      TESTIGO,
    )
    const hechas = escrituras(llamadas)
    expect(hechas).toHaveLength(2)
    expect(hechas[0].url).toContain('valueInputOption=RAW')
    expect(hechas[1].url).toContain('valueInputOption=USER_ENTERED')

    const primera = JSON.parse(hechas[0].init!.body as string) as { data: { range: string }[] }
    const segunda = JSON.parse(hechas[1].init!.body as string) as { data: { range: string }[] }
    expect(primera.data).toHaveLength(2)
    expect(segunda.data).toHaveLength(1)
    expect(segunda.data[0].range).toContain('KD') // fecha de atención final
  })

  it('si falla el sello, avisa cuál quedó pendiente y no niega lo ya guardado', async () => {
    // El texto se escribe en la primera llamada; la segunda, la del sello, falla.
    const { fetchMock, llamadas } = fetchDeEscritura()
    let escrituraNumero = 0
    const fetchQueFallaElSello: typeof globalThis.fetch = async (url, init) => {
      const esEscritura = String(url).includes('values:batchUpdate')
      if (esEscritura && ++escrituraNumero === 2) {
        return new Response('{}', { status: 500 })
      }
      return fetchMock(url, init)
    }

    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchQueFallaElSello },
        MAPA,
        7176,
        { estatusFinal: 'Concluida', fechaAtencionFinal: '11/8/2026 16:07:11' },
        TESTIGO,
      ),
    ).rejects.toThrow(SelloNoEscritoError)

    expect(escrituras(llamadas)).toHaveLength(1) // el estatus sí quedó escrito
  })

  it('usa RAW para que Sheets no reinterprete el texto que captura la mesa', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { folioInterno: '0426014703' },
      TESTIGO,
    )
    expect(escrituras(llamadas)[0].url).toContain('valueInputOption=RAW')
  })

  it('apunta a la fila indicada y a la columna que dice el mapa, no a letras fijas', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { observaciones: 'nota' },
      TESTIGO,
    )
    const cuerpo = JSON.parse(escrituras(llamadas)[0].init!.body as string) as {
      data: { range: string }[]
    }
    expect(cuerpo.data[0].range).toContain('7176')
    expect(cuerpo.data[0].range).toContain('KJ') // observaciones en el esquema actual
  })

  it('no escribe nada cuando no hay valores que cambiar', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176, {}, TESTIGO)
    expect(escrituras(llamadas)).toHaveLength(0)
    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  it('traduce el 403 de escritura a un mensaje sobre permisos de edición', async () => {
    const { fetchMock } = fetchDeEscritura({ statusEscritura: 403 })
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { estatusFinal: 'Concluida' },
        TESTIGO,
      ),
    ).rejects.toThrow(/permiso de edición/)
  })

  it('explica el límite de cuota al guardar', async () => {
    const { fetchMock } = fetchDeEscritura({ statusEscritura: 429 })
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { estatusFinal: 'Concluida' },
        TESTIGO,
      ),
    ).rejects.toThrow(/peticiones/)
  })
})

describe('escribirFolio', () => {
  it('es la única vía que puede tocar la columna del folio', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura({ folio: '' })
    await escribirFolio({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7180, '7010', {
      marcaTemporalTexto: '5/8/2026 15:14:58',
      folio: null,
    })
    const cuerpo = JSON.parse(escrituras(llamadas)[0].init!.body as string) as {
      data: { range: string; values: string[][] }[]
    }
    expect(cuerpo.data[0].range).toContain('JY')
    expect(cuerpo.data[0].values[0][0]).toBe('7010')
  })

  it('se niega a sobrescribir un folio que ya existe', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura({ folio: '7000' })
    await expect(
      escribirFolio({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176, '9999', TESTIGO),
    ).rejects.toThrow(/ya tiene folio/)
    expect(escrituras(llamadas)).toHaveLength(0)
  })

  it('rechaza un folio vacío', async () => {
    const { fetchMock } = fetchDeEscritura({ folio: '' })
    await expect(
      escribirFolio({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7180, '   ', {
        marcaTemporalTexto: '5/8/2026 15:14:58',
        folio: null,
      }),
    ).rejects.toThrow(/no puede quedar vacío/)
  })
})
