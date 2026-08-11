import { describe, expect, it } from 'vitest'
import { estaVivo, parsearFechaHoja, sinFolio, type Caso } from './caso'

function caso(parcial: Partial<Caso> = {}): Caso {
  return {
    fila: 7176,
    folio: '7000',
    marcaTemporalIso: new Date(2026, 7, 5, 15, 14, 58).toISOString(),
    marcaTemporalTexto: '5/8/2026 15:14:58',
    tipoTramite: 'Emisión',
    tipoNegocio: 'EXTERNA',
    nombreSolicitante: 'Ricardo Hernandez',
    correoSolicitante: 'comercial28@garantiplus.mx',
    correoEjecutivo: null,
    agencia: 'CHEVROLET CAMPESTRE',
    motivo: 'aplicar el pago a la póliza',
    aseguradoraDeclarada: null,
    nombreCliente: null,
    estatusInicial: 'Atendida/en trámite',
    estatusFinal: 'Tramite',
    quienAtendio: 'Keynor',
    folioInterno: null,
    aseguradoraSeguimiento: 'LA LATINO',
    teniaPermisos: 'No',
    causaSeguimiento: 'Función de GPLUS',
    observaciones: 'SE ENVIAN DATOS DE APLICACION DE PAGO',
    fechaRespuestaCorreo: null,
    fechaAtencionFinal: null,
    adjuntos: [],
    camposExtra: [],
    ...parcial,
  }
}

describe('parsearFechaHoja', () => {
  it('interpreta el formato D/M/YYYY H:mm:ss de la columna A', () => {
    const d = parsearFechaHoja('5/8/2026 15:14:58')
    expect(d).not.toBeNull()
    expect([d!.getFullYear(), d!.getMonth() + 1, d!.getDate()]).toEqual([2026, 8, 5])
    expect([d!.getHours(), d!.getMinutes(), d!.getSeconds()]).toEqual([15, 14, 58])
  })

  it('interpreta día y mes de un dígito', () => {
    const d = parsearFechaHoja('9/1/2026 9:05:03')
    expect([d!.getDate(), d!.getMonth() + 1, d!.getHours()]).toEqual([9, 1, 9])
  })

  it('acepta una fecha sin hora', () => {
    const d = parsearFechaHoja('20/2/2023')
    expect([d!.getDate(), d!.getMonth() + 1, d!.getFullYear()]).toEqual([20, 2, 2023])
  })

  it('devuelve null ante basura, sin lanzar', () => {
    expect(parsearFechaHoja('')).toBeNull()
    expect(parsearFechaHoja('#REF!')).toBeNull()
    expect(parsearFechaHoja('no es fecha')).toBeNull()
  })
})

describe('estaVivo', () => {
  it('un caso en trámite está vivo', () => {
    expect(estaVivo(caso({ estatusFinal: 'Tramite' }))).toBe(true)
  })

  it('un caso sin estatus final está vivo, porque nadie lo ha cerrado', () => {
    expect(estaVivo(caso({ estatusFinal: null }))).toBe(true)
    expect(estaVivo(caso({ estatusFinal: '' }))).toBe(true)
  })

  it('concluida e improcedente son terminales', () => {
    expect(estaVivo(caso({ estatusFinal: 'Concluida' }))).toBe(false)
    expect(estaVivo(caso({ estatusFinal: 'Improcedente' }))).toBe(false)
  })

  it('ignora espacios y mayúsculas del texto de la hoja', () => {
    expect(estaVivo(caso({ estatusFinal: ' concluida ' }))).toBe(false)
  })
})

describe('sinFolio', () => {
  it('detecta el caso que llegó sin folio, como la fila 7178', () => {
    expect(sinFolio(caso({ folio: null }))).toBe(true)
    expect(sinFolio(caso({ folio: '   ' }))).toBe(true)
    expect(sinFolio(caso({ folio: '7000' }))).toBe(false)
  })
})
