/**
 * Normaliza texto que viene de la hoja para poder compararlo.
 *
 * La gente captura "Trámite", "tramite" y "TRAMITE" para la misma cosa, y la hoja
 * guarda las tres. Cualquier comparación contra un valor de la hoja pasa por aquí.
 *
 * Vive aparte porque lo usan la fila y la identificación del área, y tener dos
 * copias de esta función es tener dos criterios de igualdad que pueden separarse.
 * No confundir con `normalizarEncabezado`, que además colapsa espacios y recorta
 * signos porque los encabezados del formulario traen saltos de línea y dos puntos.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim()
}
