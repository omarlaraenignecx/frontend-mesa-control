import { comoRazon, esCeldaProtegida, mensajeDeGoogle } from './error-google'
import type { DepsLectura } from './sheet-reader'
import {
  ENCABEZADO_TIEMPO_ATENCION,
  letraColumna,
  normalizarEncabezado,
  type CampoLogico,
  type MapaEsquema,
} from './sheet-schema'

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
  | 'reclasificacion'
  | 'tiempoAtencion'

/**
 * Lista blanca: las únicas columnas que esta aplicación puede escribir.
 *
 * Todo lo demás está prohibido, en particular las respuestas del formulario
 * (que son registro del solicitante), las columnas de fórmula y los duplicados
 * residuales de estatus. La comprobación ocurre antes de cualquier llamada HTTP,
 * de modo que un error de programación no alcanza a tocar la hoja.
 *
 * Ninguna respuesta del formulario está aquí, y `reclasificacion` no es una
 * excepción: es una columna propia de la mesa (KV, «Reclasificación»), al lado de
 * las demás de seguimiento. Cuando el solicitante elige mal el trámite —manda un
 * endoso marcado como emisión— la mesa anota ahí la clasificación buena, y lo que
 * él eligió sigue intacto en su columna del formulario.
 *
 * Se intentó antes escribir el trámite en su propia celda y no se pudo: esas
 * columnas viven dentro de un rango protegido del libro que no incluye a la
 * cuenta de la mesa, y Sheets contesta 400. Escribir al lado evita el permiso y
 * además conserva el original, que es mejor registro.
 *
 * `tiempoAtencion` es otra columna de la mesa (KW). No la teclea nadie: la calcula
 * la aplicación al cerrar un caso, a partir de A y KD. Ver `lib/casos/tiempo-atencion.ts`.
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
  'reclasificacion',
  'tiempoAtencion',
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

/**
 * Campos que van a la hoja como número. Como cadena, "26.5" quedaría como texto
 * con RAW —y `PROMEDIO` la ignoraría— o dependería de la configuración regional
 * del libro con `USER_ENTERED`. Un número JSON se guarda como número con los dos
 * modos y no pasa por el análisis de texto.
 *
 * Además va en el lote del sello, junto a la fecha de atención final: el tiempo
 * se mide contra esa fecha, y si la fecha no llega a la hoja tampoco debe llegar
 * un tiempo que dependa de ella.
 */
const CAMPOS_NUMERICOS = ['tiempoAtencion'] as const satisfies readonly CampoEscribible[]

function esCampoNumerico(campo: CampoEscribible): boolean {
  return (CAMPOS_NUMERICOS as readonly string[]).includes(campo)
}

function valorParaLaHoja(campo: CampoEscribible, valor: string): string | number {
  if (!esCampoNumerico(campo)) return valor
  const numero = Number(valor)
  if (!valor.trim() || !Number.isFinite(numero)) {
    throw new Error(`El ${campo} "${valor}" no es un número; la herramienta no lo escribe.`)
  }
  return numero
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
    const mensaje = await mensajeDeGoogle(respuesta)
    // La hoja protege columnas por rangos con lista de editores. Si la cuenta de
    // la mesa no está en la del rango que toca, Sheets contesta 400 y no 403. No
    // se arregla desde el código —hay que dar el permiso en la hoja—, y decirlo
    // aquí ahorra el viaje de averiguarlo.
    if (esCeldaProtegida(mensaje)) {
      throw new Error(
        'La hoja tiene esa columna dentro de un rango protegido y la cuenta de Google que autorizó la mesa no está entre sus editores. ' +
          'Pide al propietario del libro que la agregue como editora de ese rango.' +
          comoRazon(mensaje),
      )
    }
    throw new Error(
      `Sheets respondió ${respuesta.status} al guardar los cambios.${comoRazon(mensaje)}`,
    )
  }
  return respuesta
}

