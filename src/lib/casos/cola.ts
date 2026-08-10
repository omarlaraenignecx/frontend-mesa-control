import { estaVivo, type Caso } from './caso'

export type Filtros = {
  texto?: string
  tipoTramite?: string
  estatus?: string
  responsable?: string
  agencia?: string
  incluirCerrados?: boolean
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim()
}

/** El más antiguo primero: la cola es de trabajo, no un historial. */
export function ordenarFifo(casos: Caso[]): Caso[] {
  return [...casos].sort((a, b) => {
    const ta = a.marcaTemporal?.getTime()
    const tb = b.marcaTemporal?.getTime()
    if (ta === undefined || ta === null) return 1
    if (tb === undefined || tb === null) return -1
    return ta - tb
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

export function filtrar(casos: Caso[], filtros: Filtros): Caso[] {
  const aguja = filtros.texto ? normalizar(filtros.texto) : ''
  return casos.filter((caso) => {
    if (!filtros.incluirCerrados && !estaVivo(caso)) return false
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
