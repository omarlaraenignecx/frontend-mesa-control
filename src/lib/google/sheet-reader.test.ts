import { describe, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/encabezados-307.json'
import { construirCasos, leerCasos } from './sheet-reader'
import { construirMapa } from './sheet-schema'

const ENCABEZADOS: string[] = fixture.encabezados
const MAPA = construirMapa(ENCABEZADOS)

/** Construye una fila de 307 celdas con valores en columnas concretas (1-based). */
function fila(valores: Record<number, string>): string[] {
  const f = new Array(307).fill('')
  for (const [col, v] of Object.entries(valores)) f[Number(col) - 1] = v
  return f
}

// Reproduce la fila 7176 real (folio 7000).
const FILA_7176 = fila({
  1: '5/8/2026 15:14:58',
  14: 'Emisión',
  17: 'https://drive.google.com/open?id=11eqHaUTW-S99z7eWxBY5gasO',
  28: 'Ricardo Hernandez',
  30: 'comercial28@garantiplus.mx',
  36: 'CHEVROLET CAMPESTRE solicita aplicar el pago a la poliza',
  55: 'CHEVROLET CAMPESTRE',
  56: 'EXTERNA',
  273: 'comercial28@garantiplus.mx',
  285: '7000',
  286: 'Atendida/en trámite',
  287: 'Tramite',
  291: 'Keynor',
  293: 'LA LATINO',
  294: 'No',
  295: 'Función de GPLUS',
  296: 'SE ENVIAN DATOS DE APLICACION DE PAGO Y FACTURA A PATY.',
})

describe('construirCasos', () => {
  it('arma el caso con los campos resueltos y la fila como identidad', () => {
    const [caso] = construirCasos([FILA_7176], MAPA, ENCABEZADOS, 2026)
    expect(caso.fila).toBe(2) // primera fila de datos
    expect(caso.folio).toBe('7000')
    expect(caso.tipoTramite).toBe('Emisión')
    expect(caso.nombreSolicitante).toBe('Ricardo Hernandez')
    expect(caso.correoSolicitante).toBe('comercial28@garantiplus.mx')
    expect(caso.estatusFinal).toBe('Tramite')
    expect(caso.quienAtendio).toBe('Keynor')
    expect(caso.aseguradoraSeguimiento).toBe('LA LATINO')
    expect(caso.marcaTemporalIso).toContain('2026-08-05')
  })

  it('prefiere la agencia externa cuando el solicitante la declaró', () => {
    const [caso] = construirCasos([FILA_7176], MAPA, ENCABEZADOS, 2026)
    expect(caso.agencia).toBe('CHEVROLET CAMPESTRE')
  })

  it('resuelve el adjunto de la columna del trámite como enlace navegable', () => {
    const [caso] = construirCasos([FILA_7176], MAPA, ENCABEZADOS, 2026)
    expect(caso.adjuntos).toHaveLength(1)
    expect(caso.adjuntos[0].fileId).toBe('11eqHaUTW-S99z7eWxBY5gasO')
    expect(caso.adjuntos[0].etiqueta.length).toBeGreaterThan(0)
  })

  it('toma el primer valor no vacío cuando el campo vive en varias columnas', () => {
    // Tipo de trámite vacío en N (14) pero presente en CJ (88), que es "Trámite:"
    const f = fila({ 1: '5/8/2026 17:33:44', 88: 'Cotización', 285: '7002' })
    const [caso] = construirCasos([f], MAPA, ENCABEZADOS, 2026)
    expect(caso.tipoTramite).toBe('Cotización')
  })

  it('descarta las filas sin marca temporal, que son los folios pre-arrastrados', () => {
    const arrastrada = fila({ 285: '6404' })
    const casos = construirCasos([FILA_7176, arrastrada], MAPA, ENCABEZADOS, 2026)
    expect(casos).toHaveLength(1)
    expect(casos[0].folio).toBe('7000')
  })

  it('descarta las peticiones anteriores al año mínimo', () => {
    const vieja = fila({ 1: '20/2/2023 14:25:38', 285: '100' })
    const casos = construirCasos([vieja, FILA_7176], MAPA, ENCABEZADOS, 2026)
    expect(casos.map((c) => c.folio)).toEqual(['7000'])
  })

  it('acepta el caso sin folio y lo conserva en la lista', () => {
    const f = fila({ 1: '5/8/2026 17:33:44', 28: 'JACQUELINE HURTADO' })
    const [caso] = construirCasos([f], MAPA, ENCABEZADOS, 2026)
    expect(caso.folio).toBeNull()
    expect(caso.nombreSolicitante).toBe('JACQUELINE HURTADO')
  })

  it('nunca lee las columnas de fórmula ni los duplicados residuales', () => {
    const f = fila({
      1: '5/8/2026 15:00:00',
      285: '7003',
      289: '#REF!', // KC, fórmula
      298: 'valor residual', // KL, duplicado de estatus inicial
      305: '#REF!', // KS, fórmula
    })
    const [caso] = construirCasos([f], MAPA, ENCABEZADOS, 2026)
    const serializado = JSON.stringify(caso)
    expect(serializado).not.toContain('#REF!')
    expect(serializado).not.toContain('valor residual')
  })

  it('recoge en camposExtra los datos que el mapeador no clasificó, para no perderlos', () => {
    const columnaSinResolver = MAPA.indicesSinResolver[0]
    const f = fila({ 1: '5/8/2026 15:00:00', 285: '7004', [columnaSinResolver]: 'dato relevante' })
    const [caso] = construirCasos([f], MAPA, ENCABEZADOS, 2026)
    expect(caso.camposExtra.some((c) => c.valor === 'dato relevante')).toBe(true)
  })

  it('tolera filas más cortas que el total de columnas, como las devuelve Sheets', () => {
    const corta = ['5/8/2026 15:00:00', '', '', 'Emisión']
    expect(() => construirCasos([corta], MAPA, ENCABEZADOS, 2026)).not.toThrow()
  })
})

describe('leerCasos', () => {
  function fetchSecuencia(respuestas: unknown[]) {
    let i = 0
    return vi.fn(async () => {
      const cuerpo = respuestas[Math.min(i++, respuestas.length - 1)]
      return new Response(JSON.stringify(cuerpo), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch
  }

  const DEPS_BASE = {
    accessToken: 'ya29.token',
    sheetId: 'sheet-dev',
    pestana: 'Respuestas de formulario 1',
  }

  it('lee encabezados y datos con dos peticiones, no una por caso', async () => {
    const fetchMock = fetchSecuencia([{ values: [ENCABEZADOS] }, { values: [FILA_7176] }])
    const { casos } = await leerCasos({ ...DEPS_BASE, fetch: fetchMock })
    expect(casos).toHaveLength(1)
    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2)
  })

  it('codifica el nombre de la pestaña, que trae espacios', async () => {
    const fetchMock = fetchSecuencia([{ values: [ENCABEZADOS] }, { values: [] }])
    await leerCasos({ ...DEPS_BASE, fetch: fetchMock })
    const [url] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toContain('Respuestas%20de%20formulario%201')
  })

  it('propaga el error de permiso con lenguaje claro', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: { code: 403 } }), { status: 403 }),
    ) as unknown as typeof globalThis.fetch
    await expect(leerCasos({ ...DEPS_BASE, fetch: fetchMock })).rejects.toThrow(/permiso/)
  })

  it('explica el límite de cuota en lenguaje entendible', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: { code: 429 } }), { status: 429 }),
    ) as unknown as typeof globalThis.fetch
    await expect(leerCasos({ ...DEPS_BASE, fetch: fetchMock })).rejects.toThrow(/peticiones/)
  })

  it('devuelve lista vacía sin fallar cuando la hoja no tiene datos', async () => {
    const fetchMock = fetchSecuencia([{ values: [ENCABEZADOS] }, {}])
    const { casos } = await leerCasos({ ...DEPS_BASE, fetch: fetchMock })
    expect(casos).toEqual([])
  })
})
