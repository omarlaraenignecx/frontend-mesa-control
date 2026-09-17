import { comoRazon, esCeldaProtegida, mensajeDeGoogle } from './error-google'
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
  | 'tipoTramite'

/**
 * Lista blanca: las únicas columnas que esta aplicación puede escribir.
 *
 * Todo lo demás está prohibido, en particular las respuestas del formulario
 * (que son registro del solicitante), las columnas de fórmula y los duplicados
 * residuales de estatus. La comprobación ocurre antes de cualquier llamada HTTP,
 * de modo que un error de programación no alcanza a tocar la hoja.
 *
 * `tipoTramite` es la **única** respuesta del formulario que se puede escribir, y
 * es una excepción autorizada por el área el 14/9/2026, no una puerta abierta: el
 * solicitante elige el trámite de una lista y se equivoca a menudo —manda un
 * endoso marcado como emisión—, y la mesa no tenía forma de corregirlo, así que
 * sus reportes contaban una póliza emitida que nunca existió. El valor anterior
 * no se pierde: queda en la bitácora y en una línea de Observaciones, que es la
 * que la mesa lee desde la propia hoja.
 *
 * Queda un riesgo que esto no cubre y conviene conocer: si el solicitante usa el
 * enlace de «editar respuesta» de Google Forms, Forms reescribe su fila con lo
 * que él eligió y borra la corrección. No lo detecta `confirmarFila`, porque
 * editar una respuesta no cambia la marca temporal. El rastro de la bitácora y de
 * Observaciones es lo que permite darse cuenta y rehacerla.
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
  'tipoTramite',
] as const satisfies readonly CampoEscribible[]

/**
 * Los escribibles que no viven en una sola columna.
 *
 * El formulario está replicado en bloques y además pregunta lo mismo con cuatro
 * redacciones distintas —«Tipo de trámite:», «Trámite:», «Indicar tipo de trámite
 * solicitado», «Indicar el tipo de solicitud»—, así que el campo agrupa **17**
 * columnas equivalentes y cada fila llenó una sola. La celda buena es la que hoy
 * trae el valor: la misma de la que se leyó el caso. Se resuelve al escribir,
 * releyendo la fila; ver `confirmarFila`.
 */
const CAMPOS_REPLICADOS = ['tipoTramite'] as const satisfies readonly CampoEscribible[]

function esCampoReplicado(campo: CampoEscribible): boolean {
  return (CAMPOS_REPLICADOS as readonly string[]).includes(campo)
}

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

/**
 * No hay dónde escribir la corrección: la fila no trae valor en ninguna de las
 * columnas equivalentes del campo, así que no se sabe qué bloque del formulario
 * llenó y elegir uno a ciegas dejaría el dato donde nadie lo lee.
 */
export class SinColumnaDeOrigenError extends Error {
  constructor(readonly campo: string) {
    super(
      `Este caso no trae ${campo} en el formulario, así que no hay ninguna celda donde escribir la corrección.`,
    )
    this.name = 'SinColumnaDeOrigenError'
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
    // La hoja protege columnas por rangos con lista de editores, y el rango que
    // cubre las respuestas del formulario no incluye a la cuenta de la mesa. Se
    // nota al corregir el tipo de trámite, que es lo único que la aplicación
    // escribe ahí. No se arregla desde el código: hay que dar el permiso en la
    // hoja, y decirlo aquí ahorra el viaje de averiguarlo.
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
 * Relee la fila, confirma que sigue siendo el caso que el usuario abrió y resuelve
 * en qué columna vive cada campo replicado.
 *
 * Lo primero cubre el hueco que el bloqueo interno no puede cerrar: alguien
 * editando la hoja directamente. El PRD asume ese riesgo a cambio de conservar la
 * hoja como red de seguridad, y esta comprobación es lo que evita pisar su cambio.
 *
 * Lo segundo va aquí y no en una lectura aparte por dos razones. La cuota de
 * Sheets cuenta peticiones y no rangos, así que resolver el bloque dentro de esta
 * misma llamada no cuesta nada; y sobre todo, el testigo y la columna destino
 * salen entonces de la **misma** foto de la fila, que es justo lo que esta función
 * existe para garantizar.
 */
async function confirmarFila(
  deps: DepsLectura,
  mapa: MapaEsquema,
  fila: number,
  testigo: Testigo,
  aResolver: CampoEscribible[] = [],
): Promise<Partial<Record<CampoEscribible, number>>> {
  const colFecha = columnaDe(mapa, 'marcaTemporal')
  const colFolio = columnaDe(mapa, 'folio')

  const bloques = aResolver.map((campo) => ({
    campo,
    columnas: mapa.columnasPorCampo[campo as CampoLogico] ?? [],
  }))

  // Rangos exactos y no uno continuo: la marca temporal está en la columna A y el
  // folio en JY, así que un rango A:JY traería 285 celdas para comparar 2. Son dos
  // cuando el guardado no toca ningún campo replicado, y 19 cuando corrige el
  // trámite —sus 17 columnas equivalentes—, siempre en una sola petición: la cuota
  // de Sheets cuenta peticiones, no rangos.
  const celda = (columna: number) => `${deps.pestana}!${letraColumna(columna)}${fila}`
  const columnas = [colFecha, colFolio, ...bloques.flatMap((b) => b.columnas)]
  const url =
    `${BASE}/${deps.sheetId}/values:batchGet?` +
    columnas.map((c) => `ranges=${encodeURIComponent(celda(c))}`).join('&') +
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

  // La primera columna con valor, recorriendo el grupo en el orden del mapa. Es
  // **la misma regla** que usa `valorDe()` al leer (`sheet-reader.ts`): si las dos
  // divergieran, la aplicación escribiría en una celda y leería otra.
  const resueltas: Partial<Record<CampoEscribible, number>> = {}
  let desplazamiento = 2
  for (const { campo, columnas: delCampo } of bloques) {
    const base = desplazamiento
    desplazamiento += delCampo.length
    const columna = delCampo.find((_, i) => leer(base + i) !== null)
    if (columna === undefined) throw new SinColumnaDeOrigenError(ETIQUETAS_REPLICADAS[campo])
    resueltas[campo] = columna
  }
  return resueltas
}

/** Cómo nombrar el campo en el error que ve quien está guardando. */
const ETIQUETAS_REPLICADAS: Record<string, string> = {
  tipoTramite: 'tipo de trámite',
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
  for (const [campo, valor] of entradas) {
    if (!CAMPOS_ESCRIBIBLES.includes(campo)) throw new ColumnaNoEscribibleError(campo)
    // Vaciar un campo replicado borraría la respuesta del solicitante sin poner
    // nada en su lugar, y dejaría la fila sin clasificación ni celda que resolver
    // la próxima vez. Corregir es sustituir, no borrar.
    if (esCampoReplicado(campo) && !valor.trim()) {
      throw new Error(
        `El ${ETIQUETAS_REPLICADAS[campo]} no se puede dejar vacío: se corrige por otro valor, no se borra.`,
      )
    }
  }
  if (entradas.length === 0) return

  const resueltas = await confirmarFila(
    deps,
    mapa,
    fila,
    testigo,
    entradas.map(([campo]) => campo).filter(esCampoReplicado),
  )

  const celdas = entradas.map(([campo, valor]) => ({
    campo,
    columna: resueltas[campo] ?? columnaDe(mapa, campo),
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
