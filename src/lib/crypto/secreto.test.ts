import { describe, expect, it } from 'vitest'
import { cifrar, descifrar, generarClave } from './secreto'

const CLAVE = generarClave()

describe('cifrado del refresh token', () => {
  it('descifra lo que cifró', () => {
    const secreto = '1//0gRefreshTokenDeGoogleConCaracteres-_'
    expect(descifrar(cifrar(secreto, CLAVE), CLAVE)).toBe(secreto)
  })

  it('produce un paquete distinto cada vez para el mismo texto', () => {
    const a = cifrar('mismo-secreto', CLAVE)
    const b = cifrar('mismo-secreto', CLAVE)
    expect(a).not.toBe(b)
    expect(descifrar(a, CLAVE)).toBe(descifrar(b, CLAVE))
  })

  it('el paquete no contiene el texto claro', () => {
    expect(cifrar('token-secreto', CLAVE)).not.toContain('token-secreto')
  })

  it('falla al descifrar con una clave distinta', () => {
    const paquete = cifrar('secreto', CLAVE)
    expect(() => descifrar(paquete, generarClave())).toThrow()
  })

  it('falla si el paquete fue alterado, porque la autenticación no cuadra', () => {
    const paquete = cifrar('secreto', CLAVE)
    const partes = paquete.split('.')
    const alterado = [partes[0], partes[1], Buffer.from('otracosa').toString('base64url')].join('.')
    expect(() => descifrar(alterado, CLAVE)).toThrow()
  })

  it('rechaza una clave que no mide 32 bytes', () => {
    expect(() => cifrar('secreto', Buffer.from('corta').toString('base64'))).toThrow(/32 bytes/)
  })

  it('rechaza un paquete con formato inválido', () => {
    expect(() => descifrar('no-es-un-paquete', CLAVE)).toThrow(/formato/)
  })
})
