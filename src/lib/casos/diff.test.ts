import { describe, expect, it } from 'vitest'
import type { Caso } from './caso'
import { ETIQUETAS_SEGUIMIENTO, calcularDiff } from './seguimiento'

function caso(parcial: Partial<Caso> = {}): Caso {
  return {
    fila: 7176,
    folio: '7000',
    marcaTemporalIso: new Date(2026, 7, 5).toISOString(),
    marcaTemporalTexto: '5/8/2026 15:14:58',
    tipoTramite: 'Emisión',
    tipoNegocio: null,
    nombreSolicitante: 'Ricardo Hernandez',
    correoSolicitante: 'a@b.mx',
    correoEjecutivo: null,
    agencia: 'CHEVROLET CAMPESTRE',
    motivo: null,
    aseguradoraDeclarada: null,
    nombreCliente: null,
    estatusInicial: 'Atendida/en trámite',
    estatusFinal: 'Tramite',
    quienAtendio: 'Keynor',
    folioInterno: null,
    aseguradoraSeguimiento: 'LA LATINO',
    teniaPermisos: 'No',
    causaSeguimiento: 'Función de GPLUS',
    observaciones: 'nota previa',
    fechaRespuestaCorreo: null,
    fechaAtencionFinal: null,
    adjuntos: [],
    camposExtra: [],
    ...parcial,
  }
}

describe('calcularDiff', () => {
  it('lista solo los campos que de verdad cambian', () => {
    const cambios = calcularDiff(caso(), {
      estatusFinal: 'Concluida',
      quienAtendio: 'Keynor', // igual: no es un cambio
    })
    expect(cambios).toHaveLength(1)
    expect(cambios[0]).toEqual({
      campo: 'estatusFinal',
      etiqueta: ETIQUETAS_SEGUIMIENTO.estatusFinal,
      anterior: 'Tramite',
      nuevo: 'Concluida',
    })
  })

  it('trata el paso de vacío a con dato como un cambio', () => {
    const cambios = calcularDiff(caso({ folioInterno: null }), { folioInterno: '0426014703' })
    expect(cambios).toEqual([
      {
        campo: 'folioInterno',
        etiqueta: ETIQUETAS_SEGUIMIENTO.folioInterno,
        anterior: null,
        nuevo: '0426014703',
      },
    ])
  })

  it('ignora las diferencias que son solo espacios', () => {
    expect(calcularDiff(caso(), { estatusFinal: '  Tramite  ' })).toEqual([])
  })

  it('devuelve lista vacía cuando no se propone nada', () => {
    expect(calcularDiff(caso(), {})).toEqual([])
  })

  it('no inventa cambios en campos que no se proponen', () => {
    const cambios = calcularDiff(caso(), { estatusFinal: 'Concluida' })
    expect(cambios.map((c) => c.campo)).toEqual(['estatusFinal'])
  })

  it('detecta el borrado de un valor que existía', () => {
    const cambios = calcularDiff(caso({ folioInterno: '123' }), { folioInterno: '' })
    expect(cambios).toHaveLength(1)
    expect(cambios[0].anterior).toBe('123')
    expect(cambios[0].nuevo).toBe('')
  })

  it('cada campo escribible tiene una etiqueta en español para el diff', () => {
    for (const etiqueta of Object.values(ETIQUETAS_SEGUIMIENTO)) {
      expect(etiqueta.length).toBeGreaterThan(0)
    }
    expect(ETIQUETAS_SEGUIMIENTO.estatusInicial).toBe('Estatus inicial')
    expect(ETIQUETAS_SEGUIMIENTO.observaciones).toBe('Observaciones')
    expect(ETIQUETAS_SEGUIMIENTO.folioInterno).toBe('Folio de aseguradora')
  })
})
