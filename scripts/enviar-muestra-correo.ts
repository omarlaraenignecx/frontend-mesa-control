/**
 * Manda las muestras del diseño del correo a una bandeja de verdad, para aprobarlo.
 *
 *   pnpm dotenv -e .env.local -- pnpm tsx scripts/enviar-muestra-correo.ts <correo> [--de-verdad]
 *
 * Sin `--de-verdad` solo enseña la estructura del mensaje y no manda nada, que es lo
 * que conviene hacer primero.
 *
 * Va por el **mismo camino que un correo del sistema** —`renderCorreo`, `componerMime`
 * y `enviarCorreo`, con la credencial de la mesa— y no por una copia parecida. Es la
 * única forma de comprobar lo que de verdad estaba en duda: que el logo viaje dentro
 * del mensaje y que el cliente de correo lo dibuje. Un HTML abierto en el navegador no
 * demuestra nada de eso.
 *
 * Sale del buzón de la mesa también la muestra del ramo, porque es el único token que
 * un script tiene a la mano. En producción esa sale por la cuenta de siniestros; lo
 * que cambia es el remitente del sobre, no una sola línea del diseño.
 */
import { renderCadena } from '@/lib/correo/cadena'
import { componerMime } from '@/lib/correo/mime'
import { MARCA_MESA, remitenteDe, type MarcaCorreo } from '@/lib/correo/marca'
import { renderCorreo, type Variables } from '@/lib/correo/render-correo'
import { accessTokenDeLaMesa } from '@/lib/google/auth-mesa'
import { enviarCorreo, type MensajeSalida } from '@/lib/google/gmail-send'
import type { Hilo } from '@/lib/google/gmail-thread'

const CORREO_MESA = process.env.MESA_CORREO ?? 'mesadecontrol@gplusseguros.mx'

const MARCA_SINIESTROS: MarcaCorreo = {
  titulo: 'Atención a Siniestros',
  firma: {
    nombre: 'José Juan Mendoza Díaz',
    puesto: 'Ejecutivo de Atención a Siniestros',
    telefono: '55 4884 2862',
    correo: 'jose.mendoza@gplusseguros.mx',
  },
  muestraQuienAtiende: false,
}

const V_MESA: Variables = {
  solicitante: 'Ricardo Hernández',
  folio: '9014',
  agencia: 'CHEVROLET CAMPESTRE',
  tramite: 'Emisión',
  atiende: 'Keynor Rivas',
}

const V_RAMO: Variables = {
  solicitante: 'María Fernanda Ruiz',
  folio: '9021',
  agencia: 'NISSAN VALLE',
  tramite: '',
  atiende: 'José Juan Mendoza Díaz',
  cliente: 'María Fernanda Ruiz',
  aseguradora: 'Quálitas',
  numeroSiniestro: 'S-2026-44871',
  poliza: '0132-8891-2',
  tipoSiniestro: 'Colisión',
}

const CUERPO_MESA = `Buen día Ricardo,

Recibimos tu solicitud de Emisión con folio 9014 para CHEVROLET CAMPESTRE.

Para continuar necesitamos la factura de la unidad y la identificación oficial del titular. En cuanto las tengamos, emitimos la póliza el mismo día.

Quedamos pendientes de tu respuesta para continuar.`

const CUERPO_RAMO = `Estimada María Fernanda,

Reciba un cordial saludo. Le escribo para dar seguimiento al siniestro S-2026-44871 de la póliza 0132-8891-2 con Quálitas, a nombre de María Fernanda Ruiz, registrado con el folio 9021.

El ajustador ya cargó el dictamen y la aseguradora autorizó la reparación. El taller nos confirmó que su unidad entra el lunes 14 y el tiempo estimado es de cinco días hábiles.

Quedo a sus órdenes para cualquier duda o para acompañarle en lo que necesite.`

