export type CampoLogico =
  | 'marcaTemporal'
  | 'tipoTramite'
  | 'tipoNegocio'
  | 'nombreSolicitante'
  | 'correoSolicitante'
  | 'correoEjecutivo'
  | 'agencia'
  | 'agenciaExterna'
  | 'motivo'
  | 'aseguradoraDeclarada'
  | 'nombreCliente'
  | 'causaNoRealizo'
  | 'comentariosAdicionales'
  | 'folio'
  | 'estatusInicial'
  | 'estatusFinal'
  | 'quienAtendio'
  | 'folioInterno'
  | 'aseguradoraSeguimiento'
  | 'teniaPermisos'
  | 'causaSeguimiento'
  | 'observaciones'
  | 'fechaRespuestaCorreo'
  | 'fechaAtencionFinal'

export type MapaEsquema = {
  columnasPorCampo: Record<CampoLogico, number[]>
  columnasAdjuntos: { columna: number; etiqueta: string }[]
  indicesSinResolver: number[]
}

/**
 * Encabezados normalizados que corresponden a cada campo lógico. El formulario
 * está replicado en bloques, así que un mismo encabezado aparece en varias
 * columnas; además hay encabezados distintos que significan lo mismo.
 */
const ALIAS: Record<CampoLogico, string[]> = {
  marcaTemporal: ['marca temporal'],
  tipoTramite: [
    'tipo de tramite',
    'tramite',
    'indicar tipo de tramite solicitado',
    'indicar el tipo de solicitud',
  ],
  tipoNegocio: ['tipo de negocio', 'favor de indicar tipo de negocio'],
  nombreSolicitante: [
    'nombre del solicitante',
    'favor de indicar nombre completo del colaborador que solicita el tramite',
  ],
  correoSolicitante: ['direccion de correo electronico', 'correo del solicitante'],
  // El ejecutivo comercial es otra persona: va en copia, no en el destinatario.
  correoEjecutivo: ['correo del ejecutivo comercial de la zona'],
  agencia: ['agencia'],
  agenciaExterna: ['indicar la agencia externa'],
  motivo: [
    'senalar el motivo por el cual se solicita el tramite a mesa de control',
    'motivo por el cual se solicita el tramite a mesa de control',
    'senalar el motivo por el cual el cliente solicita la atencion (seguimiento, queja, duda)',
  ],
  aseguradoraDeclarada: ['que aseguradora es', 'seleccionar la aseguradora', 'aseguradora'],
  nombreCliente: ['nombre del cliente', 'proporcionar el nombre y contacto del cliente'],
  causaNoRealizo: ['causa por la que no pudo realizar el tramite el ejecutivo y el comercial'],
  comentariosAdicionales: ['comentarios adicionales'],

  // Zona de seguimiento de la mesa: una sola columna cada uno.
  folio: ['folio de atencion'],
  estatusInicial: ['estatus inicial'],
  estatusFinal: ['estatus final'],
  fechaRespuestaCorreo: ['fecha y hora de respuesta por correo'],
  fechaAtencionFinal: ['fecha y hora de atencion final'],
  quienAtendio: ['quien atendio'],
  folioInterno: ['folio interno'],
  aseguradoraSeguimiento: ['aseguradora'],
  teniaPermisos: ['el ejecutivo contaba con permisos para realizar la actividad'],
  causaSeguimiento: ['causa por la que no pudo realizar la actividad'],
  observaciones: ['observaciones'],
}

/**
 * Columnas calculadas por fórmulas de la hoja, más el estatus real derivado.
 * La aplicación no las lee como campo ni las escribe jamás. Se identifican por
 * su encabezado y no por su posición: si el formulario crece, se desplazan.
 */
const ENCABEZADOS_CALCULADOS = new Set([
  'tiempo entre solictud y respuesta por correo', // el typo es de la hoja
  'estatus real',
  'dias espera ai',
  'dias espera af',
  'total dias',
  'dia',
  'sla',
  'ano recibe',
  'mes recibe',
])

/**
 * Encabezado que marca el inicio de la zona de seguimiento de la mesa. Todo lo
 * anterior son respuestas del formulario.
 *
 * La frontera es indispensable, no cosmética: hay encabezados idénticos a los
 * dos lados. "Aseguradora" existe en BI, donde la declara el solicitante, y en
 * KG, donde la registra la mesa. Sin separarlas, el mapeador leería el
 * seguimiento desde una columna del formulario.
 *
 * Se localiza por encabezado en cada lectura, nunca se fija por posición: si el
 * formulario agrega una pregunta, las columnas de la mesa se corren a la
 * derecha y una frontera fija rompería todo el seguimiento (RNF-11).
 */
const ENCABEZADO_FRONTERA = 'folio de atencion'

/** Los campos de seguimiento viven una sola vez, en la zona de la mesa. */
const CAMPOS_COLUMNA_UNICA: CampoLogico[] = [
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

const PATRONES_ADJUNTO = [
  'adjuntar',
  'subir evidencia',
  'favor de enviar los documentos',
  'favor de enviar el formato',
  'favor de anexar',
]

export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[¿?:.\s]+|[¿?:.\s]+$/g, '')
    .trim()
}

