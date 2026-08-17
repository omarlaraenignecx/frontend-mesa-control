'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { requerirUsuario } from '@/lib/auth/guard'
import { generarFoliosPendientes, type ResultadoFolios } from '@/lib/casos/generacion-folios'

export type { ResultadoFolios }

/**
 * El botón "Generar folios" de la fila y del caso.
 *
 * La escritura vive en `lib/casos/generacion-folios.ts` porque la comparte con la
 * ruta que despierta n8n al detectar peticiones nuevas. Aquí queda lo propio de la
 * acción: comprobar la sesión, atribuir el folio a quien lo pidió y refrescar las
 * vistas.
 */
export async function generarFolios(): Promise<ResultadoFolios> {
  const usuario = await requerirUsuario()

  const resultado = await generarFoliosPendientes(usuario.correo)
  if (!resultado.ok || resultado.generados === 0) return resultado

  updateTag('casos')
  revalidatePath('/fila')
  for (const fila of resultado.filas) revalidatePath(`/caso/${fila}`)

  return resultado
}
