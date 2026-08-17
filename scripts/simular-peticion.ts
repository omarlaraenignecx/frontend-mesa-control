/**
 * Simula la llegada de una petición del formulario, para probar las
 * notificaciones sin esperar a que alguien llene el formulario de verdad.
 *
 * Imita lo que hace Google Forms: **inserta** una fila justo después de la última
 * respuesta, empujando hacia abajo las filas pre-arrastradas que solo traen folio.
 * Esa mecánica importa: es la que hace inútil detectar filas nuevas por conteo.
 *
 * Uso:
 *   pnpm dotenv -e .env.local -- pnpm tsx scripts/simular-peticion.ts crear
 *   pnpm dotenv -e .env.local -- pnpm tsx scripts/simular-peticion.ts borrar <fila>
 *
 * Requisitos:
 * - `gcloud` autenticado con la cuenta de servicio del proyecto.
 * - Que esa cuenta sea **editora del rango protegido** que cubre la columna `A` de
 *   la hoja de prueba. Sin eso, Google responde "You are trying to edit a
 *   protected cell or object": las columnas del formulario están protegidas y ni
 *   la credencial de la mesa ni la cuenta de servicio pueden escribir ahí.
 */
import { execFileSync } from 'node:child_process'

/** La hoja productiva. Este script jamás debe tocarla. */
const HOJA_PRODUCTIVA = '1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0'

const SHEET_ID = process.env.SHEET_ID
const PESTANA = process.env.SHEET_PESTANA ?? 'Respuestas de formulario 1'

/** Columnas que llena una respuesta del formulario, según el mapeo del esquema. */
const CAMPOS: Record<string, string> = {
  N: 'Emisión', // tipo de trámite
  AB: 'PRUEBA DE NOTIFICACIONES', // nombre del solicitante
  AD: 'prueba.notificaciones@garantiplus.mx', // correo de origen
  BC: 'AGENCIA DE PRUEBA', // agencia externa
  BD: 'EXTERNA',
}

function token(): string {
  return execFileSync(
    'gcloud',
    ['auth', 'print-access-token', '--scopes=https://www.googleapis.com/auth/spreadsheets'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .at(-1)!
}

async function pedir(ruta: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const cuerpo = (await r.json()) as Record<string, unknown>
  if (!r.ok) {
    const mensaje = (cuerpo.error as { message?: string } | undefined)?.message ?? r.status
    throw new Error(`Sheets respondió ${r.status}: ${mensaje}`)
  }
  return cuerpo
}

function rango(celdas: string): string {
  return encodeURIComponent(`${PESTANA}!${celdas}`)
}

async function gid(): Promise<number> {
  const meta = (await pedir('?fields=sheets.properties')) as {
    sheets: { properties: { sheetId: number; title: string } }[]
  }
  const hoja = meta.sheets.find((s) => s.properties.title === PESTANA)
  if (!hoja) throw new Error(`La pestaña "${PESTANA}" no existe en esta hoja.`)
  return hoja.properties.sheetId
}

/** La última fila con marca temporal: donde el formulario insertaría la siguiente. */
async function ultimaRespuesta(): Promise<number> {
  const { values } = (await pedir(`/values/${rango('A2:A')}`)) as { values?: string[][] }
  const filas = values ?? []
  for (let i = filas.length - 1; i >= 0; i--) {
    if ((filas[i]?.[0] ?? '').trim()) return i + 2
  }
  throw new Error('La hoja no tiene ninguna respuesta.')
}

function marcaDeAhora(): string {
  // Formato de la hoja: D/M/YYYY H:MM:SS, en la hora de la mesa (UTC−6).
  const ahora = new Date(Date.now() - 6 * 60 * 60 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${ahora.getUTCDate()}/${ahora.getUTCMonth() + 1}/${ahora.getUTCFullYear()} ${ahora.getUTCHours()}:${p(ahora.getUTCMinutes())}:${p(ahora.getUTCSeconds())}`
}

async function crear(): Promise<void> {
  const hoja = await gid()
  const fila = (await ultimaRespuesta()) + 1

  await pedir(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            range: { sheetId: hoja, dimension: 'ROWS', startIndex: fila - 1, endIndex: fila },
            // Sin heredar: la petición nueva llega con el folio vacío, que es
            // justo lo que la generación automática tiene que resolver.
            inheritFromBefore: false,
          },
        },
      ],
    }),
  })

  await pedir('/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${PESTANA}!A${fila}`, values: [[marcaDeAhora()]] },
        ...Object.entries(CAMPOS).map(([col, valor]) => ({
          range: `${PESTANA}!${col}${fila}`,
          values: [[valor]],
        })),
      ],
    }),
  })

  console.log(`Petición simulada en la fila ${fila}, sin folio.`)
  console.log(`Para deshacerla: pnpm dotenv -e .env.local -- pnpm tsx scripts/simular-peticion.ts borrar ${fila}`)
}

async function borrar(fila: number): Promise<void> {
  const hoja = await gid()
  const { values } = (await pedir(`/values/${rango(`AB${fila}`)}`)) as { values?: string[][] }
  const nombre = values?.[0]?.[0] ?? ''
  if (nombre !== CAMPOS.AB) {
    throw new Error(
      `La fila ${fila} no es una petición simulada (AB dice "${nombre}"). No se borra nada.`,
    )
  }

  await pedir(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: { sheetId: hoja, dimension: 'ROWS', startIndex: fila - 1, endIndex: fila },
          },
        },
      ],
    }),
  })
  console.log(`Fila ${fila} eliminada; la hoja quedó como estaba.`)
}

async function main(): Promise<void> {
  if (!SHEET_ID) throw new Error('Falta SHEET_ID.')
  if (SHEET_ID === HOJA_PRODUCTIVA) {
    throw new Error(
      'SHEET_ID apunta a la hoja PRODUCTIVA. Este script inserta y borra filas: solo corre contra la copia de pruebas.',
    )
  }

  const [orden, arg] = process.argv.slice(2)
  if (orden === 'crear') await crear()
  else if (orden === 'borrar' && arg) await borrar(Number(arg))
  else {
    console.log('Uso: crear | borrar <fila>')
    process.exitCode = 1
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
