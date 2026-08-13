'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { requerirUsuario } from '@/lib/auth/guard'
import { registrarAccion } from '@/lib/casos/bitacora'
import { sinFolio } from '@/lib/casos/caso'
import { depsDeGoogle } from '@/lib/casos/consulta'
import { TOPE_POR_TANDA, asignarFolios } from '@/lib/casos/folios'
import { leerCasos, leerColumnaFolios } from '@/lib/google/sheet-reader'
import { FilaCambiadaError, escribirFolios } from '@/lib/google/sheet-writer'

export type ResultadoFolios = { ok: true; generados: number } | { ok: false; error: string }

/**
 * Llena de una vez la columna del folio en todos los casos que llegaron sin él,
 * continuando la serie desde el máximo de la columna. Sustituye al arrastre que
 * la mesa hacía a mano en la hoja.
 *
 * Vive en la raíz de `app/` y no junto a una página porque la usan las dos
 * vistas: la fila y el caso.
 */
export async function generarFolios(): Promise<ResultadoFolios> {
  const usuario = await requerirUsuario()
  const deps = await depsDeGoogle()

  const { casos, mapa } = await leerCasos(deps)
  const faltantes = casos.filter(sinFolio).sort((a, b) => a.fila - b.fila)
  if (faltantes.length === 0) return { ok: true, generados: 0 }

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
    await registrarAccion(fila, folio, usuario.correo, 'Folio de atención', folio, 'folio_capturado')
  }

  updateTag('casos')
  revalidatePath('/fila')
  for (const { fila } of asignaciones) revalidatePath(`/caso/${fila}`)

  return { ok: true, generados: asignaciones.length }
}
