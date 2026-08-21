import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/encabezados-307.json'
import { construirMapa, letraColumna, normalizarEncabezado, rangoDeLectura } from './sheet-schema'

const ENCABEZADOS: string[] = fixture.encabezados

describe('normalizarEncabezado', () => {
  it('quita acentos, mayúsculas y signos de los extremos', () => {
    expect(normalizarEncabezado('¿Tipo de trámite?')).toBe('tipo de tramite')
    expect(normalizarEncabezado('Agencia:')).toBe('agencia')
  })

  it('colapsa espacios repetidos y saltos de línea, que la hoja tiene de sobra', () => {
    expect(normalizarEncabezado('Nombre del solicitante:\n\n')).toBe('nombre del solicitante')
    expect(normalizarEncabezado('Correo  del ejecutivo comercial de la zona')).toBe(
      'correo del ejecutivo comercial de la zona',
    )
  })
})

describe('letraColumna', () => {
  it('traduce índices 1-based a notación de columna de Sheets', () => {
    expect(letraColumna(1)).toBe('A')
    expect(letraColumna(26)).toBe('Z')
    expect(letraColumna(27)).toBe('AA')
    expect(letraColumna(285)).toBe('JY')
    expect(letraColumna(296)).toBe('KJ')
    expect(letraColumna(307)).toBe('KU')
  })
})