const HILO: Hilo = {
  threadId: 'muestra',
  mensajes: [
    {
      id: 'm1',
      messageId: '<m1@gplusseguros.mx>',
      autor: 'Mesa de Control',
      correoAutor: CORREO_MESA,
      deLaMesa: true,
      fechaIso: '2026-09-01T10:12:00',
      texto: 'Buen día, recibimos la solicitud con folio 9014. Nos falta la factura de la unidad.',
      adjuntos: [],
    },
    {
      id: 'm2',
      messageId: '<m2@garantiplus.mx>',
      autor: 'Ricardo Hernández',
      correoAutor: 'comercial28@garantiplus.mx',
      deLaMesa: false,
      fechaIso: '2026-09-01T14:38:00',
      texto: 'Va la factura y la identificación del titular. Quedo atento.',
      adjuntos: [
        { id: 'a1', nombre: 'factura-unidad.pdf', tipo: 'application/pdf', bytes: 184320 },
        { id: 'a2', nombre: 'ine-titular.jpg', tipo: 'image/jpeg', bytes: 96000 },
      ],
    },
    {
      id: 'm3',
      messageId: '<m3@gplusseguros.mx>',
      autor: 'Mesa de Control',
      correoAutor: CORREO_MESA,
      deLaMesa: true,
      fechaIso: '2026-09-02T09:05:00',
      texto: 'Gracias. La póliza queda emitida hoy y te la enviamos por este mismo correo.',
      adjuntos: [],
    },
  ],
}

const para = process.argv[2]
const deVerdad = process.argv.includes('--de-verdad')
if (!para?.includes('@')) {
  console.error('Falta el correo de destino.')
  process.exit(1)
}

const mesa = renderCorreo(CUERPO_MESA, V_MESA, MARCA_MESA)
const ramo = renderCorreo(CUERPO_RAMO, V_RAMO, MARCA_SINIESTROS)
const reenvio = renderCadena(
  HILO,
  {
    folio: '9014',
    tramite: 'Emisión',
    nota: 'Les comparto la conversación completa del caso para que puedan revisarla.',
    atiende: 'Keynor Rivas',
  },
  MARCA_MESA,
)

const muestras: { etiqueta: string; mensaje: MensajeSalida }[] = [
  {
    etiqueta: 'Mesa de Control · respuesta a una agencia',
    mensaje: {
      de: remitenteDe(MARCA_MESA, CORREO_MESA),
      para,
      cc: [],
      asunto: '[Muestra 1 de 3] Seguimiento de Caso | Gplus Seguros | 9014',
      ...mesa,
      adjuntos: [],
    },
  },
  {
    etiqueta: 'Atención a Siniestros · respuesta a un cliente',
    mensaje: {
      de: remitenteDe(MARCA_SINIESTROS, CORREO_MESA),
      para,
      cc: [],
      asunto: '[Muestra 2 de 3] Seguimiento de Caso | Gplus Seguros | 9021',
      ...ramo,
      adjuntos: [],
    },
  },
  {
    etiqueta: 'Reenvío de la conversación a un tercero',
    mensaje: {
      de: remitenteDe(MARCA_MESA, CORREO_MESA),
      para,
      cc: [],
      asunto: '[Muestra 3 de 3] Conversación del caso 9014 | Gplus Seguros',
      ...reenvio,
      adjuntos: [],
    },
  },
]

/** La estructura del mensaje, sin los kilobytes de base64 que la esconden. */
function estructura(mime: string): string {
  return mime
    .split('\r\n')
    .filter((l) => /^(Content-|From:|To:|Subject:|--)/.test(l))
    .map((l) => (l.length > 96 ? `${l.slice(0, 93)}…` : l))
    .join('\n')
}

for (const { etiqueta, mensaje } of muestras) {
  console.log(`\n=== ${etiqueta} ===`)
  console.log(estructura(componerMime(mensaje)))
}

if (!deVerdad) {
  console.log('\nNada enviado. Repite con --de-verdad para mandarlas.')
  process.exit(0)
}

async function enviarTodas() {
  const deps = {
    fetch: globalThis.fetch,
    accessToken: await accessTokenDeLaMesa(),
    correoBuzon: CORREO_MESA,
  }

  for (const { etiqueta, mensaje } of muestras) {
    const { id } = await enviarCorreo(deps, mensaje)
    console.log(`Enviada «${etiqueta}» a ${para} — ${id}`)
  }
}

enviarTodas().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
