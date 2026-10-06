/**
 * Llena el tiempo de atención de los casos de la mesa que ya estaban cerrados
 * antes de que la aplicación empezara a sellarlo. Ver
 * docs/superpowers/specs/2026-10-06-tiempo-de-atencion-design.md.
 *
 * Uso:
 *   pnpm dotenv -e .env.local -- pnpm tsx scripts/llenar-tiempo-atencion.ts             # simulacro
 *   pnpm dotenv -e .env.local -- pnpm tsx scripts/llenar-tiempo-atencion.ts --escribir  # escribe
 *
 * Se puede correr las veces que haga falta: nunca toca una celda con dato. Usa
 * la credencial de la mesa guardada en la base, como la aplicación, así que
 * escribe en la hoja de `SHEET_ID`: revisa a cuál apunta antes de usar --escribir.
 */
import { esSiniestro } from '@/lib/casos/area'
import { estaVivo } from '@/lib/casos/caso'
import { tiempoASellar } from '@/lib/casos/tiempo-atencion'
import { accessTokenDeLaMesa } from '@/lib/google/auth-mesa'
import { leerCasos } from '@/lib/google/sheet-reader'
import { letraColumna, ubicarColumnaTiempo } from '@/lib/google/sheet-schema'
import { crearColumnaTiempo, escribirTiempos } from '@/lib/google/sheet-writer'

async function main() {
  const escribir = process.argv.includes('--escribir')
  const deps = {
    fetch: globalThis.fetch,
    accessToken: await accessTokenDeLaMesa(),
    sheetId: process.env.SHEET_ID!,
    pestana: process.env.SHEET_PESTANA ?? 'Respuestas de formulario 1',
  }

  // Todos los años: el histórico es justo lo que la cola (2026 en adelante) no ve.
  const { casos, encabezados } = await leerCasos(deps, 0)
  const { columna, existe } = ubicarColumnaTiempo(encabezados)

  const asignaciones: { fila: number; horas: number }[] = []
  let yaTenian = 0
  let sinCierreUsable = 0
  for (const caso of casos) {
    if (esSiniestro(caso) || estaVivo(caso)) continue
    if (caso.tiempoAtencion?.trim()) {
      yaTenian++
      continue
    }
    const horas = tiempoASellar(caso, caso.estatusFinal, caso.fechaAtencionFinal)
    if (horas === null) sinCierreUsable++
    else asignaciones.push({ fila: caso.fila, horas })
  }

  const promedio = asignaciones.length
    ? asignaciones.reduce((s, a) => s + a.horas, 0) / asignaciones.length
    : 0

  console.log(`Hoja: ${deps.sheetId} · pestaña "${deps.pestana}"`)
  console.log(`Columna: ${letraColumna(columna)} (${existe ? 'ya existe' : 'se va a crear'})`)
  console.log(`Casos de la mesa cerrados por llenar: ${asignaciones.length}`)
  console.log(`Ya tenían tiempo: ${yaTenian}`)
  console.log(`Sin fecha de cierre utilizable (se dejan vacíos): ${sinCierreUsable}`)
  console.log(`Promedio de lo que se llenaría: ${promedio.toFixed(2)} h`)
  console.log('Muestra:', asignaciones.slice(0, 5))

  if (!escribir) {
    console.log('\nSimulacro: no se escribió nada. Corre con --escribir para escribir.')
    return
  }
  if (!existe) await crearColumnaTiempo(deps, columna)
  await escribirTiempos(deps, columna, asignaciones)
  console.log(`\nEscritas ${asignaciones.length} filas en ${letraColumna(columna)}.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
