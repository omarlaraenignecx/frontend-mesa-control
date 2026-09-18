import { unstable_cache } from 'next/cache'
import { accessTokenDeLaMesa } from '@/lib/google/auth-mesa'
import { leerCatalogos, type Catalogos } from '@/lib/google/sheet-catalogs'
import { leerCasos, type DepsLectura } from '@/lib/google/sheet-reader'
import type { MapaEsquema } from '@/lib/google/sheet-schema'
import { sinFolio, type Caso } from './caso'

export type ResultadoCola = {
  casos: Caso[]
  sinResolver: number
}

export async function depsDeGoogle(): Promise<DepsLectura> {
  return {
    fetch: globalThis.fetch,
    accessToken: await accessTokenDeLaMesa(),
    sheetId: process.env.SHEET_ID!,
    pestana: process.env.SHEET_PESTANA ?? 'Respuestas de formulario 1',
  }
}

/**
 * La lectura de la hoja se cachea con la etiqueta 'casos' y solo se invalida
 * cuando la persona pulsa Actualizar o cuando se guarda un cambio. No hay
 * polling ni refresco automático: así el consumo de cuota queda acotado.
 */
async function leerDeLaHoja(): Promise<ResultadoCola> {
  const { casos, mapa } = await leerCasos(await depsDeGoogle())
  return { casos, sinResolver: mapa.indicesSinResolver.length }
}

export const cargarCola = unstable_cache(leerDeLaHoja, ['cola-casos'], {
  tags: ['casos'],
  revalidate: 300,
})

/**
 * Devuelve el mapa junto con el caso para que guardar no tenga que releer las
 * 1,400 filas: una lectura completa por guardado sería gasto de cuota inútil.
 *
 * `sinFolioTotal` cuenta los casos sin folio de toda la hoja, no solo este: el
 * aviso que ofrece generarlos actúa sobre la columna completa. Sale de la lectura
 * que ya se hizo, así que no cuesta una llamada más.
 */
export async function cargarCaso(fila: number): Promise<{
  caso: Caso
  catalogos: Catalogos
  mapa: MapaEsquema
  sinFolioTotal: number
} | null> {
  const deps = await depsDeGoogle()
  const { casos, mapa } = await leerCasos(deps)
  const caso = casos.find((c) => c.fila === fila)
  if (!caso) return null
  const catalogos = await leerCatalogos(deps, mapa, fila)
  return { caso, catalogos, mapa, sinFolioTotal: casos.filter(sinFolio).length }
}
