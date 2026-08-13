import type { DepsLectura } from './sheet-reader'
import { letraColumna, type CampoLogico, type MapaEsquema } from './sheet-schema'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

export type CampoEscribible =
  | 'estatusInicial'
  | 'estatusFinal'
  | 'fechaRespuestaCorreo'
  | 'fechaAtencionFinal'
  | 'quienAtendio'
  | 'folioInterno'
  | 'aseguradoraSeguimiento'
  | 'teniaPermisos'
  | 'causaSeguimiento'
  | 'observaciones'

/**
 * Lista blanca: las únicas columnas que esta aplicación puede escribir.
 *
 * Todo lo demás está prohibido, en particular las respuestas del formulario
 * (que son registro del solicitante), las columnas de fórmula y los duplicados
 * residuales de estatus. La comprobación ocurre antes de cualquier llamada HTTP,
 * de modo que un error de programación no alcanza a tocar la hoja.
 */
export const CAMPOS_ESCRIBIBLES = [
  'estatusInicial',
  'estatusFinal',
  'fechaRespuestaCorreo',
  'fechaAtencionFinal',
  'quienAtendio',
  'folioInterno',
  'aseguradoraSeguimiento',
  'teniaPermisos',
  'causaSeguimiento',
  'observaciones',
] as const satisfies readonly CampoEscribible[]

/**
 * Los dos campos que van a columnas con formato de fecha (`KB` y `KD`). Se
 * escriben aparte, con `USER_ENTERED`, para que Sheets los guarde como fecha de
 * verdad: el histórico de esas columnas son números de serie con formato y la
 * fórmula de `KC` es `=KB−A`, que con una cadena daría `#VALUE!`.
 *
 * El resto sigue con RAW a propósito. `USER_ENTERED` convertiría en fórmula unas
 * Observaciones que empiecen con `=`, y dejaría el folio interno `0426014703`
 * como el número `426014703`, sin su cero inicial.
 */
const CAMPOS_DE_FECHA = [
  'fechaRespuestaCorreo',
  'fechaAtencionFinal',
] as const satisfies readonly CampoEscribible[]

function esCampoDeFecha(campo: CampoEscribible): boolean {
  return (CAMPOS_DE_FECHA as readonly string[]).includes(campo)
}

export class ColumnaNoEscribibleError extends Error {
  constructor(readonly campo: string) {
    super(`El campo "${campo}" no está en la lista de columnas que la herramienta puede escribir.`)
    this.name = 'ColumnaNoEscribibleError'
  }
}

export class FilaCambiadaError extends Error {
  constructor(
    readonly detalle: { campo: string; esperado: string | null; encontrado: string | null },
  ) {
    super(
      `El registro cambió desde que abriste el caso: su ${detalle.campo} era "${
        detalle.esperado ?? '(vacío)'
      }" y ahora es "${detalle.encontrado ?? '(vacío)'}".`,
    )
    this.name = 'FilaCambiadaError'
  }
}

/**
 * El guardado ocurrió y el sello de fecha no. Es una falla parcial, y quien la
 * atrape debe tratarla como guardado: negarlo haría que la mesa volviera a
 * capturar lo que ya está en la hoja.
 */
export class SelloNoEscritoError extends Error {
  constructor(
    readonly campos: string[],
    opciones?: { cause?: unknown },
  ) {
    super(
      'Se guardaron los cambios en la hoja, pero no se pudo sellar la fecha. Vuelve a guardar para completarla.',
      opciones,
    )
    this.name = 'SelloNoEscritoError'
  }
}

export type Testigo = { marcaTemporalTexto: string; folio: string | null }

function columnaDe(mapa: MapaEsquema, campo: string): number {
  const columnas = mapa.columnasPorCampo[campo as CampoLogico]
  if (!columnas?.length) throw new ColumnaNoEscribibleError(campo)
  return columnas[0]
}

