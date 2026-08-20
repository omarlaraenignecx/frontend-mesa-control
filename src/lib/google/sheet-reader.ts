import { parsearFechaHoja, type Caso } from '@/lib/casos/caso'
import { extraerAdjuntos, type Adjunto } from './drive-links'
import {
  construirMapa,
  letraColumna,
  rangoDeLectura,
  type CampoLogico,
  type MapaEsquema,
} from './sheet-schema'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

export type DepsLectura = {
  fetch: typeof globalThis.fetch
  accessToken: string
  sheetId: string
  pestana: string
}

async function pedirValores(deps: DepsLectura, rango: string): Promise<string[][]> {
  const url = `${BASE}/${deps.sheetId}/values/${encodeURIComponent(
    `${deps.pestana}!${rango}`,
  )}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`

  const respuesta = await deps.fetch(url, {
    headers: { Authorization: `Bearer ${deps.accessToken}` },
  })

  if (respuesta.status === 403) {
    throw new Error('La cuenta de la mesa no tiene permiso para leer esta hoja de cálculo.')
  }
  if (respuesta.status === 404) {
    throw new Error('La hoja de cálculo o la pestaña indicada no existe.')
  }
  if (respuesta.status === 429) {
    throw new Error(
      'Google limitó las consultas por exceso de peticiones. Intenta de nuevo en un momento.',
    )
  }
  if (!respuesta.ok) {
    throw new Error(`Sheets respondió ${respuesta.status} al leer los casos.`)
  }

  const cuerpo = (await respuesta.json()) as { values?: string[][] }
  return cuerpo.values ?? []
}

export async function leerEncabezados(deps: DepsLectura): Promise<string[]> {
  const [encabezados] = await pedirValores(deps, '1:1')
  if (!encabezados?.length) throw new Error('La hoja no tiene encabezados en la primera fila.')
  return encabezados
}

export async function leerFilas(deps: DepsLectura, rango: string): Promise<string[][]> {
  return pedirValores(deps, rango)
}

/**
 * Todos los valores de la columna del folio, desde la fila 2.
 *
 * Se lee la columna entera y no los casos porque las filas que la mesa
 * pre-arrastró traen folio sin traer petición —`construirCasos` las descarta por
 * no tener marca temporal— y son justo las que fijan el máximo de la serie.
 */
export async function leerColumnaFolios(
  deps: DepsLectura,
  mapa: MapaEsquema,
): Promise<string[]> {
  const columna = mapa.columnasPorCampo.folio[0]
  if (!columna) return []
  const letra = letraColumna(columna)
  const filas = await pedirValores(deps, `${letra}2:${letra}`)
  return filas.map((f) => f[0] ?? '')
}

/** Primer valor no vacío recorriendo el grupo de columnas equivalentes del campo. */
function valorDe(fila: string[], columnas: number[]): string | null {
  for (const c of columnas) {
    const v = fila[c - 1]
    if (v && v.trim()) return v.trim()
  }
  return null
}

export function construirCasos(
  filas: string[][],
  mapa: MapaEsquema,
  encabezados: string[],
  anioMinimo: number,
): Caso[] {
  const campo = (fila: string[], c: CampoLogico) => valorDe(fila, mapa.columnasPorCampo[c])
  const casos: Caso[] = []

  filas.forEach((fila, i) => {
    const marcaTemporalTexto = campo(fila, 'marcaTemporal')
    if (!marcaTemporalTexto) return // fila pre-arrastrada, sin petición real

    const marcaTemporal = parsearFechaHoja(marcaTemporalTexto)
    if (!marcaTemporal || marcaTemporal.getFullYear() < anioMinimo) return

    const adjuntos: Adjunto[] = mapa.columnasAdjuntos.flatMap(({ columna, etiqueta }) =>
      extraerAdjuntos(etiqueta, fila[columna - 1] ?? ''),
    )

    const camposExtra = mapa.indicesSinResolver
      .map((c) => ({
        etiqueta: (encabezados[c - 1] ?? '').replace(/\s+/g, ' ').trim(),
        valor: (fila[c - 1] ?? '').trim(),
      }))
      .filter((c) => c.valor && c.etiqueta)

    casos.push({
      fila: i + 2, // los datos empiezan en la fila 2
      folio: campo(fila, 'folio'),
      marcaTemporalIso: marcaTemporal.toISOString(),
      marcaTemporalTexto,
      area: campo(fila, 'area'),
      tipoTramite: campo(fila, 'tipoTramite'),
      tipoSiniestro: campo(fila, 'tipoSiniestro'),
      tipoAtencion: campo(fila, 'tipoAtencion'),
      numeroSiniestro: campo(fila, 'numeroSiniestro'),
      tipoNegocio: campo(fila, 'tipoNegocio'),
      nombreSolicitante: campo(fila, 'nombreSolicitante'),
      // Si el formulario solo trae el correo del ejecutivo, ese es el contacto.
      correoSolicitante: campo(fila, 'correoSolicitante') ?? campo(fila, 'correoEjecutivo'),
      correoEjecutivo: campo(fila, 'correoEjecutivo'),
      agencia: campo(fila, 'agenciaExterna') ?? campo(fila, 'agencia'),
      motivo: campo(fila, 'motivo'),
      aseguradoraDeclarada: campo(fila, 'aseguradoraDeclarada'),
      nombreCliente: campo(fila, 'nombreCliente'),
      estatusInicial: campo(fila, 'estatusInicial'),
      estatusFinal: campo(fila, 'estatusFinal'),
      quienAtendio: campo(fila, 'quienAtendio'),
      folioInterno: campo(fila, 'folioInterno'),
      aseguradoraSeguimiento: campo(fila, 'aseguradoraSeguimiento'),
      teniaPermisos: campo(fila, 'teniaPermisos'),
      causaSeguimiento: campo(fila, 'causaSeguimiento'),
      observaciones: campo(fila, 'observaciones'),
      fechaRespuestaCorreo: campo(fila, 'fechaRespuestaCorreo'),
      fechaAtencionFinal: campo(fila, 'fechaAtencionFinal'),
      adjuntos,
      camposExtra,
    })
  })

  return casos
}

export async function leerCasos(deps: DepsLectura, anioMinimo = 2026) {
  const encabezados = await leerEncabezados(deps)
  const mapa = construirMapa(encabezados)
  const filas = await leerFilas(deps, rangoDeLectura(mapa))
  return { casos: construirCasos(filas, mapa, encabezados, anioMinimo), mapa, encabezados }
}

export { letraColumna }
