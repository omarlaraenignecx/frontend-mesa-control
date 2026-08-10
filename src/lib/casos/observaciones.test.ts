import { describe, expect, it } from 'vitest'
import { componerObservaciones } from './observaciones'

const CUANDO = new Date(2026, 7, 10, 14, 30, 0)

describe('componerObservaciones', () => {
  it('antepone la nota nueva con fecha y autor', () => {
    const r = componerObservaciones(null, 'Se solicitó la factura', 'Keynor', CUANDO)
    expect(r).toBe('10/8/2026 14:30:00 Keynor: Se solicitó la factura')
  })

  it('conserva íntegro lo que ya había escrito alguien', () => {
    const existente = 'SE ENVIAN DATOS DE APLICACION DE PAGO Y FACTURA A PATY.'
    const r = componerObservaciones(existente, 'Se cerró el caso', 'Paty', CUANDO)
    expect(r.startsWith('10/8/2026 14:30:00 Paty: Se cerró el caso')).toBe(true)
    expect(r).toContain(existente)
  })

  it('separa las entradas con un salto de línea', () => {
    const r = componerObservaciones('anterior', 'nueva', 'Keynor', CUANDO)
    expect(r.split('\n')).toHaveLength(2)
  })

  it('acumula varias entradas manteniendo la más reciente arriba', () => {
    const uno = componerObservaciones(null, 'primera', 'Keynor', new Date(2026, 7, 9, 9, 0, 0))
    const dos = componerObservaciones(uno, 'segunda', 'Paty', CUANDO)
    const lineas = dos.split('\n')
    expect(lineas[0]).toContain('segunda')
    expect(lineas[1]).toContain('primera')
  })

  it('devuelve lo existente sin tocar si la nota viene vacía', () => {
    expect(componerObservaciones('anterior', '   ', 'Keynor', CUANDO)).toBe('anterior')
    expect(componerObservaciones(null, '', 'Keynor', CUANDO)).toBe('')
  })

  it('recorta espacios de la nota pero respeta sus saltos internos', () => {
    const r = componerObservaciones(null, '  línea uno\nlínea dos  ', 'Keynor', CUANDO)
    expect(r).toBe('10/8/2026 14:30:00 Keynor: línea uno\nlínea dos')
  })

  it('usa el correo cuando el usuario no tiene nombre en la hoja', () => {
    const r = componerObservaciones(null, 'nota', 'mesadecontrol@gplusseguros.mx', CUANDO)
    expect(r).toContain('mesadecontrol@gplusseguros.mx:')
  })
})
