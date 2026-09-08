/**
 * Escribe en disco los correos de ejemplo, para verlos en el navegador antes de que
 * los vea un cliente.
 *
 *   pnpm tsx scripts/vista-previa-correo.ts [carpeta]
 *
 * No toca la base ni Gmail: llama a los mismos renderizadores que usa el envío, con
 * datos inventados. Si un cambio de diseño se ve bien aquí, falta comprobarlo en un
 * correo de verdad —Outlook y Gmail recortan cosas que el navegador respeta—, pero si
 * se ve mal aquí no hace falta mandar nada.
 *
 * La única diferencia con el correo real es el logo: aquí se referencia como archivo
 * suelto porque un navegador no sabe qué es `cid:`; en el correo viaja dentro.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Hilo } from '../src/lib/google/gmail-thread'
import { renderCadena } from '../src/lib/correo/cadena'
import { MARCA_MESA, type MarcaCorreo } from '../src/lib/correo/marca'
import { LOGO_GPLUS } from '../src/lib/correo/marca/logo'
import { renderCorreo, type Variables } from '../src/lib/correo/render-correo'

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
  threadId: 'hilo-demo',
  mensajes: [
    {
      id: 'm1',
      messageId: '<m1@gplusseguros.mx>',
      autor: 'Mesa de Control',
      correoAutor: 'mesadecontrol@gplusseguros.mx',
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
        { nombre: 'factura-unidad.pdf', bytes: 184320, tipo: 'application/pdf', id: 'a1' },
        { nombre: 'ine-titular.jpg', bytes: 96000, tipo: 'image/jpeg', id: 'a2' },
      ],
    },
    {
      id: 'm3',
      messageId: '<m3@gplusseguros.mx>',
      autor: 'Mesa de Control',
      correoAutor: 'mesadecontrol@gplusseguros.mx',
      deLaMesa: true,
      fechaIso: '2026-09-02T09:05:00',
      texto: 'Gracias. La póliza queda emitida hoy y te la enviamos por este mismo correo.',
      adjuntos: [],
    },
  ],
}

/** El navegador no entiende `cid:`; el cliente de correo sí. */
const paraNavegador = (html: string) =>
  html.replaceAll(`cid:${LOGO_GPLUS.cid}`, LOGO_GPLUS.nombre)

const carpeta = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../.vista-previa'))
mkdirSync(carpeta, { recursive: true })

const muestras = [
  ['mesa-respuesta.html', renderCorreo(CUERPO_MESA, V_MESA, MARCA_MESA).html],
  ['siniestros-respuesta.html', renderCorreo(CUERPO_RAMO, V_RAMO, MARCA_SINIESTROS).html],
  [
    'mesa-reenvio.html',
    renderCadena(
      HILO,
      {
        folio: '9014',
        tramite: 'Emisión',
        nota: 'Les comparto la conversación completa del caso para que puedan revisarla.',
        atiende: 'Keynor Rivas',
      },
      MARCA_MESA,
    ).html,
  ],
] as const

for (const [nombre, html] of muestras) {
  writeFileSync(join(carpeta, nombre), paraNavegador(html))
}
writeFileSync(join(carpeta, LOGO_GPLUS.nombre), Buffer.from(LOGO_GPLUS.base64, 'base64'))

console.log(`Vista previa en ${carpeta}:`)
for (const [nombre] of muestras) console.log(`  ${nombre}`)
