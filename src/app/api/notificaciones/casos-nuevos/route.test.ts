import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FUENTE = readFileSync(join(import.meta.dirname, 'route.ts'), 'utf8')

describe('ruta de casos nuevos', () => {
  it('exige el secreto antes de hacer cualquier otra cosa', () => {
    const secreto = FUENTE.indexOf('secretoValido')
    const lectura = FUENTE.indexOf('leerCasos(')
    expect(secreto).toBeGreaterThan(-1)
    expect(secreto).toBeLessThan(lectura)
  })

  it('responde 401 sin secreto válido', () => {
    expect(FUENTE).toContain('status: 401')
  })

  it('no usa la lectura cacheada: el aviso tiene que ver la hoja de ahora', () => {
    expect(FUENTE).toContain('leerCasos(')
    expect(FUENTE).not.toContain('cargarCola')
  })

  it('genera los folios antes de crear los avisos', () => {
    // Cuando el navegador refresque la tabla, el folio ya tiene que estar escrito.
    expect(FUENTE.indexOf('generarFoliosPendientes')).toBeLessThan(
      FUENTE.indexOf('guardarNotificaciones'),
    )
  })

  it('atribuye el folio automático en la bitácora, no a una persona', () => {
    expect(FUENTE).toContain("'n8n:casos-nuevos'")
  })

  it('siembra la marca en silencio en la primera corrida', () => {
    expect(FUENTE).toContain('arranque')
  })

  it('invalida la caché de la fila con expiración inmediata', () => {
    // El perfil 'max' serviría el dato rancio en la siguiente visita, que es
    // justo lo que no queremos aquí. `updateTag` no se puede usar en una ruta.
    expect(FUENTE).toContain("revalidateTag('casos', { expire: 0 })")
  })
})
