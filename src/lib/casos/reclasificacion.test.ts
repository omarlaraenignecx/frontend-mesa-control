import { describe, expect, it } from 'vitest'
import { casoDePrueba } from './__fixtures__/caso'
import { MESA, SINIESTROS } from '@/lib/modulos/modulo'
import {
  CLASIFICACIONES,
  SIN_RECLASIFICACION,
  lineaDeReclasificacion,
  notaDelGuardado,
  opcionesDeReclasificacion,
  puedeReclasificar,
} from './reclasificacion'

describe('catálogo de clasificaciones', () => {
  it('trae las opciones del formulario y ninguna de las frases sueltas', () => {
    expect(CLASIFICACIONES).toContain('Cotización')
    expect(CLASIFICACIONES).toContain('Alta de negocio o distribuidor')
    // Texto que alguien escribió a mano en la columna N y que no es una opción.
    expect(CLASIFICACIONES).not.toContain('OMEGA')
    expect(CLASIFICACIONES).not.toContain('PDF')
  })

  it('no repite valores', () => {
    expect(new Set(CLASIFICACIONES).size).toBe(CLASIFICACIONES.length)
  })
})

describe('puedeReclasificar', () => {
  it('deja reclasificar un caso de la mesa', () => {
    expect(puedeReclasificar(MESA, casoDePrueba())).toBe(true)
  })

  it('no deja en el módulo de siniestros', () => {
    expect(puedeReclasificar(SINIESTROS, casoDePrueba())).toBe(false)
  })

  it('no deja en un caso del ramo aunque se mire desde la mesa', () => {
    const siniestro = casoDePrueba({ area: 'Siniestros', tipoTramite: null })
    expect(puedeReclasificar(MESA, siniestro)).toBe(false)
  })

  /**
   * La versión anterior escribía dentro del formulario y necesitaba que la fila
   * trajera un trámite para saber en qué celda escribir. Ahora la columna es
   * propia y siempre está: un caso que llegó sin clasificar también se reclasifica.
   */
  it('deja reclasificar un caso que llegó sin tipo de trámite', () => {
    expect(puedeReclasificar(MESA, casoDePrueba({ tipoTramite: null }))).toBe(true)
  })
})

describe('opcionesDeReclasificacion', () => {
  it('ofrece el catálogo cuando el caso no está reclasificado', () => {
    expect(opcionesDeReclasificacion(null)).toEqual([...CLASIFICACIONES])
  })

  it('no duplica el valor actual si ya está en el catálogo', () => {
    expect(opcionesDeReclasificacion('Endoso')).toEqual([...CLASIFICACIONES])
  })

  /**
   * Si no, abrir un caso reclasificado con un valor viejo y guardarlo se lo
   * cambiaría sin que nadie lo pidiera: el select no tendría su valor y el
   * navegador elegiría el primero de la lista.
   */
  it('conserva un valor fuera de catálogo, y lo pone primero', () => {
    const opciones = opcionesDeReclasificacion('Trámite de antes')
    expect(opciones[0]).toBe('Trámite de antes')
    expect(opciones).toHaveLength(CLASIFICACIONES.length + 1)
  })

  it('ignora el valor actual si viene en blanco', () => {
    expect(opcionesDeReclasificacion('   ')).toEqual([...CLASIFICACIONES])
  })
})

describe('lineaDeReclasificacion', () => {
  it('parte del trámite del formulario la primera vez', () => {
    const caso = casoDePrueba({ tipoTramite: 'Emisión', reclasificacion: null })
    expect(lineaDeReclasificacion(caso, 'Endoso')).toBe('Reclasificado de «Emisión» a «Endoso».')
  })

  it('parte de la reclasificación anterior cuando ya había una', () => {
    const caso = casoDePrueba({ tipoTramite: 'Emisión', reclasificacion: 'Endoso' })
    expect(lineaDeReclasificacion(caso, 'Cancelaciones')).toBe(
      'Reclasificado de «Endoso» a «Cancelaciones».',
    )
  })

  it('dice «sin clasificar» cuando el caso no traía nada', () => {
    const caso = casoDePrueba({ tipoTramite: null, reclasificacion: null })
    expect(lineaDeReclasificacion(caso, 'Endoso')).toBe(
      'Reclasificado de «sin clasificar» a «Endoso».',
    )
  })

  it('deja rastro también cuando se quita la reclasificación', () => {
    const caso = casoDePrueba({ reclasificacion: 'Endoso' })
    expect(lineaDeReclasificacion(caso, '')).toBe('Se quitó la reclasificación, que era «Endoso».')
  })
})

describe('notaDelGuardado', () => {
  it('no anota nada cuando no hay nota ni cambio de clasificación', () => {
    expect(notaDelGuardado(casoDePrueba(), undefined, '')).toBe('')
  })

  it('anota solo la nota de la persona cuando la clasificación no cambia', () => {
    const caso = casoDePrueba({ reclasificacion: 'Endoso' })
    expect(notaDelGuardado(caso, 'Endoso', 'Ya se envió')).toBe('Ya se envió')
  })

  it('anota la reclasificación aunque nadie haya escrito nota', () => {
    const caso = casoDePrueba({ tipoTramite: 'Emisión' })
    expect(notaDelGuardado(caso, 'Endoso', '')).toBe('Reclasificado de «Emisión» a «Endoso».')
  })

  it('junta las dos, sin recortar la de la persona', () => {
    const caso = casoDePrueba({ tipoTramite: 'Emisión' })
    expect(notaDelGuardado(caso, 'Endoso', 'Ya se envió')).toBe(
      'Reclasificado de «Emisión» a «Endoso». Ya se envió',
    )
  })
})

describe('SIN_RECLASIFICACION', () => {
  it('explica el único motivo por el que el servidor la rechaza', () => {
    expect(SIN_RECLASIFICACION).toMatch(/siniestros/i)
  })
})
