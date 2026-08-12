import { describe, expect, it } from 'vitest'
import type { Caso } from './caso'
import {
  SIN_ESTATUS,
  VENTANA_COLA_DIAS,
  filtrar,
  opcionesDeFiltro,
  ordenarRecientes,
} from './cola'

function c(parcial: Partial<Caso> & { fila: number }): Caso {
  return {
    folio: String(7000 + parcial.fila),
    marcaTemporalIso: new Date(2026, 7, 1).toISOString(),
    marcaTemporalTexto: '',
    tipoTramite: 'Emisión',
    tipoNegocio: null,
    nombreSolicitante: 'Solicitante',
    correoSolicitante: 'a@b.mx',
    correoEjecutivo: null,
    agencia: 'AGENCIA UNO',
    motivo: null,
    aseguradoraDeclarada: null,
    nombreCliente: null,
    estatusInicial: null,
    estatusFinal: null,
    quienAtendio: 'Keynor',
    folioInterno: null,
    aseguradoraSeguimiento: null,
    teniaPermisos: null,
    causaSeguimiento: null,
    observaciones: null,
    fechaRespuestaCorreo: null,
    fechaAtencionFinal: null,
    adjuntos: [],
    camposExtra: [],
    ...parcial,
  }
}

describe('ordenarRecientes', () => {
  it('pone el caso más reciente arriba y el más antiguo abajo', () => {
    const casos = [
      c({ fila: 3, marcaTemporalIso: new Date(2026, 7, 5).toISOString() }),
      c({ fila: 1, marcaTemporalIso: new Date(2026, 6, 20).toISOString() }),
      c({ fila: 2, marcaTemporalIso: new Date(2026, 7, 1).toISOString() }),
    ]
    expect(ordenarRecientes(casos).map((x) => x.fila)).toEqual([3, 2, 1])
  })

  it('deja al final los casos sin fecha legible', () => {
    const casos = [
      c({ fila: 1, marcaTemporalIso: null }),
      c({ fila: 2, marcaTemporalIso: new Date(2026, 7, 1).toISOString() }),
    ]
    expect(ordenarRecientes(casos).map((x) => x.fila)).toEqual([2, 1])
  })

  it('no muta el arreglo recibido', () => {
    const casos = [
      c({ fila: 2, marcaTemporalIso: new Date(2026, 7, 5).toISOString() }),
      c({ fila: 1, marcaTemporalIso: new Date(2026, 6, 1).toISOString() }),
    ]
    const copia = [...casos]
    ordenarRecientes(casos)
    expect(casos).toEqual(copia)
  })
})

