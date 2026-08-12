import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La hoja de estilos base no tiene pruebas de render, pero sí una regla que ya
 * se perdió una vez: `shadcn init` reescribió este archivo y se llevó la
 * tipografía sin que nadie lo notara. Estas pruebas leen el CSS y exigen que las
 * dos reglas que la operación nota de inmediato sigan ahí.
 */
const css = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('cursor de los elementos clicables', () => {
  // Tailwind 4 dejó de dar `cursor: pointer` a los botones, así que hay que
  // declararlo. Sin esto, en todo el sitio el cursor es una flecha y la gente
  // duda de si el botón está habilitado.
  const CLICABLES = [
    'button:not(:disabled)',
    '[role="button"]',
    'summary',
    'select:not(:disabled)',
    'input[type="checkbox"]:not(:disabled)',
    'label:has(> input[type="checkbox"])',
    'a[href]',
  ]

  const regla = css.match(/([^{}]+)\{\s*cursor:\s*pointer;?\s*\}/)

  it('existe una regla que pone la mano en el cursor', () => {
    expect(regla).not.toBeNull()
  })

  it.each(CLICABLES)('la regla cubre %s', (selector) => {
    expect(regla?.[1]).toContain(selector)
  })

  it('lo deshabilitado se ve deshabilitado', () => {
    expect(css).toMatch(/:disabled\s*\{\s*cursor:\s*not-allowed/)
  })
})

describe('tipografía', () => {
  it('la fuente base es Geist con nombre literal, no una variable circular', () => {
    // `--font-sans: var(--font-sans)` es una autorreferencia que Tailwind
    // resuelve a nada y el navegador cae en Times New Roman.
    expect(css).toContain('--font-sans: "Geist"')
    expect(css).not.toContain('--font-sans: var(--font-sans)')
  })
})
