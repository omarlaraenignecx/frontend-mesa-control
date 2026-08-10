import { unstable_cache } from 'next/cache'
import { accessTokenDeLaMesa } from '@/lib/google/auth-mesa'
import { leerCasos } from '@/lib/google/sheet-reader'
import type { Caso } from './caso'

export type ResultadoCola = {
  casos: Caso[]
  sinResolver: number
}

/**
 * La lectura de la hoja se cachea con la etiqueta 'casos' y solo se invalida
 * cuando la persona pulsa Actualizar. No hay polling ni refresco automático:
 * así el consumo de cuota de la API queda acotado a las cargas reales.
 */
async function leerDeLaHoja(): Promise<ResultadoCola> {
  const accessToken = await accessTokenDeLaMesa()
  const { casos, mapa } = await leerCasos({
    fetch: globalThis.fetch,
    accessToken,
    sheetId: process.env.SHEET_ID!,
    pestana: process.env.SHEET_PESTANA ?? 'Respuestas de formulario 1',
  })
  return { casos, sinResolver: mapa.indicesSinResolver.length }
}

export const cargarCola = unstable_cache(leerDeLaHoja, ['cola-casos'], {
  tags: ['casos'],
  revalidate: 300,
})
