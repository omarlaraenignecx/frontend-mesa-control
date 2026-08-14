import { LIMITE_GMAIL_BYTES } from './mime'

/**
 * Cuánto puede pesar el cuerpo de una Server Action.
 *
 * Vive aquí y no escrito en `next.config.ts` porque el defecto que corrige nació
 * de tener dos límites separados: el compositor de correo dejaba adjuntar hasta
 * lo que Gmail acepta (25 MB ya codificados) mientras la acción cortaba en 1 MB,
 * el valor por omisión de Next. Un PDF de tres megas pasaba la revisión de la
 * pantalla y Next abortaba la petición con un 413 antes de ejecutar la acción, lo
 * que en el navegador se ve como "This page couldn't load", sin explicación.
 *
 * El archivo viaja crudo en el `FormData` de la acción y se codifica en base64
 * después, ya en el servidor, así que el tope tiene que cubrir los bytes crudos
 * que caben en el correo, más un margen para el texto y las fronteras del
 * multiparte.
 */
export const LIMITE_CUERPO_ACCION_BYTES = 25 * 1024 * 1024

/** Bytes de archivo sin codificar que todavía caben en el tope de Gmail. */
export function bytesCrudosQueCabenEnGmail(): number {
  return Math.floor((LIMITE_GMAIL_BYTES * 3) / 4)
}
