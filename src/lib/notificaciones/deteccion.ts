import type { Caso } from '@/lib/casos/caso'

/**
 * Qué casos de la lectura son nuevos frente a la última marca procesada.
 *
 * Se compara la marca temporal y no el número de fila: el formulario **inserta**
 * la respuesta nueva arriba de las filas que la mesa pre-arrastró para el folio,
 * así que "la fila más alta" no es "lo más reciente". Ese es el mismo mecanismo
 * que produjo los 210 folios duplicados de la hoja.
 *
 * Sin marca guardada no se notifica nada: es el arranque, y avisar de todo el
 * histórico sería inservible. La marca se siembra en silencio en la primera
 * corrida.
 */
export function casosNuevos(casos: Caso[], marcaGuardada: string | null): Caso[] {
  if (!marcaGuardada) return []
  // Mayor o igual, no mayor: dos respuestas del mismo segundo existen y ninguna
  // debe perderse. El repetido lo descarta la clave única de la tabla.
  //
  // Un caso sin fecha legible no se puede comparar y no genera aviso: llamar la
  // atención sobre él cada minuto, para siempre, sería peor que no avisar. Se
  // sigue viendo en la fila, que es donde alguien lo va a revisar.
  return casos.filter((c) => c.marcaTemporalIso !== null && c.marcaTemporalIso >= marcaGuardada)
}

export function marcaMasAlta(casos: Caso[]): string | null {
  return casos.reduce<string | null>((alta, c) => {
    const iso = c.marcaTemporalIso
    if (iso === null) return alta
    return alta === null || iso > alta ? iso : alta
  }, null)
}
