import { normalizarTexto as normalizar } from '@/lib/texto'
import { fechaDe, type Caso } from './caso'
import { diasDeEspera } from './semaforo'

/**
 * Días de antigüedad que caben en la cola de trabajo.
 *
 * Existe porque la mesa no cierra formalmente los casos que quedan esperando al
 * solicitante o a la aseguradora: se quedan sin Estatus Final y sin este corte
 * la cola mezclaría cientos de casos viejos con el trabajo del día. Al momento
 * de medirlo había 200 casos vivos, el más antiguo con 216 días. Los que quedan
 * fuera de la ventana no se ocultan: viven en la vista de rezago y se alcanzan
 * con la búsqueda.
 */
export const VENTANA_COLA_DIAS = 30

/**
 * Las tres vistas de la bandeja. El literal viaja en la URL como `?vista=…`, y
 * por eso dice `fila`: es el nombre que el área le puso a la bandeja el 13 de
 * agosto de 2026. El módulo sigue llamándose `cola` porque en el código `fila`
 * es el renglón de la hoja (`caso.fila`).
 */
export type Vista = 'fila' | 'rezago' | 'todos'

/**
 * Testigo del "sin valor" en el filtro de estatus final. Existe porque el filtro
 * viaja en la URL y una cadena vacía ahí no se distingue de "no filtrar".
 */
export const SIN_ESTATUS = 'sin'

/**
 * Selección por omisión del filtro de estatus final: solo los pendientes, los
 * que todavía no tienen estatus.
 *
 * Ni los cerrados ni los que están en trámite ocupan la pantalla de entrada: que
 * un caso diga "Tramite" significa que alguien ya lo tomó, así que estorba a
 * quien abre la cola buscando lo que nadie ha visto. Se ven marcando su casilla
 * en el filtro.
 */
export const ESTATUS_POR_OMISION = [SIN_ESTATUS]

export type Filtros = {
  texto?: string
  tipoTramite?: string
  /** Valores de Estatus Final aceptados; SIN_ESTATUS representa la celda vacía. */
  estatusFinal?: string[]
  responsable?: string
  agencia?: string
  vista?: Vista
}

/**
 * El más reciente arriba, como pidió el área: lo que acaba de llegar es lo que
 * la mesa quiere ver al abrir la pantalla. Los casos viejos que siguen abiertos
 * se atienden desde la vista de rezago, que es donde se vuelven visibles.
 *
 * Un caso sin fecha legible se va al final: no se puede ordenar, pero tampoco
 * debe desaparecer.
 */
export function ordenarRecientes(casos: Caso[]): Caso[] {
  return [...casos].sort((a, b) => {
    const ta = fechaDe(a)?.getTime()
    const tb = fechaDe(b)?.getTime()
    if (ta === undefined) return 1
    if (tb === undefined) return -1
    return tb - ta
  })
}

function coincideTexto(caso: Caso, aguja: string): boolean {
  const campos = [
    caso.folio,
    caso.nombreSolicitante,
    caso.correoSolicitante,
    caso.agencia,
    caso.nombreCliente,
    caso.folioInterno,
    caso.tipoTramite,
  ]
  return campos.some((c) => c && normalizar(c).includes(aguja))
}

/** Clave con la que se compara el estatus final de un caso contra la selección. */
function claveEstatus(estatus: string | null): string {
  return normalizar(estatus ?? '') || SIN_ESTATUS
}

export function filtrar(casos: Caso[], filtros: Filtros, hoy: Date = new Date()): Caso[] {
  const aguja = filtros.texto ? normalizar(filtros.texto) : ''

  // Una selección vacía se trata como si no hubiera filtro: desmarcar todas las
  // casillas no debe dejar la pantalla en blanco sin explicación.
  const seleccion = filtros.estatusFinal?.length ? filtros.estatusFinal : ESTATUS_POR_OMISION
  const estatusAceptados = new Set(seleccion.map(claveEstatus))

  // Buscar o filtrar explícitamente es pedir "encuéntramelo donde sea": en ese
  // caso el corte por antigüedad estorba, así que se desactiva.
  const busquedaExplicita = Boolean(
    aguja ||
      filtros.tipoTramite ||
      filtros.estatusFinal?.length ||
      filtros.responsable ||
      filtros.agencia,
  )
  const vista: Vista = busquedaExplicita ? 'todos' : (filtros.vista ?? 'todos')

  return casos.filter((caso) => {
    if (!estatusAceptados.has(claveEstatus(caso.estatusFinal))) return false

    if (vista !== 'todos') {
      const dias = diasDeEspera(caso, hoy)
      // Un caso sin fecha legible no se puede cortar por antigüedad: se queda en
      // la cola para que alguien lo revise, nunca se pierde en el rezago.
      const enVentana = dias === null || dias <= VENTANA_COLA_DIAS
      if (vista === 'fila' && !enVentana) return false
      if (vista === 'rezago' && enVentana) return false
    }

    if (filtros.tipoTramite && caso.tipoTramite !== filtros.tipoTramite) return false
    if (filtros.responsable && caso.quienAtendio !== filtros.responsable) return false
    if (filtros.agencia && caso.agencia !== filtros.agencia) return false
    if (aguja && !coincideTexto(caso, aguja)) return false
    return true
  })
}

export function opcionesDeFiltro(casos: Caso[]) {
  const unicos = (valores: (string | null)[]) =>
    [...new Set(valores.filter((v): v is string => Boolean(v?.trim())))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    )

  return {
    tiposTramite: unicos(casos.map((c) => c.tipoTramite)),
    estatus: unicos(casos.map((c) => c.estatusFinal)),
    responsables: unicos(casos.map((c) => c.quienAtendio)),
    agencias: unicos(casos.map((c) => c.agencia)),
  }
}
