import { describe, expect, it } from 'vitest'
import { casoDePrueba, siniestroDePrueba } from '@/lib/casos/__fixtures__/caso'
import { MESA, MODULOS, SINIESTROS, moduloDelCaso, moduloPorClave } from './modulo'

describe('moduloDelCaso', () => {
  it('un caso del ramo pertenece a siniestros', () => {
    expect(moduloDelCaso(siniestroDePrueba()).clave).toBe('siniestros')
  })

  it('todo lo demás pertenece a la mesa', () => {
    expect(moduloDelCaso(casoDePrueba()).clave).toBe('mesa')
    expect(moduloDelCaso(casoDePrueba({ area: null })).clave).toBe('mesa')
  })
})

describe('qué casos le tocan a cada módulo', () => {
  it('la mesa sigue viendo los siniestros, por decisión del área', () => {
    expect(MESA.incluye(siniestroDePrueba())).toBe(true)
    expect(MESA.incluye(casoDePrueba())).toBe(true)
  })

  it('siniestros ve solo lo suyo', () => {
    expect(SINIESTROS.incluye(siniestroDePrueba())).toBe(true)
    expect(SINIESTROS.incluye(casoDePrueba())).toBe(false)
  })
})

describe('rutas de cada módulo', () => {
  it('el caso lleva a la vista de su propio módulo', () => {
    expect(MESA.rutaCaso(7250)).toBe('/caso/7250')
    expect(SINIESTROS.rutaCaso(7250)).toBe('/siniestros/caso/7250')
  })

  it('cada módulo tiene su listado', () => {
    expect(MESA.rutaLista).toBe('/fila')
    expect(SINIESTROS.rutaLista).toBe('/siniestros')
  })

  it('los ajustes de la mesa son del administrador', () => {
    expect(MESA.ajustes).toEqual({ ruta: '/ajustes', soloAdmin: true })
  })

  it('los ajustes de siniestros los abre cualquier usuario autorizado', () => {
    // Ahí cada quien autoriza su propia cuenta de correo; pedir ser administrador
    // de la mesa para eso daría permisos que no tienen que ver.
    expect(SINIESTROS.ajustes).toEqual({ ruta: '/siniestros/ajustes', soloAdmin: false })
  })

  it('moduloPorClave recupera la configuración desde el cliente', () => {
    expect(moduloPorClave('siniestros')).toBe(SINIESTROS)
    expect(moduloPorClave('mesa')).toBe(MESA)
  })

  it('ningún par de módulos comparte ruta ni clave', () => {
    const claves = MODULOS.map((m) => m.clave)
    const listas = MODULOS.map((m) => m.rutaLista)
    expect(new Set(claves).size).toBe(MODULOS.length)
    expect(new Set(listas).size).toBe(MODULOS.length)
  })
})

describe('clasificación de cada módulo', () => {
  it('solo la mesa ofrece generar folios: la serie es una para toda la hoja', () => {
    expect(MESA.generaFolios).toBe(true)
    expect(SINIESTROS.generaFolios).toBe(false)
  })

  it('siniestros agrega su columna de número de siniestro y la mesa ninguna', () => {
    expect(MESA.columnasExtra).toEqual([])
    expect(SINIESTROS.columnasExtra.map((c) => c.campo)).toEqual(['numeroSiniestro'])
  })

  it('siniestros muestra por omisión también los de trámite', () => {
    // Con 8 casos al año y una sola persona atendiéndolos, esconder los de trámite
    // deja la pantalla en blanco teniendo casos abiertos encima.
    expect(MESA.estatusPorOmision.valores).not.toContain('Tramite')
    expect(SINIESTROS.estatusPorOmision.valores).toContain('Tramite')
    expect(MESA.estatusPorOmision.etiqueta).toBe('Pendientes')
    expect(SINIESTROS.estatusPorOmision.etiqueta).toBe('Abiertos')
  })

  it('la mesa clasifica por trámite y siniestros por tipo de siniestro', () => {
    // Ninguna petición de siniestros trae tipo de trámite: ese selector saldría
    // siempre vacío en su listado.
    expect(MESA.clasificacion.campo).toBe('tipoTramite')
    expect(SINIESTROS.clasificacion.campo).toBe('tipoSiniestro')
  })

  it('cada uno usa su propio parámetro de URL, para no cambiar el de la mesa', () => {
    expect(MESA.clasificacion.param).toBe('tramite')
    expect(SINIESTROS.clasificacion.param).toBe('tipo')
  })
})
