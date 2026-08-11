import { describe, expect, it } from 'vitest'
import { esCorreoValido, resolverDestinos } from './destinatarios'

const CASO = { correoSolicitante: 'comercial28@garantiplus.mx' }

describe('resolverDestinos', () => {
  it('el solicitante va en Para', () => {
    expect(resolverDestinos(CASO, null, []).para).toBe('comercial28@garantiplus.mx')
  })

  it('el ejecutivo comercial va en copia solo si difiere del solicitante', () => {
    expect(resolverDestinos(CASO, 'otro@garantiplus.mx', []).cc).toEqual(['otro@garantiplus.mx'])
    expect(resolverDestinos(CASO, 'comercial28@garantiplus.mx', []).cc).toEqual([])
  })

  it('ignora diferencias de mayúsculas y espacios al comparar', () => {
    expect(resolverDestinos(CASO, ' Comercial28@GarantiPlus.MX ', []).cc).toEqual([])
  })

  it('agrega las copias que pidió el usuario', () => {
    const d = resolverDestinos(CASO, null, ['keynor.rivas@gplusseguros.mx'])
    expect(d.cc).toEqual(['keynor.rivas@gplusseguros.mx'])
  })

  it('no repite una copia que ya estaba', () => {
    const d = resolverDestinos(CASO, 'otro@x.mx', ['otro@x.mx', 'otro@x.mx'])
    expect(d.cc).toEqual(['otro@x.mx'])
  })

  it('nunca pone al destinatario principal también en copia', () => {
    const d = resolverDestinos(CASO, null, ['comercial28@garantiplus.mx'])
    expect(d.cc).toEqual([])
  })

  it('descarta copias con formato inválido', () => {
    const d = resolverDestinos(CASO, null, ['no-es-correo', 'bien@x.mx'])
    expect(d.cc).toEqual(['bien@x.mx'])
  })

  it('lanza error si el caso no tiene correo de solicitante', () => {
    expect(() => resolverDestinos({ correoSolicitante: null }, null, [])).toThrow(/no tiene correo/)
  })

  it('lanza error si el correo del solicitante está mal formado', () => {
    expect(() => resolverDestinos({ correoSolicitante: 'sin arroba' }, null, [])).toThrow(
      /no tiene correo/,
    )
  })

  it('conserva el orden: primero el ejecutivo, luego las copias del usuario', () => {
    const d = resolverDestinos(CASO, 'ejecutivo@x.mx', ['extra@x.mx'])
    expect(d.cc).toEqual(['ejecutivo@x.mx', 'extra@x.mx'])
  })
})

describe('esCorreoValido', () => {
  it('acepta correos normales', () => {
    expect(esCorreoValido('elsa.torres@clikautofinance.com')).toBe(true)
    expect(esCorreoValido('comercial28@garantiplus.mx')).toBe(true)
  })

  it('rechaza lo que no lo es', () => {
    expect(esCorreoValido('sin-arroba')).toBe(false)
    expect(esCorreoValido('doble@@x.mx')).toBe(false)
    expect(esCorreoValido('')).toBe(false)
    expect(esCorreoValido('con espacio@x.mx')).toBe(false)
    expect(esCorreoValido('sin-punto@dominio')).toBe(false)
  })

  it('tolera espacios alrededor, que es lo que trae la hoja', () => {
    expect(esCorreoValido(' elsa.torres@clikautofinance.com ')).toBe(true)
  })
})
