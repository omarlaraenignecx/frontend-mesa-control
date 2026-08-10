import type { DepsLectura } from './sheet-reader'
import { letraColumna, type CampoLogico, type MapaEsquema } from './sheet-schema'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

export type CampoSeguimiento =
  | 'estatusInicial'
  | 'estatusFinal'
  | 'quienAtendio'
  | 'aseguradoraSeguimiento'
  | 'teniaPermisos'
  | 'causaSeguimiento'

export const CAMPOS_CON_CATALOGO: CampoSeguimiento[] = [
  'estatusInicial',
  'estatusFinal',
  'quienAtendio',
  'aseguradoraSeguimiento',
  'teniaPermisos',
  'causaSeguimiento',
]

export type Catalogos = Partial<Record<CampoSeguimiento, string[]>>

type CeldaConValidacion = {
  dataValidation?: {
    condition?: { type?: string; values?: { userEnteredValue?: string }[] }
  }
}

/**
 * Los valores permitidos se leen de la validación de datos de la propia hoja,
 * nunca se codifican: si Keynor cambia una lista, la app la refleja sin
 * despliegue y jamás escribe una variante de texto que rompa su tabla dinámica.
 *
 * Los valores se devuelven tal cual, con sus espacios e inconsistencias
 * ('GPLUS ' con espacio final, 'Atendida/en trámite' sin espacios alrededor de
 * la barra): normalizarlos generaría valores nuevos en el histórico.
 */
export async function leerCatalogos(
  deps: DepsLectura,
  mapa: MapaEsquema,
  filaEjemplo: number,
): Promise<Catalogos> {
  const columnas = CAMPOS_CON_CATALOGO.map((campo) => ({
    campo,
    columna: mapa.columnasPorCampo[campo as CampoLogico]?.[0],
  })).filter((c): c is { campo: CampoSeguimiento; columna: number } => Boolean(c.columna))

  if (columnas.length === 0) return {}

  const primera = Math.min(...columnas.map((c) => c.columna))
  const ultima = Math.max(...columnas.map((c) => c.columna))
  const rango = `${deps.pestana}!${letraColumna(primera)}${filaEjemplo}:${letraColumna(ultima)}${filaEjemplo}`

  const url =
    `${BASE}/${deps.sheetId}?includeGridData=true` +
    `&ranges=${encodeURIComponent(rango)}` +
    `&fields=${encodeURIComponent('sheets(data(rowData(values(dataValidation))))')}`

  const respuesta = await deps.fetch(url, {
    headers: { Authorization: `Bearer ${deps.accessToken}` },
  })

  if (respuesta.status === 403) {
    throw new Error('La cuenta de la mesa no tiene permiso para leer esta hoja de cálculo.')
  }
  if (!respuesta.ok) {
    throw new Error(`Sheets respondió ${respuesta.status} al leer los catálogos.`)
  }

  const cuerpo = (await respuesta.json()) as {
    sheets?: { data?: { rowData?: { values?: CeldaConValidacion[] }[] }[] }[]
  }
  const celdas = cuerpo.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values
  if (!celdas) return {}

  const catalogos: Catalogos = {}
  for (const { campo, columna } of columnas) {
    const celda = celdas[columna - primera]
    const condicion = celda?.dataValidation?.condition
    if (condicion?.type !== 'ONE_OF_LIST') continue
    const valores = (condicion.values ?? [])
      .map((v) => v.userEnteredValue)
      .filter((v): v is string => typeof v === 'string')
    if (valores.length > 0) catalogos[campo] = valores
  }
  return catalogos
}
