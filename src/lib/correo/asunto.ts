export const PREFIJO_ASUNTO = 'Seguimiento de Caso | Gplus Seguros'

/**
 * El asunto es la llave que mantiene unida la conversación con el caso: la app
 * lo fija al abrir el hilo y el solicitante lo conserva al responder, así que
 * sirve como respaldo cuando el threadId guardado no alcanza.
 */
export function componerAsunto(folio: string): string {
  return `${PREFIJO_ASUNTO} | ${folio.trim()}`
}

/**
 * Asunto del reenvío de la conversación a un tercero.
 *
 * Deliberadamente **no** contiene PREFIJO_ASUNTO: `consultaDeBusqueda()` busca
 * esa frase como subcadena en Gmail, así que un reenvío que la llevara podría
 * devolverse como el hilo del caso el día que se pierda el vínculo guardado.
 * El reenvío es compartir la conversación, no continuarla.
 */
export function asuntoDeReenvio(folio: string): string {
  return `Conversación del caso ${folio.trim()} | Mesa de Control Gplus Seguros`
}

/** Los clientes de correo agregan Re:, RE:, Fwd: al responder o reenviar. */
const PREFIJOS_RESPUESTA = /^((re|rv|fwd|fw)\s*:\s*)+/i

function normalizarAsunto(asunto: string): string {
  return asunto
    .replace(PREFIJOS_RESPUESTA, '')
    .replace(/\s*\|\s*/g, '|')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function esDelCaso(asunto: string, folio: string): boolean {
  if (!asunto?.trim() || !folio.trim()) return false
  return normalizarAsunto(asunto) === normalizarAsunto(componerAsunto(folio))
}

/** Query de Gmail. Las comillas fuerzan la frase exacta y evitan hilos ajenos. */
export function consultaDeBusqueda(folio: string): string {
  return `subject:"${componerAsunto(folio)}"`
}
