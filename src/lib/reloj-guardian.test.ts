import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Vercel corre en UTC y la mesa en UTC−6: cualquier hora formateada con la zona
 * del proceso sale seis horas adelantada. Ya pasó con la bitácora (8/10/2026).
 * Toda hora para la mesa pasa por `lib/reloj.ts` o `lib/fecha.ts`.
 */
// También atrapa `n.toLocaleString()` sobre números: para montos o cantidades, formatear
// a mano o con una función de `lib/`, no exentar el archivo entero.
const PROHIBIDO =
  /\.(toLocale(Date|Time)?String|toDateString|toTimeString|get(Hours|Minutes|Seconds|Date|Day|Month|FullYear))\(|Intl\.DateTimeFormat|new Date\(\s*\d{4}\s*,/

// Excepciones con su razón. Agregar aquí sólo con una razón concreta: «es componente
// cliente» no basta, porque también se prerenderiza en el servidor.
const PERMITIDOS = new Set<string>([])

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return n === '__fixtures__' ? [] : archivos(p)
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : []
  })
}

describe('formateo de horas', () => {
  it('nadie formatea con la zona del servidor', () => {
    const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
    const culpables = archivos(join(raiz, 'src'))
      .map((p) => relative(raiz, p))
      .filter((p) => !PERMITIDOS.has(p))
      .filter((p) => PROHIBIDO.test(readFileSync(p, 'utf8')))
    expect(culpables).toEqual([])
  })
})
