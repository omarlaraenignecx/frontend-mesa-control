import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LIMITE_CUERPO_ACCION_BYTES, bytesCrudosQueCabenEnGmail } from './limites'
import { LIMITE_GMAIL_BYTES } from './mime'

const RAIZ = join(import.meta.dirname, '..', '..', '..')

describe('límite del cuerpo de las acciones', () => {
  it('alcanza para cualquier adjunto que Gmail aceptaría', () => {
    // El defecto del 14 de agosto de 2026: la interfaz solo revisaba el tope de
    // Gmail (25 MB ya codificados) mientras la acción cortaba en 1 MB, así que
    // adjuntar un PDF normal rompía la página entera con un 413.
    expect(LIMITE_CUERPO_ACCION_BYTES).toBeGreaterThanOrEqual(bytesCrudosQueCabenEnGmail())
  })

  it('deja margen para el texto y el armado multiparte del formulario', () => {
    expect(LIMITE_CUERPO_ACCION_BYTES).toBeGreaterThan(bytesCrudosQueCabenEnGmail() * 1.05)
  })

  it('bytesCrudosQueCabenEnGmail deshace el inflado de base64', () => {
    // base64 crece un tercio: lo que quepa crudo es tres cuartas partes del tope.
    expect(bytesCrudosQueCabenEnGmail()).toBe(Math.floor((LIMITE_GMAIL_BYTES * 3) / 4))
  })
})

describe('next.config.ts', () => {
  const CONFIG = readFileSync(join(RAIZ, 'next.config.ts'), 'utf8')

  it('configura el tope del cuerpo de las Server Actions', () => {
    expect(CONFIG).toContain('bodySizeLimit')
  })

  it('lo toma de la constante y no de un número escrito a mano', () => {
    // Dos límites en dos archivos distintos es justo lo que produjo el defecto.
    expect(CONFIG).toContain('LIMITE_CUERPO_ACCION_BYTES')
  })
})
