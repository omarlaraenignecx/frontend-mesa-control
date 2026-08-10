import { describe, expect, it } from 'vitest'
import { fechaDeCierreASellar, seCierraAhora } from './cierre'

const CUANDO = new Date(2026, 7, 10, 16, 45, 30)

describe('seCierraAhora', () => {
  it('detecta el cierre cuando un caso abierto pasa a Concluida', () => {
    expect(seCierraAhora({ estatusFinal: 'Tramite' }, 'Concluida')).toBe(true)
  })

  it('detecta el cierre cuando pasa a Improcedente', () => {
    expect(seCierraAhora({ estatusFinal: null }, 'Improcedente')).toBe(true)
  })

  it('no es cierre si el caso ya estaba cerrado', () => {
    expect(seCierraAhora({ estatusFinal: 'Concluida' }, 'Concluida')).toBe(false)
    expect(seCierraAhora({ estatusFinal: 'Improcedente' }, 'Concluida')).toBe(false)
  })

  it('no es cierre si el estatus nuevo no es terminal', () => {
    expect(seCierraAhora({ estatusFinal: 'Tramite' }, 'Tramite')).toBe(false)
    expect(seCierraAhora({ estatusFinal: null }, '')).toBe(false)
  })

  it('no es cierre si no se propone estatus final', () => {
    expect(seCierraAhora({ estatusFinal: 'Tramite' }, undefined)).toBe(false)
  })
})

describe('fechaDeCierreASellar', () => {
  it('sella la fecha cuando el caso se cierra y no tenía fecha de atención final', () => {
    expect(
      fechaDeCierreASellar({ estatusFinal: 'Tramite', fechaAtencionFinal: null }, 'Concluida', CUANDO),
    ).toBe('10/8/2026 16:45:30')
  })

  it('respeta la fecha que ya estaba capturada a mano', () => {
    expect(
      fechaDeCierreASellar(
        { estatusFinal: 'Tramite', fechaAtencionFinal: '1/8/2026 10:00:00' },
        'Concluida',
        CUANDO,
      ),
    ).toBeNull()
  })

  it('no sella nada si el caso no se está cerrando', () => {
    expect(
      fechaDeCierreASellar({ estatusFinal: 'Tramite', fechaAtencionFinal: null }, 'Tramite', CUANDO),
    ).toBeNull()
  })

  it('no sella nada si el caso ya estaba cerrado', () => {
    expect(
      fechaDeCierreASellar(
        { estatusFinal: 'Concluida', fechaAtencionFinal: null },
        'Concluida',
        CUANDO,
      ),
    ).toBeNull()
  })
})