describe('construirMapa con los 307 encabezados reales', () => {
  const mapa = construirMapa(ENCABEZADOS)

  it('resuelve la marca temporal en la columna A', () => {
    expect(mapa.columnasPorCampo.marcaTemporal).toEqual([1])
  })

  it('agrupa las cinco columnas equivalentes de tipo de trámite', () => {
    // N, BQ, CY, FH, HQ comparten el encabezado "Tipo de trámite:"
    expect(mapa.columnasPorCampo.tipoTramite).toEqual(
      expect.arrayContaining([14, 69, 103, 164, 225]),
    )
  })

  it('resuelve el área en sus dos encabezados distintos', () => {
    // BE, CU, FD y HM dicen "Áreas de GPLUS SEGUROS:"; CK, CT y HL dicen
    // "Gplus Seguros". Es la misma pregunta y decide a qué módulo va el caso.
    expect(mapa.columnasPorCampo.area).toEqual([57, 89, 98, 99, 159, 160, 220, 221])
  })

  it('el área es del formulario, nunca de la franja de seguimiento', () => {
    const frontera = mapa.columnasPorCampo.folio[0]
    expect(mapa.columnasPorCampo.area.every((c) => c < frontera)).toBe(true)
  })

  it('los campos del ramo de siniestros dejan de quedar sin clasificar', () => {
    expect(mapa.columnasPorCampo.tipoSiniestro).toEqual([3, 7, 144, 205, 266])
    expect(mapa.columnasPorCampo.numeroSiniestro).toEqual([60, 147, 208, 269])
    expect(mapa.columnasPorCampo.tipoAtencion).toEqual([65, 143, 204, 265, 279])
    for (const c of [3, 60, 65]) expect(mapa.indicesSinResolver).not.toContain(c)
  })

  it('el número de siniestro no se traga la pregunta larga que lo menciona', () => {
    // La columna 5 pide "número de póliza, número de siniestro, nombre del
    // asegurado y contacto"; es otra pregunta y no es el número de siniestro.
    expect(mapa.columnasPorCampo.numeroSiniestro).not.toContain(5)
  })

  it('reúne en un solo campo las 41 columnas del motivo de la petición', () => {
    expect(mapa.columnasPorCampo.motivo.length).toBeGreaterThanOrEqual(41)
  })

  it('separa el correo del solicitante del correo del ejecutivo comercial', () => {
    // AD "Dirección de correo electrónico" es el solicitante; JM "Correo del
    // ejecutivo comercial de la zona" es otra persona y va en copia, no en Para.
    expect(mapa.columnasPorCampo.correoSolicitante).toEqual(expect.arrayContaining([30]))
    expect(mapa.columnasPorCampo.correoSolicitante).not.toContain(273)
    expect(mapa.columnasPorCampo.correoEjecutivo).toEqual([273])
  })

  it('resuelve la agencia y la agencia externa como campos distintos', () => {
    expect(mapa.columnasPorCampo.agencia).toEqual(expect.arrayContaining([29]))
    expect(mapa.columnasPorCampo.agenciaExterna).toEqual(expect.arrayContaining([55]))
  })

  it('mapea las columnas de seguimiento de la mesa a su columna única', () => {
    expect(mapa.columnasPorCampo.folio).toEqual([285]) // JY
    expect(mapa.columnasPorCampo.estatusInicial).toEqual([286]) // JZ
    expect(mapa.columnasPorCampo.estatusFinal).toEqual([287]) // KA
    expect(mapa.columnasPorCampo.fechaRespuestaCorreo).toEqual([288]) // KB
    expect(mapa.columnasPorCampo.fechaAtencionFinal).toEqual([290]) // KD
    expect(mapa.columnasPorCampo.quienAtendio).toEqual([291]) // KE
    expect(mapa.columnasPorCampo.folioInterno).toEqual([292]) // KF
    expect(mapa.columnasPorCampo.aseguradoraSeguimiento).toEqual([293]) // KG
    expect(mapa.columnasPorCampo.teniaPermisos).toEqual([294]) // KH
    expect(mapa.columnasPorCampo.causaSeguimiento).toEqual([295]) // KI
    expect(mapa.columnasPorCampo.observaciones).toEqual([296]) // KJ
  })

  it('no confunde la aseguradora que declara el solicitante con la que registra la mesa', () => {
    // "Aseguradora" es el encabezado de BI (61), del formulario, y de KG (293),
    // del seguimiento. Son campos distintos y no deben mezclarse.
    expect(mapa.columnasPorCampo.aseguradoraSeguimiento).toEqual([293])
    expect(mapa.columnasPorCampo.aseguradoraDeclarada).toContain(61)
    expect(mapa.columnasPorCampo.aseguradoraDeclarada).not.toContain(293)
  })

  it('ningún campo del formulario toma columnas de la zona de seguimiento, y al revés', () => {
    const DE_SEGUIMIENTO = [
      'folio',
      'estatusInicial',
      'estatusFinal',
      'fechaRespuestaCorreo',
      'fechaAtencionFinal',
      'quienAtendio',
      'folioInterno',
      'aseguradoraSeguimiento',
      'teniaPermisos',
      'causaSeguimiento',
      'observaciones',
    ]
    for (const [campo, columnas] of Object.entries(mapa.columnasPorCampo)) {
      for (const c of columnas) {
        if (DE_SEGUIMIENTO.includes(campo)) expect(c).toBeGreaterThanOrEqual(285)
        else expect(c).toBeLessThan(285)
      }
    }
  })

  it('no confunde los duplicados residuales KL-KN con los estatus reales', () => {
    expect(mapa.columnasPorCampo.estatusInicial).not.toContain(298)
    expect(mapa.columnasPorCampo.estatusFinal).not.toContain(299)
  })

  it('detecta las columnas de adjuntos con una etiqueta legible', () => {
    // 14 grupos de adjuntos, 49 columnas en total
    expect(mapa.columnasAdjuntos.length).toBeGreaterThanOrEqual(49)
    const q = mapa.columnasAdjuntos.find((a) => a.columna === 17) // Q, adjunto de emisión
    expect(q).toBeDefined()
    expect(q!.etiqueta.length).toBeGreaterThan(0)
    expect(q!.etiqueta.length).toBeLessThanOrEqual(60)
  })

  it('no incluye columnas calculadas ni de fórmula en ningún campo', () => {
    const prohibidas = [289, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307]
    const usadas = Object.values(mapa.columnasPorCampo).flat()
    for (const p of prohibidas) expect(usadas).not.toContain(p)
  })

  it('reporta los encabezados que no supo clasificar en lugar de tragárselos', () => {
    // No es un error: sirve para revisarlos en Ajustes. Pero deben ser una minoría.
    expect(mapa.indicesSinResolver.length).toBeLessThan(ENCABEZADOS.length / 2)
  })

  it('tolera que el formulario agregue una pregunta al final', () => {
    const conNueva = [...ENCABEZADOS, '¿Requiere factura adicional?']
    const nuevo = construirMapa(conNueva)
    expect(nuevo.columnasPorCampo.tipoTramite).toEqual(mapa.columnasPorCampo.tipoTramite)
    expect(nuevo.columnasPorCampo.folio).toEqual(mapa.columnasPorCampo.folio)
  })

  it('sigue resolviendo si una pregunta del formulario cambia de lugar', () => {
    // Se mueve "Tipo de trámite:" de la posición 14 a la 200, dentro de la zona
    // del formulario, que es como se reordena un Google Form.
    const movido = [...ENCABEZADOS]
    const [tipo] = movido.splice(13, 1)
    movido.splice(199, 0, tipo)
    const nuevo = construirMapa(movido)
    expect(nuevo.columnasPorCampo.tipoTramite).toContain(200)
    expect(nuevo.columnasPorCampo.tipoTramite).not.toContain(14)
  })

  it('reubica toda la zona de seguimiento cuando el formulario agrega preguntas', () => {
    // El caso que de verdad importa: al agregar una pregunta al formulario,
    // Google inserta la columna antes de las que la mesa mantiene a mano, y
    // todo el seguimiento se corre a la derecha. Una frontera fija en 285
    // dejaría de encontrar el folio, el estatus y las observaciones.
    const conNueva = [...ENCABEZADOS]
    conNueva.splice(280, 0, '¿Requiere factura adicional?')
    const nuevo = construirMapa(conNueva)

    expect(nuevo.columnasPorCampo.folio).toEqual([286]) // antes 285
    expect(nuevo.columnasPorCampo.estatusInicial).toEqual([287])
    expect(nuevo.columnasPorCampo.observaciones).toEqual([297])
    // Y la columna nueva no se pierde: queda reportada para revisarla.
    expect(nuevo.indicesSinResolver).toContain(281)
  })

  it('ignora las columnas calculadas por su encabezado, no por su posición', () => {
    const conNueva = [...ENCABEZADOS]
    conNueva.splice(280, 0, '¿Requiere factura adicional?')
    const nuevo = construirMapa(conNueva)
    const usadas = [
      ...Object.values(nuevo.columnasPorCampo).flat(),
      ...nuevo.columnasAdjuntos.map((a) => a.columna),
      ...nuevo.indicesSinResolver,
    ]
    // SLA, Total Dias y Mes Recibe se corrieron una posición y siguen ignoradas.
    for (const etiqueta of ['SLA', 'Total Dias', 'Mes Recibe', 'Estatus Real']) {
      const indice = conNueva.findIndex((t) => t === etiqueta) + 1
      expect(indice).toBeGreaterThan(0)
      expect(usadas).not.toContain(indice)
    }
  })
})

describe('rangoDeLectura', () => {
  it('cubre desde la columna A hasta la última columna que algún campo necesita', () => {
    const mapa = construirMapa(ENCABEZADOS)
    expect(rangoDeLectura(mapa)).toBe('A2:KJ')
  })
})
