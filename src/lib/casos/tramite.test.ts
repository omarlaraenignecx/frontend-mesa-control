import { describe, expect, it } from 'vitest'
import { MESA, SINIESTROS } from '@/lib/modulos/modulo'
import { casoDePrueba, siniestroDePrueba } from './__fixtures__/caso'
import {
  SIN_CORRECCION,
  lineaDeCorreccion,
  notaDelGuardado,
  motivoSinCorreccion,
  opcionesDeTramite,
  puedeCorregirTramite,
  rechazoDeCorreccion,
} from './tramite'

describe('puedeCorregirTramite', () => {
  it('deja corregir un caso de la mesa que ya trae trámite', () => {
    expect(puedeCorregirTramite(MESA, casoDePrueba())).toBe(true)
  })

  it('no deja corregir desde el módulo del ramo', () => {
    expect(puedeCorregirTramite(SINIESTROS, casoDePrueba())).toBe(false)
  })

  it('no deja corregir un caso de siniestros, ni siquiera abierto desde la mesa', () => {
    // La fila de la mesa sigue listando los casos del ramo, así que la condición no
    // puede depender solo de la pantalla desde la que se entró.
    expect(puedeCorregirTramite(MESA, siniestroDePrueba())).toBe(false)
  })

  it('no deja corregir un caso que el formulario dejó sin trámite', () => {
    // Sin valor no se sabe qué bloque del formulario llenó la fila, y por lo tanto
    // no hay celda donde escribir la corrección.
    expect(puedeCorregirTramite(MESA, casoDePrueba({ tipoTramite: null }))).toBe(false)
    expect(puedeCorregirTramite(MESA, casoDePrueba({ tipoTramite: '   ' }))).toBe(false)
  })
})

describe('motivoSinCorreccion', () => {
  it('no da motivo cuando sí se puede corregir', () => {
    expect(motivoSinCorreccion(MESA, casoDePrueba())).toBeNull()
  })

  it('distingue el caso del ramo del caso sin trámite', () => {
    expect(motivoSinCorreccion(MESA, siniestroDePrueba())).toBe(SIN_CORRECCION.ramo)
    expect(motivoSinCorreccion(MESA, casoDePrueba({ tipoTramite: null }))).toBe(
      SIN_CORRECCION.sinOrigen,
    )
  })
})

describe('rechazoDeCorreccion', () => {
  it('acepta un cambio de trámite legítimo', () => {
    expect(rechazoDeCorreccion(casoDePrueba(), 'Endoso')).toBeNull()
  })

  it('rechaza vaciar el trámite', () => {
    // Vaciarlo borraría la respuesta del solicitante sin poner nada en su lugar, y
    // dejaría la fila fuera de los reportes que esta función vino a arreglar.
    expect(rechazoDeCorreccion(casoDePrueba(), '   ')).toBe(SIN_CORRECCION.vacio)
  })

  it('rechaza corregir un caso del ramo y uno sin trámite de origen', () => {
    expect(rechazoDeCorreccion(siniestroDePrueba(), 'Endoso')).toBe(SIN_CORRECCION.ramo)
    expect(rechazoDeCorreccion(casoDePrueba({ tipoTramite: null }), 'Endoso')).toBe(
      SIN_CORRECCION.sinOrigen,
    )
  })
})

describe('opcionesDeTramite', () => {
  it('ordena en español, sin repetir y sin vacíos', () => {
    expect(opcionesDeTramite(['Endoso', 'Cotización', 'Endoso', '  '], null)).toEqual([
      'Cotización',
      'Endoso',
    ])
  })

  it('incluye siempre el trámite del caso aunque la lista no lo traiga', () => {
    // Si faltara, abrir el caso propondría en silencio cambiarle el trámite al
    // primer valor de la lista.
    expect(opcionesDeTramite(['Cotización'], 'Alta de versión')).toEqual([
      'Alta de versión',
      'Cotización',
    ])
  })

  it('no normaliza los valores: los deja tal como están en la hoja', () => {
    // Misma política que los catálogos de seguimiento: normalizarlos generaría
    // valores nuevos en el histórico y rompería las tablas dinámicas del área.
    expect(opcionesDeTramite(['Atendida/en trámite'], null)).toEqual(['Atendida/en trámite'])
  })
})

describe('lineaDeCorreccion', () => {
  it('dice de qué a qué, para que el rastro quede en la propia hoja', () => {
    expect(lineaDeCorreccion('Emisión', 'Endoso')).toBe(
      'Tipo de trámite corregido de «Emisión» a «Endoso».',
    )
  })
})

describe('notaDelGuardado', () => {
  it('anota la corrección cuando el trámite cambia', () => {
    expect(notaDelGuardado(casoDePrueba(), 'Endoso', '')).toBe(
      'Tipo de trámite corregido de «Emisión» a «Endoso».',
    )
  })

  it('conserva íntegra la nota de la persona cuando además se corrige el trámite', () => {
    // Las dos cosas son un mismo acto y van en una sola entrada, pero lo que
    // escribió quien atiende no se pierde ni se recorta.
    expect(notaDelGuardado(casoDePrueba(), 'Endoso', '  Ya se envió al asegurado  ')).toBe(
      'Tipo de trámite corregido de «Emisión» a «Endoso». Ya se envió al asegurado',
    )
  })

  it('no anota nada si el trámite no cambió', () => {
    expect(notaDelGuardado(casoDePrueba(), 'Emisión', '')).toBe('')
    expect(notaDelGuardado(casoDePrueba(), undefined, '')).toBe('')
  })

  it('deja pasar la nota sola cuando no hay corrección', () => {
    expect(notaDelGuardado(casoDePrueba(), undefined, 'Pendiente de la aseguradora')).toBe(
      'Pendiente de la aseguradora',
    )
  })
})