/**
 * Relee la fila y confirma que sigue siendo el caso que el usuario abrió.
 *
 * Cubre el hueco que el bloqueo interno no puede cerrar: alguien editando la hoja
 * directamente. El PRD asume ese riesgo a cambio de conservar la hoja como red de
 * seguridad, y esta comprobación es lo que evita pisar su cambio.
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
  celdas: { columna: number; valor: string | number }[],
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

  // También antes de cualquier llamada: un tiempo ilegible se rechaza sin tocar la hoja.
  const convertidos = entradas.map(
    ([campo, valor]) => [campo, valorParaLaHoja(campo, valor)] as const,
  )

  await confirmarFila(deps, mapa, fila, testigo)

  const celdas = convertidos.map(([campo, valor]) => ({
    campo,
    columna: columnaDe(mapa, campo),
    valor,
  }))
  const esDelSello = (campo: CampoEscribible) => esCampoDeFecha(campo) || esCampoNumerico(campo)
  const fechas = celdas.filter((c) => esDelSello(c.campo))
  const texto = celdas.filter((c) => !esDelSello(c.campo))

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

/**
 * Única vía autorizada para escribir la columna del folio.
 *
 * Escribe todas las filas pendientes en un solo lote, y solo después de
 * comprobar en una sola lectura que las dos condiciones se cumplen en **todas**:
 * la marca temporal sigue siendo la que el usuario vio, y el folio sigue vacío.
 * Si una falla no se escribe ninguna, porque un lote a medias dejaría un hueco
 * en la serie y nadie sabría por dónde se quedó.
 *
 * Va con `USER_ENTERED` y no con RAW, al contrario que el resto del seguimiento:
 * la columna es numérica en toda la hoja, y el valor son dígitos generados por la
 * aplicación —lo comprueba antes—, así que no hay riesgo de que Sheets lo
 * interprete como fórmula o como fecha.
 */
export async function escribirFolios(
  deps: DepsLectura,
  mapa: MapaEsquema,
  asignaciones: { fila: number; folio: string }[],
  testigos: Map<number, string>,
): Promise<void> {
  if (asignaciones.length === 0) return

  for (const { folio } of asignaciones) {
    if (!/^\d+$/.test(folio)) {
      throw new Error(`El folio "${folio}" no son solo dígitos; la herramienta no lo escribe.`)
    }
  }
  if (new Set(asignaciones.map((a) => a.folio)).size !== asignaciones.length) {
    throw new Error('El lote trae un folio repetido; no se escribe nada.')
  }

  const colFecha = columnaDe(mapa, 'marcaTemporal')
  const colFolio = columnaDe(mapa, 'folio')
  const celda = (columna: number, fila: number) =>
    `${deps.pestana}!${letraColumna(columna)}${fila}`

  const rangos = asignaciones.flatMap(({ fila }) => [celda(colFecha, fila), celda(colFolio, fila)])
  const respuesta = await pedir(
    deps,
    `${BASE}/${deps.sheetId}/values:batchGet?` +
      rangos.map((r) => `ranges=${encodeURIComponent(r)}`).join('&') +
      '&majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE',
  )
  const cuerpo = (await respuesta.json()) as { valueRanges?: { values?: string[][] }[] }
  const leer = (indice: number) =>
    (cuerpo.valueRanges?.[indice]?.values?.[0]?.[0] ?? '').trim() || null

  asignaciones.forEach(({ fila }, i) => {
    const fechaActual = leer(i * 2)
    const esperada = (testigos.get(fila) ?? '').trim() || null
    if (fechaActual !== esperada) {
      throw new FilaCambiadaError({
        campo: 'marca temporal',
        esperado: esperada,
        encontrado: fechaActual,
      })
    }
    const folioActual = leer(i * 2 + 1)
    if (folioActual) {
      throw new FilaCambiadaError({ campo: 'folio', esperado: null, encontrado: folioActual })
    }
  })

  // No se usa `escribirCeldas`: esa función recibe una fila y le pega la letra de
  // cada columna, y aquí cada celda va en una fila distinta.
  await pedir(deps, `${BASE}/${deps.sheetId}/values:batchUpdate?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: asignaciones.map(({ fila, folio }) => ({
        range: celda(colFolio, fila),
        majorDimension: 'ROWS',
        values: [[folio]],
      })),
    }),
  })
}

/**
 * Abre la columna del tiempo de atención al final de la hoja: la agrega a la
 * cuadrícula si no alcanza —escribir fuera de ella falla— y le pone encabezado.
 * Sólo la usa el script del histórico; la aplicación nunca crea columnas.
 */
export async function crearColumnaTiempo(deps: DepsLectura, columna: number): Promise<void> {
  const respuesta = await pedir(
    deps,
    `${BASE}/${deps.sheetId}?fields=${encodeURIComponent(
      'sheets.properties(sheetId,title,gridProperties.columnCount)',
    )}`,
  )
  const cuerpo = (await respuesta.json()) as {
    sheets?: {
      properties?: { sheetId?: number; title?: string; gridProperties?: { columnCount?: number } }
    }[]
  }
  const pestana = cuerpo.sheets?.find((s) => s.properties?.title === deps.pestana)?.properties
  if (pestana?.sheetId === undefined) {
    throw new Error(`No se encontró la pestaña "${deps.pestana}" en la hoja.`)
  }
  const actuales = pestana.gridProperties?.columnCount ?? 0
  if (actuales < columna) {
    await pedir(deps, `${BASE}/${deps.sheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            appendDimension: {
              sheetId: pestana.sheetId,
              dimension: 'COLUMNS',
              length: columna - actuales,
            },
          },
        ],
      }),
    })
  }
  await escribirCeldas(deps, 1, [{ columna, valor: ENCABEZADO_TIEMPO_ATENCION }])
}

