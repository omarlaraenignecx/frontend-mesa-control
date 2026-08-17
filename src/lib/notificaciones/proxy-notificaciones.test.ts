import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Las dos rutas que despierta n8n no llevan sesión —quien llama es una máquina—,
 * así que el proxy las tiene que dejar pasar. El riesgo de esa excepción es que se
 * escriba con `startsWith` y arrastre consigo el sondeo del navegador, que sí
 * devuelve datos de casos y sí necesita sesión. Esto lo vigila.
 */
const PROXY = readFileSync(join(import.meta.dirname, '..', '..', 'proxy.ts'), 'utf8')

/** Las rutas exentas, tomadas del propio proxy: la prueba sigue la lista real. */
const EXENTAS = [...(PROXY.match(/const CON_SECRETO = \[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
  (m) => m[1],
)

describe('excepciones del proxy', () => {
  it('deja pasar la ruta que despierta n8n', () => {
    expect(EXENTAS).toContain('/api/notificaciones/casos-nuevos')
  })

  it('la excepción es por ruta exacta, no por prefijo', () => {
    expect(PROXY).toContain('CON_SECRETO.includes(ruta)')
    expect(PROXY).not.toMatch(/CON_SECRETO\.some\([^)]*startsWith/)
  })

  it('el sondeo del navegador no está exento: necesita sesión', () => {
    expect(EXENTAS).not.toContain('/api/notificaciones')
  })

  it('toda ruta exenta compara el secreto y responde 401 sin él', () => {
    expect(EXENTAS.length).toBeGreaterThan(0)
    for (const ruta of EXENTAS) {
      const fuente = readFileSync(
        join(import.meta.dirname, '..', '..', 'app', ...ruta.split('/').filter(Boolean), 'route.ts'),
        'utf8',
      )
      expect(fuente, ruta).toContain('secretoValido')
      expect(fuente, ruta).toContain('status: 401')
    }
  })
})
