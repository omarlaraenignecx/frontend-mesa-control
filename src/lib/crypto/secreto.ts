import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITMO = 'aes-256-gcm'
const LARGO_IV = 12
const LARGO_CLAVE = 32

function leerClave(claveBase64: string): Buffer {
  const clave = Buffer.from(claveBase64, 'base64')
  if (clave.length !== LARGO_CLAVE) {
    throw new Error(`La clave de cifrado debe medir 32 bytes; mide ${clave.length}.`)
  }
  return clave
}

export function generarClave(): string {
  return randomBytes(LARGO_CLAVE).toString('base64')
}

/** Devuelve un paquete `iv.tagAuth.cifrado`, cada parte en base64url. */
export function cifrar(textoClaro: string, claveBase64: string): string {
  const iv = randomBytes(LARGO_IV)
  const cipher = createCipheriv(ALGORITMO, leerClave(claveBase64), iv)
  const cifrado = Buffer.concat([cipher.update(textoClaro, 'utf8'), cipher.final()])
  return [
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    cifrado.toString('base64url'),
  ].join('.')
}

export function descifrar(paquete: string, claveBase64: string): string {
  const partes = paquete.split('.')
  if (partes.length !== 3) {
    throw new Error('El paquete cifrado no tiene el formato iv.tag.cifrado.')
  }
  const [iv, tag, cifrado] = partes.map((p) => Buffer.from(p, 'base64url'))
  const decipher = createDecipheriv(ALGORITMO, leerClave(claveBase64), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString('utf8')
}