describe('filtrar', () => {
  const casos = [
    c({ fila: 1, folio: '7001', estatusFinal: null, quienAtendio: 'Keynor', tipoTramite: 'Emisión' }),
    c({
      fila: 2,
      folio: '7002',
      estatusFinal: 'Concluida',
      quienAtendio: 'Paty',
      tipoTramite: 'Cotización',
    }),
    c({
      fila: 3,
      folio: '7003',
      estatusFinal: 'Tramite',
      quienAtendio: 'Paty',
      tipoTramite: 'Cotización',
    }),
    c({
      fila: 4,
      folio: '7004',
      estatusFinal: 'Improcedente',
      quienAtendio: 'Keynor',
      tipoTramite: 'Endoso',
    }),
  ]

  it('por omisión muestra solo los pendientes: los que no tienen estatus final', () => {
    // El área pidió que ni los cerrados ni los que están en trámite ocupen la
    // pantalla de entrada: en trámite significa que alguien ya lo está viendo.
    expect(filtrar(casos, {}).map((x) => x.folio)).toEqual(['7001'])
  })

  it('los de trámite se ven eligiéndolos en el filtro', () => {
    expect(filtrar(casos, { estatusFinal: ['Tramite'] }).map((x) => x.folio)).toEqual(['7003'])
  })

  it('selecciona un estatus', () => {
    expect(filtrar(casos, { estatusFinal: ['Concluida'] }).map((x) => x.folio)).toEqual(['7002'])
  })

  it('selecciona varios estatus a la vez', () => {
    expect(
      filtrar(casos, { estatusFinal: ['Concluida', 'Improcedente'] }).map((x) => x.folio),
    ).toEqual(['7002', '7004'])
  })

  it('el testigo del vacío selecciona los casos sin estatus final', () => {
    expect(filtrar(casos, { estatusFinal: [SIN_ESTATUS] }).map((x) => x.folio)).toEqual(['7001'])
  })

  it('con todos los estatus seleccionados no filtra nada', () => {
    const todos = ['Concluida', 'Improcedente', 'Tramite', SIN_ESTATUS]
    expect(filtrar(casos, { estatusFinal: todos })).toHaveLength(4)
  })

  it('compara el estatus sin distinguir acentos ni mayúsculas', () => {
    const conAcento = [c({ fila: 9, folio: '9009', estatusFinal: 'Trámite' })]
    expect(filtrar(conAcento, { estatusFinal: ['Tramite'] })).toHaveLength(1)
  })

  it('una selección vacía se trata como si no hubiera filtro', () => {
    // Desmarcar todas las casillas no debe dejar la pantalla en blanco sin
    // explicación: se vuelve al comportamiento por omisión.
    expect(filtrar(casos, { estatusFinal: [] }).map((x) => x.folio)).toEqual(['7001'])
  })

  it('busca por folio', () => {
    const todos = ['Concluida', 'Improcedente', 'Tramite', SIN_ESTATUS]
    expect(filtrar(casos, { texto: '7003', estatusFinal: todos }).map((x) => x.folio)).toEqual([
      '7003',
    ])
  })

  it('busca por nombre de solicitante sin distinguir acentos ni mayúsculas', () => {
    const conAcento = [c({ fila: 9, nombreSolicitante: 'Ricardo Hernández' })]
    expect(filtrar(conAcento, { texto: 'hernandez' })).toHaveLength(1)
    expect(filtrar(conAcento, { texto: 'HERNÁNDEZ' })).toHaveLength(1)
  })

  it('busca por correo y por agencia', () => {
    const otros = [
      c({ fila: 9, correoSolicitante: 'elsa.torres@clikautofinance.com', agencia: 'PRO QRO' }),
    ]
    expect(filtrar(otros, { texto: 'clikauto' })).toHaveLength(1)
    expect(filtrar(otros, { texto: 'pro qro' })).toHaveLength(1)
  })

  it('filtra por tipo de trámite y por responsable', () => {
    const todos = ['Concluida', 'Improcedente', 'Tramite', SIN_ESTATUS]
    expect(filtrar(casos, { tipoTramite: 'Cotización', estatusFinal: todos }).map((x) => x.folio)).toEqual([
      '7002',
      '7003',
    ])
    expect(filtrar(casos, { responsable: 'Keynor' }).map((x) => x.folio)).toEqual(['7001'])
  })

  it('combina filtros con la búsqueda de texto', () => {
    expect(
      filtrar(casos, { responsable: 'Paty', texto: '7003', estatusFinal: ['Tramite'] }).map(
        (x) => x.folio,
      ),
    ).toEqual(['7003'])
  })

  it('un caso sin folio se encuentra buscando por su solicitante', () => {
    const sinFolio = [c({ fila: 9, folio: null, nombreSolicitante: 'Jacqueline Hurtado' })]
    expect(filtrar(sinFolio, { texto: 'jacqueline' })).toHaveLength(1)
  })
})

