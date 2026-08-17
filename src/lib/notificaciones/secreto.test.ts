import { describe, expect, it } from 'vitest'
import { secretoValido } from './secreto'

const S = 'un-secreto-largo-de-verdad'

describe('secretoValido', () => {
  it('acepta el valor exacto con el prefijo Bearer', () => {
    expect(secretoValido(`Bearer ${S}`, S)).toBe(true)
  })

  it('acepta el valor sin prefijo, por si el flujo lo manda pelón', () => {
    expect(secretoValido(S, S)).toBe(true)
  })

  it('rechaza otro valor', () => {
    expect(secretoValido('Bearer otra-cosa', S)).toBe(false)
  })

  it('rechaza la cabecera ausente', () => {
    expect(secretoValido(null, S)).toBe(false)
  })

  it('rechaza todo si el servidor no tiene secreto configurado', () => {
    // Sin variable de entorno la ruta queda cerrada, no abierta.
    expect(secretoValido(`Bearer ${S}`, undefined)).toBe(false)
    expect(secretoValido(`Bearer ${S}`, '')).toBe(false)
  })

  it('rechaza un valor de otra longitud sin comparar byte por byte', () => {
    expect(secretoValido('Bearer corto', S)).toBe(false)
  })
})