async function pedir(deps: DepsLectura, url: string, init?: RequestInit) {
  const respuesta = await deps.fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${deps.accessToken}`,
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (respuesta.status === 403) {
    throw new Error('La cuenta de la mesa no tiene permiso de edición sobre esta hoja de cálculo.')
  }
  if (respuesta.status === 429) {
    throw new Error(
      'Google limitó las consultas por exceso de peticiones. Vuelve a intentar el guardado en un momento.',
    )
  }
  if (!respuesta.ok) {
    throw new Error(`Sheets respondió ${respuesta.status} al guardar los cambios.`)
  }
  return respuesta
}

/**
 * Relee la fila y confirma que sigue siendo el caso que el usuario abrió.
 *
 * Esto cubre el hueco que el bloqueo interno no puede cerrar: alguien editando
 * la hoja directamente. El PRD asume ese riesgo a cambio de conservar la hoja
 * como red de seguridad, y esta comprobación es lo que evita pisar su cambio.
 */
async function confirmarFila(
  deps: DepsLectura,
  mapa: MapaEsquema,
  fila: number,
  testigo: Testigo,
): Promise<void> {
  const colFecha = columnaDe(mapa, 'marcaTemporal')
  const colFolio = columnaDe(mapa, 'folio')

  // Dos rangos exactos y no uno continuo: la marca temporal está en la columna A
  // y el folio en JY, así que un rango A:JY traería 285 celdas para comparar 2.
  const celda = (columna: number) => `${deps.pestana}!${letraColumna(columna)}${fila}`
  const url =
    `${BASE}/${deps.sheetId}/values:batchGet` +
    `?ranges=${encodeURIComponent(celda(colFecha))}` +
    `&ranges=${encodeURIComponent(celda(colFolio))}` +
    `&majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`

  const respuesta = await pedir(deps, url)
  const cuerpo = (await respuesta.json()) as { valueRanges?: { values?: string[][] }[] }
  const leer = (indice: number) =>
    (cuerpo.valueRanges?.[indice]?.values?.[0]?.[0] ?? '').trim() || null

  const fechaActual = leer(0)
  if (fechaActual !== testigo.marcaTemporalTexto.trim()) {
    throw new FilaCambiadaError({
      campo: 'marca temporal',
      esperado: testigo.marcaTemporalTexto,
      encontrado: fechaActual,
    })
  }

  const folioActual = leer(1)
  const folioEsperado = testigo.folio?.trim() || null
  if (folioActual !== folioEsperado) {
    throw new FilaCambiadaError({
      campo: 'folio',
      esperado: folioEsperado,
      encontrado: folioActual,
    })
  }
}

/**
 * Una petición por tipo de dato, y todas las celdas de ese tipo en el mismo
 * lote (RNF-06). El texto y las fechas no pueden ir juntos porque
 * `values:batchUpdate` acepta un solo `valueInputOption` por llamada.
 */
async function escribirCeldas(
  deps: DepsLectura,
  fila: number,
  celdas: { columna: number; valor: string }[],
  modo: 'RAW' | 'USER_ENTERED' = 'RAW',
): Promise<void> {
  if (celdas.length === 0) return
  await pedir(deps, `${BASE}/${deps.sheetId}/values:batchUpdate?valueInputOption=${modo}`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: modo,
      data: celdas.map(({ columna, valor }) => ({
        range: `${deps.pestana}!${letraColumna(columna)}${fila}`,
        majorDimension: 'ROWS',
        values: [[valor]],
      })),
    }),
  })
}

export async function escribirSeguimiento(
  deps: DepsLectura,
  mapa: MapaEsquema,
  fila: number,
  valores: Partial<Record<CampoEscribible, string>>,
  testigo: Testigo,
): Promise<void> {
  const entradas = Object.entries(valores).filter(([, v]) => v !== undefined) as [
    CampoEscribible,
    string,
  ][]

  // Primero la lista blanca: si algo no está permitido, no se hace ni una
  // llamada a Google.
  for (const [campo] of entradas) {
    if (!CAMPOS_ESCRIBIBLES.includes(campo)) throw new ColumnaNoEscribibleError(campo)
  }
  if (entradas.length === 0) return

  await confirmarFila(deps, mapa, fila, testigo)

  const celdas = entradas.map(([campo, valor]) => ({
    campo,
    columna: columnaDe(mapa, campo),
    valor,
  }))
  const fechas = celdas.filter((c) => esCampoDeFecha(c.campo))
  const texto = celdas.filter((c) => !esCampoDeFecha(c.campo))

  // El texto primero: es lo que la mesa capturó. El sello lo deriva la app y se
  // puede reconstruir volviendo a guardar, así que es el que puede quedar
  // pendiente sin que se pierda trabajo de nadie.
  await escribirCeldas(deps, fila, texto)
  if (fechas.length === 0) return
  try {
    await escribirCeldas(deps, fila, fechas, 'USER_ENTERED')
  } catch (causa) {
    throw new SelloNoEscritoError(
      fechas.map((f) => f.campo),
      { cause: causa },
    )
  }
}

/** Única vía autorizada para escribir la columna del folio. */
export async function escribirFolio(
  deps: DepsLectura,
  mapa: MapaEsquema,
  fila: number,
  folio: string,
  testigo: Testigo,
): Promise<void> {
  if (testigo.folio?.trim()) {
    throw new Error('Este caso ya tiene folio; la herramienta no lo sobrescribe.')
  }
  if (!folio.trim()) throw new Error('El folio no puede quedar vacío.')

  await confirmarFila(deps, mapa, fila, testigo)
  await escribirCeldas(deps, fila, [{ columna: columnaDe(mapa, 'folio'), valor: folio.trim() }])
}
