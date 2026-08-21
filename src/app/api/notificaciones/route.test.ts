import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SONDEO = readFileSync(join(import.meta.dirname, 'route.ts'), 'utf8')
const LEIDAS = readFileSync(join(import.meta.dirname, 'leidas', 'route.ts'), 'utf8')

describe('sondeo del navegador', () => {
  it('exige sesión', () => {
    expect(SONDEO).toContain('requerirUsuario')
  })

  it('nunca se cachea: su gracia es traer lo de ahora', () => {
    expect(SONDEO).toContain("export const dynamic = 'force-dynamic'")
  })

  it('devuelve lo del usuario de la sesión, no de un correo recibido por parámetro', () => {
    expect(SONDEO).toContain('usuario.correo')
    expect(SONDEO).not.toMatch(/\.get\('correo'\)/)
  })

  it('el módulo sí viene de la URL, y se valida', () => {
    // No es un permiso: cualquier usuario autorizado entra a los dos módulos. Es
    // qué pantalla pregunta, y sirve para no timbrar por lo que no le toca.
    expect(SONDEO).toContain("searchParams.get('modulo')")
    expect(SONDEO).toContain('moduloValido(')
  })
})

describe('marcar leídas', () => {
  it('exige sesión y usa el correo de la sesión', () => {
    expect(LEIDAS).toContain('requerirUsuario')
    expect(LEIDAS).toContain('usuario.correo')
  })

  it('nunca acepta el correo desde el cuerpo de la petición', () => {
    // Aceptarlo dejaría marcar como leídos los pendientes de otra persona.
    expect(LEIDAS).not.toMatch(/cuerpo\.correo|body\.correo|datos\.correo/)
  })

  it('descarta lo que no sea un entero antes de escribir en la base', () => {
    expect(LEIDAS).toContain('Number.isInteger')
  })

  it('responde 400 a un cuerpo ilegible en lugar de reventar', () => {
    expect(LEIDAS).toContain('status: 400')
  })
})
