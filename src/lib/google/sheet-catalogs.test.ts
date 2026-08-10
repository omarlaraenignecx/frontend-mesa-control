import { describe, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/encabezados-307.json'
import { leerCatalogos } from './sheet-catalogs'
import { construirMapa } from './sheet-schema'

const MAPA = construirMapa(fixture.encabezados as string[])

/** Respuesta de spreadsheets.get con includeGridData, tal como la devuelve Sheets. */
function respuestaConValidaciones(porColumna: Record<number, string[]>) {
  const primeraColumna = 286 // JZ, primera columna con catálogo
  const values = Array.from({ length: 11 }, (_, i) => {
    const columna = primeraColumna + i
    const lista = porColumna[columna]
    return lista
      ? {
          dataValidation: {
            condition: {
              type: 'ONE_OF_LIST',
              values: lista.map((v) => ({ userEnteredValue: v })),
            },
          },
        }
      : {}
  })
  return { sheets: [{ data: [{ rowData: [{ values }] }] }] }
}

function fetchQueResponde(cuerpo: unknown, status = 200) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(cuerpo), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof globalThis.fetch
}

const DEPS_BASE = {
  accessToken: 'ya29.token',
  sheetId: 'sheet-dev',
  pestana: 'Respuestas de formulario 1',
}

describe('leerCatalogos', () => {
  it('devuelve los valores permitidos de cada columna de seguimiento', async () => {
    const fetchMock = fetchQueResponde(
      respuestaConValidaciones({
        286: ['Atendida / Concluida', 'Atendida/en trámite'], // JZ
        287: ['Concluida', 'Improcedente', 'Tramite'], // KA
        291: ['José Juan', 'Norma', 'Paty', 'Keynor'], // KE
      }),
    )
    const catalogos = await leerCatalogos({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176)

    expect(catalogos.estatusInicial).toEqual(['Atendida / Concluida', 'Atendida/en trámite'])
    expect(catalogos.estatusFinal).toEqual(['Concluida', 'Improcedente', 'Tramite'])
    expect(catalogos.quienAtendio).toEqual(['José Juan', 'Norma', 'Paty', 'Keynor'])
  })

  it('omite el campo cuando la celda no tiene validación, en lugar de inventar valores', async () => {
    const fetchMock = fetchQueResponde(respuestaConValidaciones({ 286: ['Uno'] }))
    const catalogos = await leerCatalogos({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176)
    expect(catalogos.estatusInicial).toEqual(['Uno'])
    expect(catalogos.aseguradoraSeguimiento).toBeUndefined()
  })

  it('conserva los valores tal cual, con sus espacios e inconsistencias', async () => {
    // 'GPLUS ' viene con espacio final en la hoja; escribir 'GPLUS' rompería el
    // reporteo de Keynor, así que el valor no se normaliza.
    const fetchMock = fetchQueResponde(respuestaConValidaciones({ 293: ['GPLUS ', 'CHUBB'] }))
    const catalogos = await leerCatalogos({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176)
    expect(catalogos.aseguradoraSeguimiento).toEqual(['GPLUS ', 'CHUBB'])
  })

  it('pide solo la fila de ejemplo y solo el campo de validación', async () => {
    const fetchMock = fetchQueResponde(respuestaConValidaciones({}))
    await leerCatalogos({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176)
    const [url] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const decodificada = decodeURIComponent(String(url))
    expect(decodificada).toContain('includeGridData=true')
    expect(decodificada).toContain('dataValidation')
    expect(decodificada).toContain('7176')
  })

  it('devuelve catálogos vacíos sin lanzar si la hoja no trae rowData', async () => {
    const fetchMock = fetchQueResponde({ sheets: [{ data: [{}] }] })
    const catalogos = await leerCatalogos({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176)
    expect(catalogos).toEqual({})
  })

  it('explica el 403 igual que el lector', async () => {
    const fetchMock = fetchQueResponde({ error: { code: 403 } }, 403)
    await expect(leerCatalogos({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176)).rejects.toThrow(
      /permiso/,
    )
  })

  it('ignora una validación que no sea lista de valores', async () => {
    const fetchMock = fetchQueResponde({
      sheets: [
        {
          data: [
            {
              rowData: [
                {
                  values: [
                    { dataValidation: { condition: { type: 'NUMBER_GREATER', values: [] } } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    const catalogos = await leerCatalogos({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176)
    expect(catalogos.estatusInicial).toBeUndefined()
  })
})