export function letraColumna(indice: number): string {
  let n = indice
  let s = ''
  while (n > 0) {
    const resto = (n - 1) % 26
    s = String.fromCharCode(65 + resto) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/**
 * Columnas que no se pueden leer como campo: las calculadas por fórmula y las
 * repeticiones de un encabezado de seguimiento (los duplicados residuales
 * KL-KN, que traen el mismo texto que JZ/KA pero no son la columna buena).
 */
function columnasIgnorables(encabezados: string[], frontera: number): Set<number> {
  const ignorables = new Set<number>()
  const vistosEnSeguimiento = new Set<string>()

  encabezados.forEach((texto, i) => {
    const indice = i + 1
    const clave = normalizarEncabezado(texto ?? '')
    if (!clave) return

    if (ENCABEZADOS_CALCULADOS.has(clave)) {
      ignorables.add(indice)
      return
    }
    if (indice >= frontera) {
      if (vistosEnSeguimiento.has(clave)) ignorables.add(indice)
      else vistosEnSeguimiento.add(clave)
    }
  })

  return ignorables
}

export function construirMapa(encabezados: string[]): MapaEsquema {
  const indiceFrontera =
    encabezados.findIndex((t) => normalizarEncabezado(t ?? '') === ENCABEZADO_FRONTERA) + 1
  // Si la hoja no trae la columna de folio, se asume que todo es formulario:
  // así el mapeo del formulario sigue funcionando y el seguimiento queda vacío,
  // lo que la interfaz reporta como esquema incompleto.
  const frontera = indiceFrontera > 0 ? indiceFrontera : encabezados.length + 1
  const ignorables = columnasIgnorables(encabezados, frontera)

  const porNormalizado = new Map<string, number[]>()
  encabezados.forEach((texto, i) => {
    const indice = i + 1
    if (!texto?.trim() || ignorables.has(indice)) return
    const clave = normalizarEncabezado(texto)
    if (!clave) return
    const lista = porNormalizado.get(clave) ?? []
    lista.push(indice)
    porNormalizado.set(clave, lista)
  })

  const columnasPorCampo = Object.fromEntries(
    (Object.keys(ALIAS) as CampoLogico[]).map((campo) => [campo, [] as number[]]),
  ) as Record<CampoLogico, number[]>

  const usadas = new Set<number>()

  for (const campo of Object.keys(ALIAS) as CampoLogico[]) {
    const esDeSeguimiento = CAMPOS_COLUMNA_UNICA.includes(campo)
    for (const alias of ALIAS[campo]) {
      for (const columna of porNormalizado.get(alias) ?? []) {
        // Cada campo solo admite columnas de su propia zona.
        const enZonaSeguimiento = columna >= frontera
        if (esDeSeguimiento !== enZonaSeguimiento) continue
        columnasPorCampo[campo].push(columna)
        usadas.add(columna)
      }
    }
    columnasPorCampo[campo].sort((a, b) => a - b)
    // En la zona de la mesa cada campo tiene una sola columna buena; si el
    // encabezado se repitiera, la válida es la primera.
    if (esDeSeguimiento && columnasPorCampo[campo].length > 1) {
      columnasPorCampo[campo] = [columnasPorCampo[campo][0]]
    }
  }

  const columnasAdjuntos: { columna: number; etiqueta: string }[] = []
  encabezados.forEach((texto, i) => {
    const indice = i + 1
    if (!texto?.trim() || ignorables.has(indice)) return
    const clave = normalizarEncabezado(texto)
    if (PATRONES_ADJUNTO.some((p) => clave.includes(p))) {
      columnasAdjuntos.push({ columna: indice, etiqueta: etiquetaAdjunto(texto) })
    }
  })

  const indicesSinResolver = encabezados
    .map((texto, i) => ({ texto, indice: i + 1 }))
    .filter(
      ({ texto, indice }) =>
        Boolean(texto?.trim()) &&
        !usadas.has(indice) &&
        !ignorables.has(indice) &&
        !columnasAdjuntos.some((a) => a.columna === indice),
    )
    .map(({ indice }) => indice)

  return { columnasPorCampo, columnasAdjuntos, indicesSinResolver }
}

/** Los encabezados de adjuntos son frases largas; se acortan para la interfaz. */
function etiquetaAdjunto(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim().replace(/^(Favor de |Adjuntar |Subir )/i, '')
  const corto = limpio.length > 60 ? `${limpio.slice(0, 57)}…` : limpio
  return corto.charAt(0).toUpperCase() + corto.slice(1)
}

export function rangoDeLectura(mapa: MapaEsquema): string {
  const usadas = [
    ...Object.values(mapa.columnasPorCampo).flat(),
    ...mapa.columnasAdjuntos.map((a) => a.columna),
  ]
  const ultima = Math.max(...usadas)
  return `A2:${letraColumna(ultima)}`
}
