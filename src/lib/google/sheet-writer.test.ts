import { describe, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/encabezados-307.json'
import { construirMapa } from './sheet-schema'
import {
  CAMPOS_ESCRIBIBLES,
  ColumnaNoEscribibleError,
  FilaCambiadaError,
  SelloNoEscritoError,
  SinColumnaDeOrigenError,
  escribirFolios,
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
  opciones: {
    marcaTemporal?: string
    folio?: string
    statusEscritura?: number
    cuerpoEscritura?: unknown
  } = {},
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
    return new Response(JSON.stringify(opciones.cuerpoEscritura ?? { totalUpdatedCells: 3 }), {
      status: opciones.statusEscritura ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof globalThis.fetch
  return { fetchMock, llamadas }
}

const escrituras = (llamadas: { url: string; init?: RequestInit }[]) =>
  llamadas.filter((l) => l.init?.method && l.init.method !== 'GET')

describe('lista blanca de columnas', () => {
  it('declara las diez columnas de seguimiento acordadas, más el tipo de trámite', () => {
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
        // La única respuesta del formulario que se puede escribir, por decisión del
        // área del 14/9/2026: el solicitante se equivoca al elegir y la mesa no
        // tenía cómo corregirlo. Ver el comentario de CAMPOS_ESCRIBIBLES.
        'tipoTramite',
      ].sort(),
    )
  })

  it('rechaza escribir un campo del formulario antes de llamar a Google', async () => {
    // El ejemplo era `tipoTramite` hasta que dejó de estar prohibido. Sigue siendo
    // la regla para todo lo demás que contestó el solicitante.
    const { fetchMock } = fetchDeEscritura()
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { motivo: 'aplicar el pago' } as never,
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

  /**
   * El mensaje que llega a la pantalla es el único rastro que deja un guardado
   * fallido —la acción devuelve el error, no lo registra—, así que la razón de
   * Google tiene que viajar con él hasta la tarjeta roja. `razonDeGoogle` tiene
   * sus propias pruebas; esta cuida que siga enchufada al camino del guardado.
   */
  it('lleva la explicación de Google hasta el mensaje del guardado', async () => {
    const { fetchMock } = fetchDeEscritura({
      statusEscritura: 400,
      cuerpoEscritura: {
        error: {
          code: 400,
          message: 'Unable to parse range: Respuestas de formulario 1!N0',
          status: 'INVALID_ARGUMENT',
        },
      },
    })
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { estatusFinal: 'Concluida' },
        TESTIGO,
      ),
    ).rejects.toThrow(
      'Sheets respondió 400 al guardar los cambios. Google explicó: «Unable to parse range: Respuestas de formulario 1!N0»',
    )
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

/**
 * La corrección del tipo de trámite es el único caso en que se escribe una
 * respuesta del formulario, y es el único campo que no vive en una sola columna:
 * agrupa 17 columnas equivalentes y cada fila llenó una. Escribir en la
 * equivocada dejaría el dato donde nadie lo lee, así que estas pruebas son las
 * que sostienen la función.
 */
describe('corrección del tipo de trámite', () => {
  /** Responde celda por celda, para poder decir qué bloque del formulario trae valor. */
  function fetchDeFila(celdas: Record<string, string>) {
    const llamadas: { url: string; init?: RequestInit }[] = []
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      llamadas.push({ url: String(url), init })
      const esLectura = !init?.method || init.method === 'GET'
      if (esLectura) {
        const rangos = new URL(String(url)).searchParams.getAll('ranges')
        return new Response(
          JSON.stringify({
            valueRanges: rangos.map((r) => {
              const celda = r.split('!')[1]
              const valor = celdas[celda]
              return valor === undefined ? {} : { values: [[valor]] }
            }),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ totalUpdatedCells: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch
    return { fetchMock, llamadas }
  }

  /** La fila tal como la lee el escritor: testigo al día y el trámite donde se diga. */
  const fila = (bloques: Record<string, string>) => ({
    A7176: TESTIGO.marcaTemporalTexto,
    JY7176: '7000',
    ...bloques,
  })

  const rangosEscritos = (llamadas: { url: string; init?: RequestInit }[]) =>
    escrituras(llamadas).flatMap(
      (l) => (JSON.parse(String(l.init?.body)) as { data: { range: string }[] }).data,
    )

  it('escribe en la columna del bloque que trae el valor, no en la primera del grupo', async () => {
    const { fetchMock, llamadas } = fetchDeFila(fila({ CY7176: 'Emisión' }))
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { tipoTramite: 'Endoso' },
      TESTIGO,
    )

    const rangos = rangosEscritos(llamadas).map((d) => d.range)
    expect(rangos).toEqual(['Respuestas de formulario 1!CY7176'])
    expect(rangos.some((r) => r.includes('N7176'))).toBe(false)
  })

  it('con dos bloques llenos escribe en el primero, igual que la regla de lectura', async () => {
    // `valorDe()` en el lector se queda con el primer valor no vacío. Si el
    // escritor eligiera otro, la aplicación escribiría en una celda y leería otra.
    const { fetchMock, llamadas } = fetchDeFila(fila({ N7176: 'Emisión', CY7176: 'Cotización' }))
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { tipoTramite: 'Endoso' },
      TESTIGO,
    )

    expect(rangosEscritos(llamadas).map((d) => d.range)).toEqual([
      'Respuestas de formulario 1!N7176',
    ])
  })

  it('resuelve el bloque en la misma lectura del testigo, sin una llamada extra', async () => {
    const { fetchMock, llamadas } = fetchDeFila(fila({ HQ7176: 'Emisión' }))
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { tipoTramite: 'Endoso', estatusFinal: 'Concluida' },
      TESTIGO,
    )

    const lecturas = llamadas.filter((l) => !l.init?.method || l.init.method === 'GET')
    expect(lecturas).toHaveLength(1)
    // Marca temporal, folio y las 17 columnas equivalentes del trámite.
    expect(new URL(lecturas[0].url).searchParams.getAll('ranges')).toHaveLength(19)
  })

  it('un guardado que no toca el trámite sigue pidiendo dos rangos', async () => {
    const { fetchMock, llamadas } = fetchDeFila(fila({}))
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { estatusFinal: 'Concluida' },
      TESTIGO,
    )

    const lecturas = llamadas.filter((l) => !l.init?.method || l.init.method === 'GET')
    expect(new URL(lecturas[0].url).searchParams.getAll('ranges')).toHaveLength(2)
  })

  it('no escribe nada si la fila no trae el trámite en ninguna de sus columnas', async () => {
    const { fetchMock, llamadas } = fetchDeFila(fila({}))
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { tipoTramite: 'Endoso' },
        TESTIGO,
      ),
    ).rejects.toBeInstanceOf(SinColumnaDeOrigenError)
    expect(escrituras(llamadas)).toHaveLength(0)
  })

  it('rechaza vaciar el trámite antes de tocar la hoja', async () => {
    const { fetchMock } = fetchDeFila(fila({ N7176: 'Emisión' }))
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { tipoTramite: '   ' },
        TESTIGO,
      ),
    ).rejects.toThrow(/no se puede dejar vacío/)
    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  it('el testigo sigue mandando aunque venga una corrección de trámite', async () => {
    const { fetchMock, llamadas } = fetchDeFila({
      ...fila({ N7176: 'Emisión' }),
      A7176: '6/8/2026 09:00:00',
    })
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { tipoTramite: 'Endoso' },
        TESTIGO,
      ),
    ).rejects.toBeInstanceOf(FilaCambiadaError)
    expect(escrituras(llamadas)).toHaveLength(0)
  })

  it('escribe el trámite en RAW, con el resto del texto', async () => {
    const { fetchMock, llamadas } = fetchDeFila(fila({ N7176: 'Emisión' }))
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { tipoTramite: 'Endoso', fechaAtencionFinal: '12/9/2026 11:09:59' },
      TESTIGO,
    )

    const conTramite = escrituras(llamadas).find((l) => String(l.init?.body).includes('Endoso'))
    expect(conTramite?.url).toContain('valueInputOption=RAW')
  })
})

