/**
 * Clave con la que se descarta un aviso repetido.
 *
 * Los flujos de n8n corren cada minuto y reintentan, así que el mismo caso y el
 * mismo mensaje se van a evaluar muchas veces. La clave es única en la tabla y la
 * inserción es `onConflictDoNothing`: el segundo intento no produce nada.
 *
 * Lleva la hoja porque una sola base de datos sirve a la copia y a la hoja real,
 * y la fila 7231 de cada una es un caso distinto.
 */
export function claveDeCasoNuevo(sheetId: string, fila: number): string {
  return `caso_nuevo:${sheetId}:${fila}`
}

export function claveDeCorreo(sheetId: string, messageId: string): string {
  return `correo:${sheetId}:${messageId}`
}