describe('corte por antigüedad', () => {
  const HOY = new Date(2026, 7, 10) // 10 de agosto de 2026
  const casos = [
    // Vivo de enero: nunca se le puso estatus final. Es rezago, no carga real.
    c({ fila: 1, folio: '5787', marcaTemporalIso: new Date(2026, 0, 6).toISOString(), estatusFinal: null }),
    c({ fila: 2, folio: '6900', marcaTemporalIso: new Date(2026, 6, 1).toISOString(), estatusFinal: null }),
    // Dentro de la ventana de 30 días.
    c({ fila: 3, folio: '7000', marcaTemporalIso: new Date(2026, 7, 5).toISOString(), estatusFinal: null }),
    c({ fila: 4, folio: '7001', marcaTemporalIso: new Date(2026, 7, 9).toISOString(), estatusFinal: 'Tramite' }),
    // Cerrado reciente: no es carga viva.
    c({ fila: 5, folio: '7002', marcaTemporalIso: new Date(2026, 7, 8).toISOString(), estatusFinal: 'Concluida' }),
  ]

  it('la vista cola solo muestra los pendientes de los últimos 30 días', () => {
    expect(filtrar(casos, { vista: 'cola' }, HOY).map((x) => x.folio)).toEqual(['7000'])
  })

  it('la vista rezago muestra exactamente los pendientes que la cola dejó fuera', () => {
    expect(filtrar(casos, { vista: 'rezago' }, HOY).map((x) => x.folio)).toEqual(['5787', '6900'])
  })

  it('cola y rezago juntos suman todos los pendientes, sin traslapes ni huecos', () => {
    const enCola = filtrar(casos, { vista: 'cola' }, HOY).map((x) => x.folio)
    const enRezago = filtrar(casos, { vista: 'rezago' }, HOY).map((x) => x.folio)
    const pendientes = filtrar(casos, { vista: 'todos' }, HOY).map((x) => x.folio)
    expect([...enCola, ...enRezago].sort()).toEqual([...pendientes].sort())
    expect(enCola.filter((f) => enRezago.includes(f))).toEqual([])
  })

  it('la búsqueda por texto ignora el corte, para poder encontrar un caso viejo', () => {
    expect(filtrar(casos, { vista: 'cola', texto: '5787' }, HOY).map((x) => x.folio)).toEqual([
      '5787',
    ])
  })

  it('un filtro explícito de responsable o trámite también ignora el corte', () => {
    const viejo = [
      c({ fila: 1, folio: '5787', marcaTemporalIso: new Date(2026, 0, 6).toISOString(), quienAtendio: 'Norma' }),
    ]
    expect(filtrar(viejo, { vista: 'cola', responsable: 'Norma' }, HOY)).toHaveLength(1)
  })

  it('elegir estatus explícitamente también ignora el corte', () => {
    expect(
      filtrar(casos, { vista: 'cola', estatusFinal: ['Concluida'] }, HOY).map((x) => x.folio),
    ).toEqual(['7002'])
  })

  it('sin vista declarada no hay corte: la función pura no decide por la interfaz', () => {
    expect(filtrar(casos, {}, HOY)).toHaveLength(3) // los 3 pendientes
  })

  it('la ventana de la cola es de 30 días y vive en un solo lugar', () => {
    expect(VENTANA_COLA_DIAS).toBe(30)
  })
})

describe('opcionesDeFiltro', () => {
  it('lista los valores presentes, ordenados y sin repetir', () => {
    const casos = [
      c({ fila: 1, tipoTramite: 'Emisión', quienAtendio: 'Paty', agencia: 'B' }),
      c({ fila: 2, tipoTramite: 'Cotización', quienAtendio: 'Keynor', agencia: 'A' }),
      c({ fila: 3, tipoTramite: 'Emisión', quienAtendio: 'Paty', agencia: 'A' }),
    ]
    const o = opcionesDeFiltro(casos)
    expect(o.tiposTramite).toEqual(['Cotización', 'Emisión'])
    expect(o.responsables).toEqual(['Keynor', 'Paty'])
    expect(o.agencias).toEqual(['A', 'B'])
  })

  it('omite los valores nulos', () => {
    const o = opcionesDeFiltro([c({ fila: 1, tipoTramite: null, quienAtendio: null })])
    expect(o.tiposTramite).toEqual([])
    expect(o.responsables).toEqual([])
  })
})