/**
 * Escribe los tiempos del histórico en un solo lote y devuelve cuántos escribió.
 *
 * Entre la lectura del script y este momento la hoja puede cambiar, así que antes
 * relee, en una sola llamada, la columna A y la del tiempo:
 * - si el encabezado de la columna ya no es el del tiempo, alguien la movió y
 *   escribir por posición pondría horas en la columna de otro: no se escribe nada;
 * - si una fila ya no trae la marca temporal que se leyó, alguien ordenó o movió
 *   filas: tampoco se escribe nada, igual que con los folios, porque un lote a
 *   medias no dejaría saber qué quedó bien;
 * - si una celda del tiempo ya tiene dato —la aplicación la selló en ese lapso—,
 *   esa fila se salta: nunca se toca una celda con dato.
 */
export async function escribirTiempos(
  deps: DepsLectura,
  columna: number,
  asignaciones: { fila: number; horas: number; marcaTemporalTexto: string }[],
): Promise<number> {
  if (asignaciones.length === 0) return 0
  const letra = letraColumna(columna)
  const respuesta = await pedir(
    deps,
    `${BASE}/${deps.sheetId}/values:batchGet` +
      `?ranges=${encodeURIComponent(`${deps.pestana}!A1:A`)}` +
      `&ranges=${encodeURIComponent(`${deps.pestana}!${letra}1:${letra}`)}` +
      '&majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE',
  )
  const cuerpo = (await respuesta.json()) as { valueRanges?: { values?: string[][] }[] }
  const leer = (rango: number, fila: number) =>
    (cuerpo.valueRanges?.[rango]?.values?.[fila - 1]?.[0] ?? '').trim()

  const encabezado = leer(1, 1)
  if (normalizarEncabezado(encabezado) !== normalizarEncabezado(ENCABEZADO_TIEMPO_ATENCION)) {
    throw new Error(
      `La columna ${letra} dice "${encabezado}" y no es la del tiempo de atención; no se escribe nada.`,
    )
  }
  for (const { fila, marcaTemporalTexto } of asignaciones) {
    const actual = leer(0, fila) || null
    if (actual !== marcaTemporalTexto.trim()) {
      throw new FilaCambiadaError({
        campo: `marca temporal de la fila ${fila}`,
        esperado: marcaTemporalTexto,
        encontrado: actual,
      })
    }
  }
  const pendientes = asignaciones.filter(({ fila }) => !leer(1, fila))
  if (pendientes.length === 0) return 0

  await pedir(deps, `${BASE}/${deps.sheetId}/values:batchUpdate?valueInputOption=RAW`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: pendientes.map(({ fila, horas }) => ({
        range: `${deps.pestana}!${letra}${fila}`,
        majorDimension: 'ROWS',
        values: [[horas]],
      })),
    }),
  })
  return pendientes.length
}
