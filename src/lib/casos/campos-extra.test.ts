import { describe, expect, it } from 'vitest'
import { agruparCamposExtra } from './campos-extra'

describe('agruparCamposExtra', () => {
  it('colapsa el mismo encabezado repetido en varias columnas del formulario', () => {
    // "Número de póliza" existe en 4 columnas por los bloques replicados.
    const r = agruparCamposExtra([
      { etiqueta: 'Número de póliza', valor: 'L1146000273' },
      { etiqueta: 'Número de póliza', valor: 'L1146000273' },
    ])
    expect(r).toEqual([{ etiqueta: 'Número de póliza', valor: 'L1146000273' }])
  })

  it('conserva ambos valores cuando el mismo encabezado trae datos distintos', () => {
    const r = agruparCamposExtra([
      { etiqueta: 'Número de póliza', valor: 'AAA' },
      { etiqueta: 'Número de póliza', valor: 'BBB' },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].valor).toContain('AAA')
    expect(r[0].valor).toContain('BBB')
  })

  it('agrupa ignorando acentos, mayúsculas y signos, como el mapeador', () => {
    const r = agruparCamposExtra([
      { etiqueta: '¿Tipo de endoso?', valor: 'Cambio de conductor' },
      { etiqueta: 'Tipo de endoso:', valor: 'Cambio de conductor' },
    ])
    expect(r).toHaveLength(1)
  })

  it('usa la primera etiqueta como la visible', () => {
    const r = agruparCamposExtra([
      { etiqueta: 'Teléfono del cliente', valor: '5512345678' },
      { etiqueta: 'teléfono del cliente', valor: '5512345678' },
    ])
    expect(r[0].etiqueta).toBe('Teléfono del cliente')
  })

  it('descarta los campos sin valor', () => {
    expect(agruparCamposExtra([{ etiqueta: 'Portal', valor: '   ' }])).toEqual([])
  })

  it('descarta los campos sin etiqueta', () => {
    expect(agruparCamposExtra([{ etiqueta: '  ', valor: 'algo' }])).toEqual([])
  })

  it('conserva el orden de aparición', () => {
    const r = agruparCamposExtra([
      { etiqueta: 'Número de siniestro', valor: 'S1' },
      { etiqueta: 'Portal', valor: 'Qualitas' },
    ])
    expect(r.map((x) => x.etiqueta)).toEqual(['Número de siniestro', 'Portal'])
  })
})
