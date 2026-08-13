import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

function fuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const ruta = join(dir, entrada)
    if (statSync(ruta).isDirectory()) return fuentes(ruta)
    const esFuente = ruta.endsWith('.ts') || ruta.endsWith('.tsx')
    return esFuente && !ruta.includes('.test.') ? [ruta] : []
  })
}

const ARCHIVOS = fuentes(SRC).map((ruta) => ({
  ruta: ruta.replace(`${process.cwd()}/`, ''),
  texto: readFileSync(ruta, 'utf8'),
}))

describe('la bandeja de casos vive en /fila', () => {
  // El área pidió que nada en la herramienta dijera "cola". La ruta también,
  // porque se ve en la barra de direcciones.
  it('ningún archivo apunta a /cola', () => {
    const culpables = ARCHIVOS.filter((a) => /['"`]\/cola\b/.test(a.texto)).map((a) => a.ruta)
    expect(culpables).toEqual([])
  })

  it('next.config.ts redirige /cola a /fila, para no romper enlaces guardados', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
    expect(config).toContain("source: '/cola'")
    expect(config).toContain("destination: '/fila'")
    expect(config).toContain('permanent: true')
  })
})
