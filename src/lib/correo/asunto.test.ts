import { describe, expect, it } from 'vitest'
import { PREFIJO_ASUNTO, componerAsunto, consultaDeBusqueda, esDelCaso } from './asunto'

describe('componerAsunto', () => {
  it('usa el formato acordado con el folio al final', () => {
    expect(componerAsunto('7000')).toBe('Seguimiento de Caso | Gplus Seguros | 7000')
  })

  it('el prefijo está en un solo lugar', () => {
    expect(componerAsunto('7000').startsWith(PREFIJO_ASUNTO)).toBe(true)
  })

  it('recorta espacios del folio', () => {
    expect(componerAsunto('  7000 ')).toBe('Seguimiento de Caso | Gplus Seguros | 7000')
  })
})

describe('esDelCaso', () => {
  it('reconoce el asunto exacto', () => {
    expect(esDelCaso('Seguimiento de Caso | Gplus Seguros | 7000', '7000')).toBe(true)
  })

  it('reconoce las respuestas con Re: que agrega el cliente de correo', () => {
    expect(esDelCaso('Re: Seguimiento de Caso | Gplus Seguros | 7000', '7000')).toBe(true)
    expect(esDelCaso('RE: RE: Seguimiento de Caso | Gplus Seguros | 7000', '7000')).toBe(true)
    expect(esDelCaso('Fwd: Seguimiento de Caso | Gplus Seguros | 7000', '7000')).toBe(true)
  })

  it('no confunde el folio 700 con el 7000', () => {
    expect(esDelCaso('Seguimiento de Caso | Gplus Seguros | 7000', '700')).toBe(false)
    expect(esDelCaso('Seguimiento de Caso | Gplus Seguros | 700', '7000')).toBe(false)
  })

  it('rechaza un asunto ajeno aunque mencione el folio', () => {
    expect(esDelCaso('Consulta sobre el caso 7000', '7000')).toBe(false)
  })

  it('tolera diferencias de espacios alrededor de las barras', () => {
    expect(esDelCaso('Seguimiento de Caso|Gplus Seguros|7000', '7000')).toBe(true)
  })

  it('rechaza cuando falta el asunto o el folio', () => {
    expect(esDelCaso('', '7000')).toBe(false)
    expect(esDelCaso('Seguimiento de Caso | Gplus Seguros | 7000', '')).toBe(false)
  })
})

describe('consultaDeBusqueda', () => {
  it('busca el asunto exacto entre comillas, para no traer hilos ajenos', () => {
    const q = consultaDeBusqueda('7000')
    expect(q).toContain('subject:')
    expect(q).toContain('"Seguimiento de Caso | Gplus Seguros | 7000"')
  })
})