describe('escribirFolios', () => {
  /**
   * A diferencia de `fetchDeEscritura`, este responde el batchGet a partir de los
   * rangos que se le piden: el lote pregunta por dos celdas de cada fila y el
   * número varía con el tamaño del lote.
   */
  function fetchDeLote(celdas: Record<string, string>) {
    const llamadas: { url: string; init?: RequestInit }[] = []
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      llamadas.push({ url: String(url), init })
      const esLectura = !init?.method || init.method === 'GET'
      if (esLectura) {
        const rangos = new URL(String(url)).searchParams.getAll('ranges')
        return new Response(
          JSON.stringify({
            valueRanges: rangos.map((r) => {
              const celda = r.split('!')[1]
              const valor = celdas[celda]
              return valor ? { values: [[valor]] } : {}
            }),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ totalUpdatedCells: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch
    return { fetchMock, llamadas }
  }

  const DOS_FILAS = [
    { fila: 7228, folio: '7055' },
    { fila: 7229, folio: '7056' },
  ]
  const DOS_TESTIGOS = new Map([
    [7228, '12/8/2026 13:50:48'],
    [7229, '12/8/2026 13:53:27'],
  ])

  it('escribe todos los folios en un solo lote', async () => {
    const { fetchMock, llamadas } = fetchDeLote({
      A7228: '12/8/2026 13:50:48',
      A7229: '12/8/2026 13:53:27',
    })
    await escribirFolios({ ...DEPS_BASE, fetch: fetchMock }, MAPA, DOS_FILAS, DOS_TESTIGOS)

    const hechas = escrituras(llamadas)
    expect(hechas).toHaveLength(1)
    const cuerpo = JSON.parse(hechas[0].init!.body as string) as {
      data: { range: string; values: string[][] }[]
    }
    expect(cuerpo.data).toHaveLength(2)
    expect(cuerpo.data[0].range).toContain('JY7228')
    expect(cuerpo.data[0].values[0][0]).toBe('7055')
    expect(cuerpo.data[1].range).toContain('JY7229')
  })

  it('escribe el folio como número y no como texto', async () => {
    // La columna es numérica en toda la hoja; con RAW quedaría alineado a la
    // izquierda y fuera del orden de la propia hoja.
    const { fetchMock, llamadas } = fetchDeLote({ A7228: '12/8/2026 13:50:48' })
    await escribirFolios(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      [DOS_FILAS[0]],
      DOS_TESTIGOS,
    )
    expect(escrituras(llamadas)[0].url).toContain('valueInputOption=USER_ENTERED')
  })

  it('revalida las dos celdas de cada fila en una sola lectura', async () => {
    const { fetchMock, llamadas } = fetchDeLote({
      A7228: '12/8/2026 13:50:48',
      A7229: '12/8/2026 13:53:27',
    })
    await escribirFolios({ ...DEPS_BASE, fetch: fetchMock }, MAPA, DOS_FILAS, DOS_TESTIGOS)

    const lecturas = llamadas.filter((l) => !l.init?.method || l.init.method === 'GET')
    expect(lecturas).toHaveLength(1)
    expect(new URL(lecturas[0].url).searchParams.getAll('ranges')).toHaveLength(4)
  })

  it('no escribe nada si una de las filas ya tiene folio', async () => {
    const { fetchMock, llamadas } = fetchDeLote({
      A7228: '12/8/2026 13:50:48',
      A7229: '12/8/2026 13:53:27',
      JY7229: '9999',
    })
    await expect(
      escribirFolios({ ...DEPS_BASE, fetch: fetchMock }, MAPA, DOS_FILAS, DOS_TESTIGOS),
    ).rejects.toThrow(FilaCambiadaError)
    // Ni la primera fila, que sí estaba libre: un lote a medias dejaría un hueco
    // en la serie y nadie sabría por dónde se quedó.
    expect(escrituras(llamadas)).toHaveLength(0)
  })

  it('no escribe nada si una marca temporal cambió', async () => {
    const { fetchMock, llamadas } = fetchDeLote({
      A7228: '12/8/2026 13:50:48',
      A7229: 'otra fecha',
    })
    await expect(
      escribirFolios({ ...DEPS_BASE, fetch: fetchMock }, MAPA, DOS_FILAS, DOS_TESTIGOS),
    ).rejects.toThrow(FilaCambiadaError)
    expect(escrituras(llamadas)).toHaveLength(0)
  })

  it('rechaza folios que no sean dígitos antes de tocar la hoja', async () => {
    // Con USER_ENTERED, un valor que empiece con "=" se guardaría como fórmula.
    const { fetchMock, llamadas } = fetchDeLote({})
    await expect(
      escribirFolios(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        [{ fila: 7228, folio: '=SUMA(A1)' }],
        DOS_TESTIGOS,
      ),
    ).rejects.toThrow(/dígitos/)
    expect(llamadas).toHaveLength(0)
  })

  it('rechaza un lote con folios repetidos entre sí', async () => {
    const { fetchMock, llamadas } = fetchDeLote({})
    await expect(
      escribirFolios(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        [
          { fila: 7228, folio: '7055' },
          { fila: 7229, folio: '7055' },
        ],
        DOS_TESTIGOS,
      ),
    ).rejects.toThrow(/repetido/)
    expect(llamadas).toHaveLength(0)
  })

  it('sin asignaciones no habla con Google', async () => {
    const { fetchMock, llamadas } = fetchDeLote({})
    await escribirFolios({ ...DEPS_BASE, fetch: fetchMock }, MAPA, [], new Map())
    expect(llamadas).toHaveLength(0)
  })
})
