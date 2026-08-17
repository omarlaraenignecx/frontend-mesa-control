import { describe, expect, it } from 'vitest'
import { claveDeCasoNuevo, claveDeCorreo } from './claves'

const COPIA = '1rimFXIxaM4HrBHC9YQfwYfkh0l-RBJdbe7SLM0CGxEQ'
const REAL = '1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0'

describe('claves de idempotencia', () => {
  it('la misma fila de la misma hoja produce la misma clave', () => {
    expect(claveDeCasoNuevo(COPIA, 7231)).toBe(claveDeCasoNuevo(COPIA, 7231))
  })

  it('la misma fila en hojas distintas son avisos distintos', () => {
    // La base es la misma para la copia y la hoja real: sin la hoja en la clave,
    // el aviso de desarrollo bloquearía el de producción.
    expect(claveDeCasoNuevo(COPIA, 7231)).not.toBe(claveDeCasoNuevo(REAL, 7231))
  })

  it('el mismo mensaje de Gmail en hojas distintas son avisos distintos', () => {
    expect(claveDeCorreo(COPIA, '18f2a')).not.toBe(claveDeCorreo(REAL, '18f2a'))
  })

  it('un caso nuevo y un correo nunca colisionan', () => {
    expect(claveDeCasoNuevo(COPIA, 7231)).not.toBe(claveDeCorreo(COPIA, '7231'))
  })
})
