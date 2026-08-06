export type Adjunto = { etiqueta: string; url: string; fileId: string | null }

const DOMINIOS = ['drive.google.com', 'docs.google.com']

export function esUrlDrive(texto: string): boolean {
  if (!texto) return false
  return DOMINIOS.some((d) => texto.includes(d)) && /^https?:\/\//.test(texto.trim())
}

function fileIdDe(url: string): string | null {
  const porQuery = url.match(/[?&]id=([^&\s]+)/)
  if (porQuery) return porQuery[1]
  const porRuta = url.match(/\/d\/([^/?\s]+)/)
  if (porRuta) return porRuta[1]
  return null
}

/**
 * Una celda de adjuntos puede traer varias URLs cuando el solicitante sube
 * más de un archivo. El formulario las separa con coma y espacio.
 */
export function extraerAdjuntos(etiqueta: string, celda: string): Adjunto[] {
  if (!celda?.trim()) return []
  return celda
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => esUrlDrive(t))
    .map((url) => ({ etiqueta, url, fileId: fileIdDe(url) }))
}
