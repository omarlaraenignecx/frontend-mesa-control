const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

/**
 * Prueba de vida mínima del acceso a Sheets: lee solo el título del archivo.
 * La Etapa 1 construye el lector de casos sobre este mismo patrón.
 */
export async function leerTituloHoja(
  sheetId: string,
  deps: { fetch: typeof globalThis.fetch; accessToken: string },
): Promise<string> {
  const url = `${BASE}/${sheetId}?fields=properties.title`
  const respuesta = await deps.fetch(url, {
    headers: { Authorization: `Bearer ${deps.accessToken}` },
  })

  if (respuesta.status === 403) {
    throw new Error('La cuenta de la mesa no tiene permiso sobre esa hoja de cálculo.')
  }
  if (respuesta.status === 404) {
    throw new Error('La hoja de cálculo no existe o el identificador es incorrecto.')
  }
  if (!respuesta.ok) {
    throw new Error(`Sheets respondió ${respuesta.status} al leer la hoja.`)
  }

  const cuerpo = (await respuesta.json()) as { properties?: { title?: string } }
  const titulo = cuerpo.properties?.title
  if (!titulo) throw new Error('Sheets respondió sin el título de la hoja.')
  return titulo
}
