import { normalizarEncabezado } from '@/lib/google/sheet-schema'

/**
 * El formulario repite cada pregunta en 4 o 5 columnas según la rama que
 * respondió el solicitante. Sin agrupar, la vista del caso mostraría "Número de
 * póliza" cuatro veces con el mismo valor.
 *
 * Cuando dos columnas del mismo grupo traen datos distintos se muestran ambos,
 * porque descartar uno sería perder información del solicitante.
 */
export function agruparCamposExtra(
  campos: { etiqueta: string; valor: string }[],
): { etiqueta: string; valor: string }[] {
  const grupos = new Map<string, { etiqueta: string; valores: string[] }>()

  for (const { etiqueta, valor } of campos) {
    const limpio = valor?.trim()
    if (!limpio || !etiqueta?.trim()) continue
    const clave = normalizarEncabezado(etiqueta)
    if (!clave) continue
    const grupo = grupos.get(clave)
    if (!grupo) {
      grupos.set(clave, { etiqueta: etiqueta.trim(), valores: [limpio] })
    } else if (!grupo.valores.includes(limpio)) {
      grupo.valores.push(limpio)
    }
  }

  return [...grupos.values()].map(({ etiqueta, valores }) => ({
    etiqueta,
    valor: valores.join(' · '),
  }))
}
