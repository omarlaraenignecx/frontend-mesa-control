import { estaVivo, fechaDe, type Caso } from './caso'
import { diasDeEspera } from './semaforo'

/**
 * Días de antigüedad que caben en la cola de trabajo.
 *
 * Existe porque la mesa no cierra formalmente los casos que quedan esperando al
 * solicitante o a la aseguradora: se quedan sin Estatus Final y en una cola FIFO
 * estricta ocuparían los primeros lugares para siempre. Al momento de medirlo
 * había 200 casos vivos, el más antiguo con 216 días. Los que quedan fuera de la
 * ventana no se ocultan: viven en la vista de rezago y se alcanzan con la
 * búsqueda.
 */
export const VENTANA_COLA_DIAS = 30

export type Vista = 'cola' | 'rezago' | 'todos'

export type Filtros = {
  texto?: string
  tipoTramite?: string
  estatus?: string
  responsable?: string
  agencia?: string
  incluirCerrados?: boolean
  vista?: Vista
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim()
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

export function filtrar(casos: Caso[], filtros: Filtros, hoy: Date = new Date()): Caso[] {
  const aguja = filtros.texto ? normalizar(filtros.texto) : ''

  // Buscar o filtrar explícitamente es pedir "encuéntramelo donde sea": en ese
  // caso el corte por antigüedad estorba, así que se desactiva.
  const busquedaExplicita = Boolean(
    aguja || filtros.tipoTramite || filtros.estatus || filtros.responsable || filtros.agencia,
  )
  const vista: Vista = busquedaExplicita ? 'todos' : (filtros.vista ?? 'todos')

  return casos.filter((caso) => {
    if (!filtros.incluirCerrados && !estaVivo(caso)) return false

    if (vista !== 'todos') {
      const dias = diasDeEspera(caso, hoy)
      // Un caso sin fecha legible no se puede cortar por antigüedad: se queda en
      // la cola para que alguien lo revise, nunca se pierde en el rezago.
      const enVentana = dias === null || dias <= VENTANA_COLA_DIAS
      if (vista === 'cola' && !enVentana) return false
      if (vista === 'rezago' && enVentana) return false
    }

    if (filtros.tipoTramite && caso.tipoTramite !== filtros.tipoTramite) return false
    if (filtros.estatus && caso.estatusFinal !== filtros.estatus) return false
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
