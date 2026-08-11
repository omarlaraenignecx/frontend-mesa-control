const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  Ntilde: 'Ñ',
}

function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (todo, nombre: string) => ENTIDADES[nombre] ?? todo)
}

/**
 * El chat muestra lo que la persona escribió, no el HTML con el que viajó.
 *
 * El resultado se renderiza siempre como texto, nunca se inserta como HTML, así
 * que esta función no es una capa de saneamiento: es una conversión a texto.
 */
export function htmlATexto(html: string): string {
  if (!html) return ''
  return decodificarEntidades(
    html
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\/td>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Marcas con las que los clientes de correo abren el bloque citado. Se exige
 * que la línea termine en dos puntos o sea un separador, para no cortar un
 * mensaje que solo menciona la palabra "escribió".
 */
const CORTES = [
  /^\s*El\b.*\bescribió:\s*$/im,
  /^\s*On\b.*\bwrote:\s*$/im,
  /^-{2,}\s*Mensaje reenviado\s*-{2,}/im,
  /^-{2,}\s*Forwarded message\s*-{2,}/im,
  /^\s*--\s*$/m,
  /^\s*De:\s.+$/im,
]

/** Deja solo lo que la persona escribió en este mensaje. */
export function quitarCitas(texto: string): string {
  let resultado = texto

  for (const corte of CORTES) {
    const m = resultado.match(corte)
    if (m?.index !== undefined) resultado = resultado.slice(0, m.index)
  }

  return resultado
    .split('\n')
    .filter((linea) => !linea.trimStart().startsWith('>'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function limpiarCuerpo(contenido: { html?: string; texto?: string }): string {
  const base = contenido.texto?.trim() ? contenido.texto : htmlATexto(contenido.html ?? '')
  return quitarCitas(base)
}
