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
  it('el filtro de hoja vive en un solo lugar', () => {
    // Una sola base sirve a la copia y a la hoja real. Repetido en cada consulta,
    // basta olvidarlo una vez para que un aviso de desarrollo aparezca en un caso
    // de producción con el mismo número de fila.
    expect((FUENTE.match(/schema\.notificaciones\.sheetId/g) ?? []).length).toBe(1)
  })

  it('todas las lecturas pasan por ese filtro', () => {
    const lecturas = (FUENTE.match(/\.from\(schema\.notificaciones\)/g) ?? []).length
    // Las líneas de declaración no cuentan como uso.
    const usos = FUENTE.split('\n')
      .filter((l) => !/^(const|function|export)/.test(l.trim()))
      .join('\n')
      .match(/filtroDeHoja\w*\(/g) ?? []
    expect(lecturas).toBeGreaterThan(0)
    expect(usos.length).toBeGreaterThanOrEqual(lecturas)
  })

  it('el sondeo del navegador acota además por módulo', () => {
    // La campanita de la mesa no timbra por un siniestro, ni la del ramo por las
    // ~1,400 peticiones al año de la mesa.
    expect(FUENTE).toContain('filtroDeHojaYModulo(modulo)')
    expect(FUENTE).toContain('eq(schema.notificaciones.modulo, modulo)')
  })

  it('abrir un caso lee sus avisos sin importar el módulo', () => {
    // Quien abre el caso lo está viendo entero; partir eso dejaría avisos colgados.
    const marcarDeFila = FUENTE.slice(FUENTE.indexOf('export async function marcarLeidasDeFila'))
    expect(marcarDeFila).toContain('filtroDeHoja()')
    expect(marcarDeFila).not.toContain('filtroDeHojaYModulo')
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
