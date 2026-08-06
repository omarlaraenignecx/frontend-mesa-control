import { describe, expect, it } from 'vitest'
import { formatearFechaHoja } from './fecha'

describe('formatearFechaHoja', () => {
  it('usa el formato D/M/YYYY H:mm:ss de la hoja', () => {
    const d = new Date(2026, 7, 5, 15, 14, 58) // 5 de agosto de 2026
    expect(formatearFechaHoja(d)).toBe('5/8/2026 15:14:58')
  })

  it('no rellena con ceros el día ni el mes', () => {
    const d = new Date(2026, 0, 9, 9, 5, 3)
    expect(formatearFechaHoja(d)).toBe('9/1/2026 9:05:03')
  })
})
