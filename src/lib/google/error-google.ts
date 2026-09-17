/**
 * La frase con la que Google explica que rechazó una petición, para pegarla al
 * mensaje de error que ve quien está usando la herramienta.
 *
 * Las APIs de Sheets, Gmail y Drive contestan los errores con la misma forma
 * —`{ error: { code, message, status } }`— y la razón vive en ese `message`: el
 * rango que no supo leer, el parámetro que no reconoce, la celda protegida. Sin
 * ella el error dice el número de estado y nada más, y quien lo ve no puede
 * distinguir un fallo de programación de un permiso que falta; diagnosticarlo
 * obliga a reproducir la llamada a mano contra la cuenta de la mesa.
 *
 * Va tal cual, en inglés y entre comillas: es un dato para quien depura, y
 * traducirlo lo volvería imposible de buscar.
 *
 * Devuelve cadena vacía —nunca lanza— cuando no hay nada que añadir. Esto corre
 * dentro de la construcción de un error, así que fallar aquí taparía el error de
 * verdad: un 502 con una página de HTML, o un cuerpo ya consumido, no deben
 * costar el número de estado.
 */
export async function razonDeGoogle(respuesta: Response): Promise<string> {
  try {
    const cuerpo = (await respuesta.json()) as { error?: { message?: string } }
    const mensaje = cuerpo?.error?.message?.trim()
    return mensaje ? ` Google explicó: «${mensaje}»` : ''
  } catch {
    return ''
  }
}
