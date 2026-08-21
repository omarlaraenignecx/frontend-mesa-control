import { describe, expect, it } from 'vitest'
import { MESA, SINIESTROS } from '@/lib/modulos/modulo'
import { avisosDeEscritorio, permisoDeEscritorio, TOPE_AVISOS } from './aviso-escritorio'
import type { Notificacion } from './tipos'

function aviso(parcial: Partial<Notificacion> = {}): Notificacion {
  return {
    id: 1,
    tipo: 'correo_recibido',
    fila: 7100,
    folio: '7001',
    titulo: 'Respuesta de Ana López',
    detalle: 'Caso 7001',
    creadoEnIso: '2026-08-17T16:00:00.000Z',
    ...parcial,
  }
}

describe('permisoDeEscritorio', () => {
  it('sin soporte del navegador no hay nada que ofrecer', () => {
    expect(permisoDeEscritorio(false, null)).toBe('sin-soporte')
    expect(permisoDeEscritorio(false, 'granted')).toBe('sin-soporte')
  })

  it('traduce los tres valores del navegador', () => {
    expect(permisoDeEscritorio(true, 'default')).toBe('preguntar')
    expect(permisoDeEscritorio(true, 'granted')).toBe('concedido')
    expect(permisoDeEscritorio(true, 'denied')).toBe('negado')
  })
})

describe('avisosDeEscritorio', () => {
  it('sin nada nuevo no emite', () => {
    expect(avisosDeEscritorio([], MESA)).toEqual([])
  })

  it('un aviso lleva al caso y arma el cuerpo con detalle y folio', () => {
    expect(avisosDeEscritorio([aviso()], MESA)).toEqual([
      {
        tag: 'mesa-1',
        titulo: 'Respuesta de Ana López',
        cuerpo: 'Caso 7001 · Folio 7001',
        destino: '/caso/7100',
      },
    ])
  })

  it('sin detalle ni folio el cuerpo queda vacío en lugar de decir null', () => {
    const [uno] = avisosDeEscritorio([aviso({ detalle: null, folio: null })], MESA)
    expect(uno.cuerpo).toBe('')
  })

  it('el tag se arma con el id, para que dos pestañas no apilen el mismo aviso', () => {
    const dos = avisosDeEscritorio([aviso({ id: 41 }), aviso({ id: 42 })], MESA)
    expect(dos.map((a) => a.tag)).toEqual(['mesa-41', 'mesa-42'])
  })

  it('hasta el tope emite uno por uno', () => {
    const varias = Array.from({ length: TOPE_AVISOS }, (_, i) => aviso({ id: i + 1 }))
    expect(avisosDeEscritorio(varias, MESA)).toHaveLength(TOPE_AVISOS)
  })

  it('pasando el tope junta todo en un resumen que lleva a la fila', () => {
    const muchas = Array.from({ length: TOPE_AVISOS + 3 }, (_, i) => aviso({ id: i + 1 }))
    expect(avisosDeEscritorio(muchas, MESA)).toEqual([
      {
        tag: 'mesa-resumen',
        titulo: `Llegaron ${TOPE_AVISOS + 3} avisos nuevos`,
        cuerpo: 'Ábrelos desde la campanita de Mesa de Control.',
        destino: '/fila',
      },
    ])
  })

  it('un caso nuevo también lleva a su caso', () => {
    const [uno] = avisosDeEscritorio(
      [
        aviso({
          id: 9,
          tipo: 'caso_nuevo',
          fila: 7241,
          titulo: 'Petición nueva de Juan',
          detalle: 'Endoso · Agencia Centro',
          folio: null,
        }),
      ],
      MESA,
    )
    expect(uno).toEqual({
      tag: 'mesa-9',
      titulo: 'Petición nueva de Juan',
      cuerpo: 'Endoso · Agencia Centro',
      destino: '/caso/7241',
    })
  })
})

describe('el módulo decide a dónde lleva el aviso', () => {
  it('un aviso de siniestros abre el caso en su módulo', () => {
    // Si abriera la vista de la mesa, la respuesta saldría del buzón equivocado.
    const [uno] = avisosDeEscritorio([aviso({ id: 7, fila: 7132 })], SINIESTROS)
    expect(uno.destino).toBe('/siniestros/caso/7132')
    expect(uno.tag).toBe('siniestros-7')
  })

  it('el resumen lleva al listado del módulo y lo nombra', () => {
    const muchas = Array.from({ length: TOPE_AVISOS + 1 }, (_, i) => aviso({ id: i + 1 }))
    const [resumen] = avisosDeEscritorio(muchas, SINIESTROS)
    expect(resumen.destino).toBe('/siniestros')
    expect(resumen.cuerpo).toContain('Atención a Siniestros')
    expect(resumen.tag).toBe('siniestros-resumen')
  })

  it('los tags de los dos módulos no se pisan', () => {
    // Dos pestañas, una en cada módulo: el navegador colapsa por tag, y un tag
    // compartido dejaría un solo globo para dos avisos distintos.
    const deLaMesa = avisosDeEscritorio([aviso({ id: 3 })], MESA)
    const delRamo = avisosDeEscritorio([aviso({ id: 3 })], SINIESTROS)
    expect(deLaMesa[0].tag).not.toBe(delRamo[0].tag)
  })
})
