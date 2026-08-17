import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La suite corre sin base de datos, así que aquí se cuidan las invariantes que un
 * error de SQL no gritaría: que ninguna consulta se olvide de la hoja y que lo
 * leído sea por persona. El comportamiento contra Postgres se verificó a mano con
 * un script, como pide el plan.
 */
const FUENTE = readFileSync(join(import.meta.dirname, 'almacen.ts'), 'utf8')

describe('almacén de notificaciones', () => {
  it('todas las lecturas filtran por hoja', () => {
    // Una sola base sirve a la copia y a la hoja real. Sin el filtro, un aviso de
    // desarrollo aparece en un caso de producción con el mismo número de fila.
    const lecturas = FUENTE.match(/\.from\(schema\.notificaciones\)/g) ?? []
    const filtros = FUENTE.match(/eq\(schema\.notificaciones\.sheetId, hoja\)/g) ?? []
    expect(lecturas.length).toBeGreaterThan(0)
    expect(filtros.length).toBeGreaterThanOrEqual(lecturas.length)
  })

  it('la inserción descarta los repetidos por clave', () => {
    expect(FUENTE).toContain('onConflictDoNothing')
    expect(FUENTE).toContain('target: schema.notificaciones.clave')
  })

  it('marca lo leído por usuario, nunca para todos', () => {
    expect(FUENTE).toContain('correoUsuario')
    // Un booleano en `notificaciones` le quitaría el pendiente a los demás.
    expect(FUENTE).not.toMatch(/\.update\(schema\.notificaciones\)/)
  })

  it('la hoja sale del entorno y falla claro si no está', () => {
    expect(FUENTE).toContain('process.env.SHEET_ID')
    expect(FUENTE).toMatch(/throw new Error\(/)
  })
})
