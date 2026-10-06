import { describe, expect, it } from 'vitest'
import { casoDePrueba, siniestroDePrueba } from './__fixtures__/caso'
import { horasDeAtencion, tiempoASellar } from './tiempo-atencion'

// casoDePrueba llegó el 5/8/2026 15:14:58.
const LLEGADA = '5/8/2026 15:14:58'

describe('horasDeAtencion', () => {
  it('cuenta horas naturales con dos decimales', () => {
    const a = new Date('2026-08-05T21:14:58Z')
    expect(horasDeAtencion(a, new Date('2026-08-06T23:44:58Z'))).toBe(26.5)
    expect(horasDeAtencion(a, new Date('2026-08-05T21:34:58Z'))).toBe(0.33)
  })

  it('un cierre anterior a la llegada no es un tiempo', () => {
    const a = new Date('2026-08-05T21:14:58Z')
    expect(horasDeAtencion(a, new Date('2026-08-05T20:00:00Z'))).toBeNull()
  })
})

describe('tiempoASellar', () => {
  const caso = casoDePrueba({ marcaTemporalTexto: LLEGADA })

  it('sella al quedar Concluida o Improcedente', () => {
    expect(tiempoASellar(caso, 'Concluida', '6/8/2026 17:44:58')).toBe(26.5)
    expect(tiempoASellar(caso, 'Improcedente', '5/8/2026 16:14:58')).toBe(1)
  })

  it('no sella un caso abierto', () => {
    expect(tiempoASellar(caso, 'Tramite', '6/8/2026 17:44:58')).toBeNull()
    expect(tiempoASellar(caso, '', '6/8/2026 17:44:58')).toBeNull()
    expect(tiempoASellar(caso, null, '6/8/2026 17:44:58')).toBeNull()
  })

  it('no mide siniestros', () => {
    const s = siniestroDePrueba({ marcaTemporalTexto: LLEGADA })
    expect(tiempoASellar(s, 'Concluida', '6/8/2026 17:44:58')).toBeNull()
  })

  it('no sobrescribe un tiempo que ya está en la hoja', () => {
    const conDato = casoDePrueba({ marcaTemporalTexto: LLEGADA, tiempoAtencion: '3' })
    expect(tiempoASellar(conDato, 'Concluida', '6/8/2026 17:44:58')).toBeNull()
  })

  it('sin fecha de cierre usable no hay tiempo', () => {
    expect(tiempoASellar(caso, 'Concluida', null)).toBeNull()
    expect(tiempoASellar(caso, 'Concluida', 'ayer')).toBeNull()
    // Sólo el día: mediría hasta la medianoche y daría un tiempo falso.
    expect(tiempoASellar(caso, 'Concluida', '6/8/2026')).toBeNull()
  })

  it('reconoce el estatus aunque venga con otra capitalización o espacios', () => {
    expect(tiempoASellar(caso, ' concluida ', '6/8/2026 17:44:58')).toBe(26.5)
  })
})
