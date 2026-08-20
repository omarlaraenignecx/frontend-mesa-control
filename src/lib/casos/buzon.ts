import { MARCA_MESA, remitenteDe, type MarcaCorreo } from '@/lib/correo/render-correo'
import { accessTokenDeLaMesa } from '@/lib/google/auth-mesa'
import type { DepsGmail } from '@/lib/google/gmail-thread'
import { moduloDelCaso } from '@/lib/modulos/modulo'
import { buzonDeSiniestros } from '@/lib/siniestros/auth'
import type { Caso } from './caso'
import { CORREO_MESA } from './hilo'

/**
 * Por qué buzón se escribe y se lee un caso.
 *
 * La clave del diseño está en el parámetro: **el buzón se deriva del caso**, del área
 * que declaró el solicitante en el formulario, y no de la pantalla desde la que
 * alguien pulsó Enviar. Así no hay forma de que una respuesta salga del área
 * equivocada por haber entrado por la URL de al lado, ni de que el chat lea la
 * conversación en un buzón donde no vive.
 */
export type BuzonDelCaso = {
  deps: DepsGmail
  /** Remitente completo, con nombre visible, para la cabecera del mensaje. */
  remitente: string
  marca: MarcaCorreo
  /**
   * El correo está saliendo por el buzón de la mesa porque el módulo de siniestros
   * todavía no tiene cuenta propia y alguien encendió el interruptor provisional.
   * Quien lo reciba tiene que decirlo en pantalla.
   */
  provisional: boolean
}

/** Cómo firma un caso de siniestros: la ficha del ejecutivo designado. */
function marcaDeSiniestros(
  correoBuzon: string,
  ficha: { correo: string; nombre: string; puesto: string; telefono: string } | null,
): MarcaCorreo {
  return {
    titulo: 'Atención a Siniestros',
    // Un azul más profundo que el de la mesa. Del otro lado hay un cliente con un
    // siniestro encima; el tono de la banda es parte de cómo se le habla.
    color: '#0f3d5c',
    firma: {
      nombre: ficha?.nombre?.trim() || 'Atención a Siniestros — Gplus Seguros',
      puesto: ficha?.puesto?.trim() || null,
      telefono: ficha?.telefono?.trim() || null,
      /**
       * El correo de la **ficha**, no el del buzón. Normalmente son el mismo; con el
       * buzón provisional encendido no lo son, y ahí lo correcto es el de la ficha:
       * el área pidió que el correo cierre con los datos de contacto del ejecutivo
       * que atiende el caso, y ése es su correo. Que el sobre venga de otro buzón es
       * exactamente lo que la banda de aviso está denunciando en pantalla.
       */
      correo: ficha?.correo?.trim() || correoBuzon,
    },
    // La mesa firma como equipo y dice quién tomó el caso. Siniestros firma con la
    // persona que lo lleva, así que decir «Atiende:» además sería repetirlo —o peor,
    // contradecirlo cuando escribe alguien más desde la misma cuenta—.
    muestraQuienAtiende: false,
  }
}

export async function buzonDelCaso(caso: Pick<Caso, 'area'>): Promise<BuzonDelCaso> {
  if (moduloDelCaso(caso).clave === 'mesa') {
    return {
      deps: {
        fetch: globalThis.fetch,
        accessToken: await accessTokenDeLaMesa(),
        correoBuzon: CORREO_MESA,
      },
      remitente: remitenteDe(MARCA_MESA, CORREO_MESA),
      marca: MARCA_MESA,
      provisional: false,
    }
  }

  const buzon = await buzonDeSiniestros()
  // La firma es la del ejecutivo designado incluso con el buzón provisional: el
  // cliente tiene que saber quién lleva su siniestro, aunque el sobre venga de la
  // mesa mientras se autoriza la cuenta. Que el sobre y la firma no coincidan es
  // precisamente lo que la banda de aviso en pantalla está denunciando.
  const marca = marcaDeSiniestros(buzon.correo, buzon.ficha)
  return {
    deps: {
      fetch: globalThis.fetch,
      accessToken: buzon.accessToken,
      correoBuzon: buzon.correo,
    },
    remitente: remitenteDe(marca, buzon.correo),
    marca,
    provisional: buzon.provisional,
  }
}
