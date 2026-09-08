/**
 * La identidad de Gplus Seguros tal como se ve en un correo: sus colores y quién
 * firma.
 *
 * Vive aparte de los renderizadores porque los dos —la respuesta al caso y el
 * reenvío de la conversación— tienen que verse igual. Cuando cada uno llevaba sus
 * colores escritos adentro, se parecían por casualidad.
 */

/**
 * Los colores salen del logo, no de una elección de diseño: son los que el archivo
 * de la marca trae dentro.
 *
 * El cian es el color de Gplus, pero sobre blanco no da contraste suficiente para
 * leer texto —2.3 a 1, cuando lo mínimo aceptable es 4.5—, así que hace de franja y
 * de borde, y **nunca de texto**. Para lo que se lee está el azul profundo, que es el
 * mismo color de la marca dos tonos abajo y sí cumple.
 */
export const PALETA = {
  /** #00afc5 del logo. Franjas, bordes y acentos. Nunca texto. */
  cian: '#00afc5',
  /** #007797 del logo. El color de los enlaces y de los rótulos. */
  profundo: '#007797',
  /** El casi negro del logo, para los títulos. */
  tinta: '#1d1d1b',
  /** El gris de «SEGUROS» en el logo. */
  gris: '#7c7c7c',

  // Derivados, para el chasis del correo.
  texto: '#2b3440',
  textoTenue: '#6b7683',
  fondo: '#eef2f5',
  tarjeta: '#ffffff',
  borde: '#e2e8ed',
  /** Fondo de la banda del área y del aviso: el cian rebajado casi hasta el blanco. */
  cianSuave: '#f0fafc',
  pie: '#f6f8fa',
} as const

export const CORREO_MESA = 'mesadecontrol@gplusseguros.mx'

/**
 * La identidad con la que sale un correo: qué área lo firma y con qué datos cierra.
 *
 * Existe porque hay dos áreas escribiendo desde la misma herramienta y no firman
 * igual: la Mesa de Control firma como equipo —«Atiende: quien lo tomó»— y Atención a
 * Siniestros firma como la persona que lleva el caso, con su puesto y su teléfono,
 * porque del otro lado hay un cliente con un siniestro encima y quiere saber a quién
 * le está hablando.
 *
 * Lo que **no** trae es color. Lo traía —un azul por área—, y era un error: quien
 * recibe el correo es cliente de Gplus Seguros y no tiene por qué encontrarse dos
 * marcas según a qué área le escribió. El área se distingue por el rótulo, que es
 * información, y no por el color, que aquí solo confundía.
 */
export type MarcaCorreo = {
  /** Rótulo del área, bajo el logo. */
  titulo: string
  firma: {
    nombre: string
    puesto: string | null
    telefono: string | null
    correo: string
  }
  /** Si el pie dice además quién del equipo está atendiendo. */
  muestraQuienAtiende: boolean
}

/** La marca de la Mesa de Control: firma como equipo y dice quién tomó el caso. */
export const MARCA_MESA: MarcaCorreo = {
  titulo: 'Mesa de Control',
  firma: {
    nombre: 'Mesa de Control — Gplus Seguros',
    puesto: null,
    telefono: null,
    correo: CORREO_MESA,
  },
  muestraQuienAtiende: true,
}

/**
 * Cómo se anuncia el remitente en la cabecera del mensaje.
 *
 * El correo va aparte y no sale de `marca.firma`: el `From` **tiene que ser la cuenta
 * autenticada** con la que se está llamando a Gmail. Cuando no lo es, Gmail no falla
 * —lo reescribe en silencio, salvo que sea un alias verificado—, así que confiar en
 * el `From` que uno puso es engañarse. La firma del pie es otra cosa: son los datos de
 * contacto de la persona, y con el buzón provisional encendido no coinciden.
 */
export function remitenteDe(marca: MarcaCorreo, correoBuzon: string): string {
  return `${marca.titulo} | Gplus Seguros <${correoBuzon}>`
}
