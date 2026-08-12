import { describe, expect, it } from 'vitest'
import {
  PREFIJO_ASUNTO,
  asuntoDeReenvio,
  componerAsunto,
  consultaDeBusqueda,
  esDelCaso,
} from './asunto'

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

describe('asuntoDeReenvio', () => {
  it('nombra el caso al que pertenece la conversación', () => {
    expect(asuntoDeReenvio('7000')).toContain('7000')
  })

  it('no contiene la frase con la que se rastrea el hilo del caso', () => {
    // consultaDeBusqueda() busca esa frase como subcadena en Gmail. Si el
    // reenvío la llevara, el hilo del reenvío podría aparecer como el hilo del
    // caso el día que se pierda el vínculo guardado en la base.
    expect(asuntoDeReenvio('7000')).not.toContain(PREFIJO_ASUNTO)
  })

  it('un reenvío no se confunde con un mensaje del caso', () => {
    expect(esDelCaso(asuntoDeReenvio('7000'), '7000')).toBe(false)
  })
})
