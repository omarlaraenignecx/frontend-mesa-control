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

describe('la navegación interna es de cliente', () => {
  // Un <a href="/…"> recarga el documento completo: vuelve a pedir el HTML,
  // revalida la sesión y rerenderiza todo. Era la causa de la lentitud que
  // reportó el área el 13/8/2026, y además impide cualquier indicador de carga,
  // porque durante la recarga la página anterior queda congelada.
  const ANCLA_INTERNA = /<a[\s\S]{0,200}?href=["'`]\/(?!api\/)/

  it('ninguna página navega dentro de la app con <a>', () => {
    const culpables = ARCHIVOS.filter(
      (a) => a.ruta.startsWith('src/app/') && ANCLA_INTERNA.test(a.texto),
    ).map((a) => a.ruta)
    expect(culpables).toEqual([])
  })

  it('las rutas de API sí se visitan con <a>, porque redirigen fuera de la app', () => {
    // /api/mesa/autorizar manda a la pantalla de consentimiento de Google: un
    // Link de cliente no puede seguir esa redirección.
    const ajustes = ARCHIVOS.find((a) => a.ruta === 'src/app/ajustes/page.tsx')!
    expect(ajustes.texto).toContain('href="/api/mesa/autorizar"')
  })
})

describe('cada vista lenta tiene su pantalla de carga', () => {
  // Son las dos navegaciones que cambian de ruta y leen la hoja de cálculo.
  it('la fila y el caso declaran loading.tsx', () => {
    const rutas = ARCHIVOS.map((a) => a.ruta)
    expect(rutas).toContain('src/app/fila/loading.tsx')
    expect(rutas).toContain('src/app/caso/[fila]/loading.tsx')
  })

  it('el indicador de clic vive dentro de un Link y es de cliente', () => {
    const punto = ARCHIVOS.find((a) => a.ruta === 'src/components/punto-de-carga.tsx')!
    expect(punto.texto).toContain("'use client'")
    expect(punto.texto).toContain('useLinkStatus')
  })
})
