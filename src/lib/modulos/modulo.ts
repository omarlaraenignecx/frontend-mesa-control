import { esSiniestro } from '@/lib/casos/area'
import type { Caso } from '@/lib/casos/caso'
import {
  ESTATUS_ABIERTOS,
  ESTATUS_POR_OMISION,
  type CampoClasificacion,
} from '@/lib/casos/cola'

/**
 * Los dos módulos de la herramienta. La Mesa de Control y la Atención a Siniestros
 * comparten la hoja, la sesión, los folios y el motor de avisos; lo que cambia es
 * qué casos les toca, cómo se llaman, a dónde llevan sus enlaces y desde qué buzón
 * escriben.
 *
 * Se declaran como datos y no como dos copias de la interfaz: el listado, los
 * filtros y los avisos reciben el módulo y se comportan según lo que diga. Una
 * pantalla duplicada obligaría a arreglar dos veces cada cosa.
 */
export type Modulo = 'mesa' | 'siniestros'

/**
 * Con qué campo clasifica sus casos cada módulo, y cómo se llama eso en la
 * pantalla. El ramo clasifica por tipo de siniestro: Daño parcial, Pérdida total,
 * Asistencia vial, Asistencia legal.
 */
export type Clasificacion = {
  campo: CampoClasificacion
  /** Nombre del parámetro en la URL. */
  param: string
  /** Encabezado de la columna en la tabla del listado. */
  columna: string
  /** Etiqueta accesible del selector. */
  filtro: string
  /** Texto de la opción que no filtra nada. */
  todos: string
}

/**
 * Campos de texto del caso que un módulo puede mostrar como columna propia del
 * listado. La unión es cerrada a propósito: una columna se declara, no se calcula.
 */
export type CampoColumna = 'numeroSiniestro' | 'tipoAtencion' | 'nombreCliente'

export type ConfigModulo = {
  clave: Modulo
  titulo: string
  rutaLista: string
  rutaCaso: (fila: number) => string
  /** Pantalla de ajustes propia, o `null` si el módulo todavía no tiene una. */
  ajustes: { ruta: string; soloAdmin: boolean } | null
  /** Qué casos de la hoja le tocan a este módulo. */
  incluye: (caso: Caso) => boolean
  clasificacion: Clasificacion
  /**
   * Qué estatus muestra el listado cuando nadie ha tocado el filtro, y cómo se
   * llama eso en pantalla.
   */
  estatusPorOmision: { valores: string[]; etiqueta: string }
  /** Columnas del listado propias del módulo, además de las comunes. */
  columnasExtra: { encabezado: string; campo: CampoColumna }[]
  /**
   * Si este módulo ofrece generar los folios que falten.
   *
   * Solo la mesa. El folio es una serie única para toda la hoja y el arrastre llena
   * la columna entera, así que el botón actúa igual desde donde se aprete: tenerlo
   * en dos pantallas sería el mismo botón dos veces.
   */
  generaFolios: boolean
}

export const MESA: ConfigModulo = {
  clave: 'mesa',
  titulo: 'Mesa de Control',
  rutaLista: '/fila',
  rutaCaso: (fila) => `/caso/${fila}`,
  ajustes: { ruta: '/ajustes', soloAdmin: true },
  /**
   * Todo, siniestros incluidos. Es decisión del área: la fila de la mesa siguió
   * mostrándolos al abrirse el módulo del ramo, porque quitarlos de ahí sería una
   * mudanza y lo que se pidió fue una vista adicional. Abrir uno desde aquí
   * redirige a su módulo, para que la respuesta no salga del buzón equivocado.
   */
  incluye: () => true,
  clasificacion: {
    campo: 'tipoTramite',
    param: 'tramite',
    columna: 'Trámite',
    filtro: 'Filtrar por trámite',
    todos: 'Todos los trámites',
  },
  estatusPorOmision: { valores: ESTATUS_POR_OMISION, etiqueta: 'Pendientes' },
  columnasExtra: [],
  generaFolios: true,
}

export const SINIESTROS: ConfigModulo = {
  clave: 'siniestros',
  titulo: 'Atención a Siniestros',
  rutaLista: '/siniestros',
  rutaCaso: (fila) => `/siniestros/caso/${fila}`,
  // Sin `soloAdmin`, a diferencia de la mesa: aquí cada quien autoriza su propia
  // cuenta de correo, y exigir ser administrador de la mesa entera para eso daría
  // además la reautorización de su Google y la edición de sus plantillas.
  ajustes: { ruta: '/siniestros/ajustes', soloAdmin: false },
  incluye: esSiniestro,
  clasificacion: {
    campo: 'tipoSiniestro',
    param: 'tipo',
    columna: 'Tipo de siniestro',
    filtro: 'Filtrar por tipo de siniestro',
    todos: 'Todos los siniestros',
  },
  estatusPorOmision: { valores: ESTATUS_ABIERTOS, etiqueta: 'Abiertos' },
  columnasExtra: [{ encabezado: 'Número de siniestro', campo: 'numeroSiniestro' }],
  generaFolios: false,
}

export const MODULOS: ConfigModulo[] = [MESA, SINIESTROS]

/**
 * El módulo con esa clave. Es la puerta por la que un componente de cliente
 * recupera su configuración: las funciones de `ConfigModulo` no se pueden mandar
 * del servidor al cliente, así que lo que viaja es la clave.
 */
export function moduloPorClave(clave: Modulo): ConfigModulo {
  const encontrado = MODULOS.find((m) => m.clave === clave)
  if (!encontrado) throw new Error(`No existe el módulo "${clave}".`)
  return encontrado
}

/**
 * La clave que llega de fuera —un parámetro de la URL— convertida en módulo.
 *
 * Lo desconocido cae en la mesa a propósito: es lo que pedía el navegador antes de
 * que existieran los módulos, así que una pestaña vieja abierta sigue viendo lo que
 * veía en lugar de quedarse sin avisos.
 */
export function moduloValido(valor: string | null | undefined): Modulo {
  return MODULOS.some((m) => m.clave === valor) ? (valor as Modulo) : 'mesa'
}

/**
 * A qué módulo pertenece un caso. No es lo mismo que `incluye`: un caso de
 * siniestros aparece en la fila de la mesa, pero pertenece a siniestros, y es este
 * quien decide desde qué buzón se le escribe.
 */
export function moduloDelCaso(caso: Pick<Caso, 'area'>): ConfigModulo {
  return esSiniestro(caso) ? SINIESTROS : MESA
}
