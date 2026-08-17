import { sinFolio } from './caso'
import { depsDeGoogle } from './consulta'
import { TOPE_POR_TANDA, asignarFolios } from './folios'
import { registrarAccion } from './bitacora'
import { leerCasos, leerColumnaFolios } from '@/lib/google/sheet-reader'
import { FilaCambiadaError, escribirFolios } from '@/lib/google/sheet-writer'

export type ResultadoFolios =
  /** `filas` son las que recibieron folio: quien llama decide qué vistas refrescar. */
  | { ok: true; generados: number; filas: number[] }
  | { ok: false; error: string }

/**
 * Llena la columna del folio en todos los casos que llegaron sin él, continuando
 * la serie desde el máximo de la columna. Sustituye al arrastre que la mesa hacía
 * a mano en la hoja.
 *
 * Vive en `lib/` y no en el archivo de acciones a propósito: en un archivo con
 * `'use server'` toda función exportada queda expuesta como punto de entrada
 * llamable desde el navegador, y esta no revisa sesión —la usa también la ruta que
 * despierta n8n, que se autentica con un secreto—. Quien la llama es responsable
 * de haber comprobado el permiso.
 *
 * `autor` es quien queda en la bitácora: el correo de la persona cuando viene del
 * botón, o `n8n:casos-nuevos` cuando la dispara la llegada de una petición. La
 * distinción importa para poder auditar quién escribió un folio en la hoja.
 */
export async function generarFoliosPendientes(autor: string): Promise<ResultadoFolios> {
  const deps = await depsDeGoogle()

  const { casos, mapa } = await leerCasos(deps)
  const faltantes = casos.filter(sinFolio).sort((a, b) => a.fila - b.fila)
  if (faltantes.length === 0) return { ok: true, generados: 0, filas: [] }

  if (faltantes.length > TOPE_POR_TANDA) {
    return {
      ok: false,
      error: `Hay ${faltantes.length} peticiones sin folio, más de las ${TOPE_POR_TANDA} que la herramienta genera de una vez. Revisa la hoja antes de continuar y avisa al desarrollo.`,
    }
  }

  const columna = await leerColumnaFolios(deps, mapa)
  const asignaciones = asignarFolios(
    faltantes.map((c) => c.fila),
    columna,
  )
  if (asignaciones.length === 0) {
    return {
      ok: false,
      error:
        'La columna de folio no trae ningún número del que continuar la serie. Revisa la hoja antes de seguir.',
    }
  }

  const testigos = new Map(faltantes.map((c) => [c.fila, c.marcaTemporalTexto]))

  try {
    await escribirFolios(deps, mapa, asignaciones, testigos)
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof FilaCambiadaError
          ? `${e.message} No se generó ningún folio; vuelve a intentarlo.`
          : e instanceof Error
            ? e.message
            : 'No se pudieron generar los folios.',
    }
  }

  for (const { fila, folio } of asignaciones) {
    await registrarAccion(fila, folio, autor, 'Folio de atención', folio, 'folio_capturado')
  }

  return { ok: true, generados: asignaciones.length, filas: asignaciones.map((a) => a.fila) }
}
