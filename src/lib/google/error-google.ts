/**
 * El mensaje con el que Google explica que rechazó una petición, tal cual.
 *
 * Las APIs de Sheets, Gmail y Drive contestan los errores con la misma forma
 * —`{ error: { code, message, status } }`— y la razón vive en ese `message`: el
 * rango que no supo leer, el parámetro que no reconoce, la celda protegida.
 *
 * Devuelve `null` —nunca lanza— cuando no hay nada que leer. Esto corre dentro de
 * la construcción de un error, así que fallar aquí taparía el error de verdad: un
 * 502 con una página de HTML, o un cuerpo ya consumido, no deben costar el número
 * de estado.
 */
export async function mensajeDeGoogle(respuesta: Response): Promise<string | null> {
  try {
    const cuerpo = (await respuesta.json()) as { error?: { message?: string } }
    return cuerpo?.error?.message?.trim() || null
  } catch {
    return null
  }
}

/**
 * Ese mismo mensaje, listo para pegarlo al final del error que ve quien está
 * usando la herramienta.
 *
 * Sin él el error dice el número de estado y nada más, y quien lo ve no puede
 * distinguir un fallo de programación de un permiso que falta; diagnosticarlo
 * obliga a reproducir la llamada a mano contra la cuenta de la mesa. Va tal cual
 * y entre comillas: es un dato para quien depura, y reescribirlo lo volvería
 * imposible de buscar.
 */
export async function razonDeGoogle(respuesta: Response): Promise<string> {
  return comoRazon(await mensajeDeGoogle(respuesta))
}

/** La misma envoltura, cuando el mensaje ya se leyó por otro lado. */
export function comoRazon(mensaje: string | null): string {
  return mensaje ? ` Google explicó: «${mensaje}»` : ''
}

/**
 * Si el rechazo fue por escribir en una celda protegida.
 *
 * Se reconoce por el texto y no por un código porque la API de valores no manda
 * ninguno: el cuerpo trae `INVALID_ARGUMENT` para esto y para un rango mal
 * escrito. Y el texto llega **en el idioma de la cuenta** —la de la mesa contesta
 * en español—, así que se busca la raíz de la palabra en los dos idiomas en que
 * puede llegarnos.
 *
 * Es una heurística y puede fallar con otro idioma. No es grave: lo único que se
 * pierde es la explicación de qué hacer, porque el mensaje original de Google
 * viaja igual.
 */
export function esCeldaProtegida(mensaje: string | null): boolean {
  if (!mensaje) return false
  return /protegid|protected/i.test(mensaje)
}
