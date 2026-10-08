import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Vercel corre en UTC y la mesa en UTC−6: cualquier hora formateada con la zona
 * del proceso sale seis horas adelantada. Ya pasó con la bitácora (8/10/2026).
 * Toda hora para la mesa pasa por `lib/reloj.ts` o `lib/fecha.ts`.
 */
const PROHIBIDO = /\.(toLocaleString|toLocaleTimeString|getHours|getMinutes|getDate|getMonth|getFullYear)\(/

// Excepciones con su razón. Agregar aquí sólo con una razón igual de concreta.
const PERMITIDOS = new Set<string>([
  // Componente cliente que sólo muestra el día de la última edición de una plantilla:
  // usa `toLocaleDateString`, que el patrón no atrapa, y se deja anotado por si cambia.
  'src/app/ajustes/plantillas.tsx',
])

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return n === '__fixtures__' ? [] : archivos(p)
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : []
  })
}

describe('formateo de horas', () => {
  it('nadie formatea con la zona del servidor', () => {
    const raiz = process.cwd()
    const culpables = archivos(join(raiz, 'src'))
      .map((p) => relative(raiz, p))
      .filter((p) => !PERMITIDOS.has(p))
      .filter((p) => PROHIBIDO.test(readFileSync(p, 'utf8')))
    expect(culpables).toEqual([])
  })
})
