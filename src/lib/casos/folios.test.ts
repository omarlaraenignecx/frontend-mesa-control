import { describe, expect, it } from 'vitest'
import { asignarFolios, siguienteFolio } from './folios'

describe('siguienteFolio', () => {
  it('continúa desde el folio más alto, no desde el último de la columna', () => {
    // Caso real de la hoja: las filas pre-arrastradas dejan 7052-7054 al final,
    // y arriba puede haber folios mayores del histórico. Seguir "el de abajo"
    // repetiría un número que ya existe.
    expect(siguienteFolio(['7051', '7052', '7053', '7054'])).toBe(7055)
    expect(siguienteFolio(['7060', '7051', '7052'])).toBe(7061)
  })

  it('ignora celdas vacías y valores que no son número', () => {
    expect(siguienteFolio(['', '  ', '7051', 'N/A', 'pendiente'])).toBe(7052)
  })

  it('sin ningún folio numérico no inventa una serie', () => {
    // Devolver 1 sería peor que no hacer nada: significaría que la columna no es
    // la que creemos y hay que mirar la hoja antes de escribir.
    expect(siguienteFolio([])).toBeNull()
    expect(siguienteFolio(['', 'N/A'])).toBeNull()
  })
})

describe('asignarFolios', () => {
  it('reparte consecutivos en orden de fila ascendente', () => {
    expect(asignarFolios([7230, 7228, 7229], ['7051', '7054'])).toEqual([
      { fila: 7228, folio: '7055' },
      { fila: 7229, folio: '7056' },
      { fila: 7230, folio: '7057' },
    ])
  })

  it('sin filas pendientes no devuelve nada', () => {
    expect(asignarFolios([], ['7054'])).toEqual([])
  })

  it('sin serie de la que partir no asigna nada', () => {
    expect(asignarFolios([7228], [])).toEqual([])
  })
})
