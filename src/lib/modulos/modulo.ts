import { esSiniestro } from '@/lib/casos/area'
import type { Caso } from '@/lib/casos/caso'
import type { CampoClasificacion } from '@/lib/casos/cola'

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

export type ConfigModulo = {
  clave: Modulo
  titulo: string
  rutaLista: string
  rutaCaso: (fila: number) => string
  rutaAjustes: string
  /** Qué casos de la hoja le tocan a este módulo. */
  incluye: (caso: Caso) => boolean
  clasificacion: Clasificacion
}

export const MESA: ConfigModulo = {
  clave: 'mesa',
  titulo: 'Mesa de Control',
  rutaLista: '/fila',
  rutaCaso: (fila) => `/caso/${fila}`,
  rutaAjustes: '/ajustes',
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
}

export const SINIESTROS: ConfigModulo = {
  clave: 'siniestros',
  titulo: 'Atención a Siniestros',
  rutaLista: '/siniestros',
  rutaCaso: (fila) => `/siniestros/caso/${fila}`,
  rutaAjustes: '/siniestros/ajustes',
  incluye: esSiniestro,
  clasificacion: {
    campo: 'tipoSiniestro',
    param: 'tipo',
    columna: 'Tipo de siniestro',
    filtro: 'Filtrar por tipo de siniestro',
    todos: 'Todos los siniestros',
  },
}

export const MODULOS = [MESA, SINIESTROS] as const

/**
 * A qué módulo pertenece un caso. No es lo mismo que `incluye`: un caso de
 * siniestros aparece en la fila de la mesa, pero pertenece a siniestros, y es este
 * quien decide desde qué buzón se le escribe.
 */
export function moduloDelCaso(caso: Pick<Caso, 'area'>): ConfigModulo {
  return esSiniestro(caso) ? SINIESTROS : MESA
}
