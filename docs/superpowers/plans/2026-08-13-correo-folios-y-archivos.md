# Correo del solicitante, generación de folios y archivos de la mesa — Plan de implementación

> **Para quien ejecuta:** las tres tareas son independientes entre sí y se hacen **en orden**, una por commit. Cada paso trae el código completo; no hay nada por inventar.

**Objetivo:** mostrar el correo del solicitante en la tabla de la fila; sustituir la captura manual de folio por un botón que continúa la serie y llena todos los faltantes de una vez; y permitir que la mesa suba sus propios archivos al caso.

**Arquitectura:** los tres cambios respetan las reglas que ya rigen el proyecto. El correo no toca la capa de datos —el campo ya se lee—. Los folios se calculan en un módulo puro y se escriben en un solo lote por la misma puerta que ya existe, con revalidación previa de cada fila. Los archivos no pueden ir a la hoja porque las columnas del formulario están protegidas sin editores, así que viven en el Drive de `mesadecontrol@` y su registro en Postgres.

**Tecnologías:** Next.js 16 App Router, React 19, Server Actions, Route Handlers, Google Sheets API v4, Google Drive API v3, Drizzle + Postgres, Vitest.

## Restricciones globales

- **Nunca se escribe fuera de la lista blanca.** La única columna del formulario que la app toca es `JY` (folio), y solo cuando está vacía. `A` y `B`–`JX` están protegidas sin editores en la hoja real: un intento devolvería 403.
- **Ninguna escritura sin revalidar la fila.** Antes de escribir se relee la marca temporal para confirmar que sigue siendo el mismo registro (`confirmarFila`). Un lote de folios revalida **todas** las filas y aborta completo si una cambió.
- **El folio se deriva del máximo de la columna, nunca de la fila de arriba.** Decisión del área el 13 de agosto de 2026. La hoja real tiene 210 folios duplicados y el mecanismo que los produjo es el arrastre manual: el formulario **inserta** la fila nueva arriba de las filas pre-arrastradas, y continuar desde arriba repite un número que ya está abajo.
- **Las pruebas corren en `environment: 'node'`**, sin DOM ni testing-library. Lo que no es lógica pura se prueba leyendo el archivo fuente (patrón de `src/app/rutas.test.ts` y `src/app/estilos-base.test.ts`) o con dependencias inyectadas (`deps.fetch` falso).
- `pnpm test` fuerza `TZ=UTC`. No usar `new Date(2026, 7, 13)` en pruebas: instantes ISO explícitos.
- Comentarios y textos de interfaz **en español**, con acentos. El código en la convención del repo: nombres de dominio en español.
- Verificación de cada tarea: `pnpm test && pnpm typecheck && pnpm lint`.

---

### Task 1: El correo del solicitante en la tabla de la fila

La columna `AD` de la hoja es `Dirección de correo electrónico` y **ya está mapeada**: `correoSolicitante` agrupa `J` y `AD`, y `construirCasos` devuelve el primer valor no vacío de las dos. No hay nada que agregar en la capa de datos; es un cambio de presentación.

**Files:**
- Modify: `src/app/fila/page.tsx` (encabezados de la tabla ~línea 225, celdas ~línea 264, `colSpan` línea 278)
- Test: `src/app/fila/tabla.test.ts` (crear)

**Interfaces:**
- Consume: `Caso.correoSolicitante` de `src/lib/casos/caso.ts` — ya existe, `string | null`.
- Produce: nada que otra tarea use.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `src/app/fila/tabla.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La tabla no tiene pruebas de render —el proyecto no monta DOM—, pero el orden
 * de las columnas sí es un acuerdo con el área: el correo va pegado antes de la
 * agencia. Esta prueba lee el archivo y lo exige.
 */
const pagina = readFileSync(path.join(process.cwd(), 'src/app/fila/page.tsx'), 'utf8')

const encabezados = [...pagina.matchAll(/<TableHead[^>/]*>([^<]+)<\/TableHead>/g)].map((m) =>
  m[1].trim(),
)

describe('columnas de la tabla de la fila', () => {
  it('existe la columna del correo', () => {
    expect(encabezados).toContain('Correo')
  })

  it('el correo va justo antes de la agencia', () => {
    expect(encabezados.indexOf('Correo')).toBe(encabezados.indexOf('Agencia') - 1)
  })

  it('la celda muestra el correo del solicitante', () => {
    expect(pagina).toContain('caso.correoSolicitante')
  })

  it('la fila de "ningún caso" abarca todas las columnas', () => {
    // Cuenta también el <TableHead className="w-10" /> del semáforo, que va
    // autocerrado y por eso no aparece en `encabezados`.
    const total = [...pagina.matchAll(/<TableHead/g)].length
    expect(pagina).toContain(`colSpan={${total}}`)
  })
})
```

- [ ] **Paso 2: Correr la prueba y verla fallar**

Run: `pnpm vitest run src/app/fila/tabla.test.ts`
Esperado: FAIL. `existe la columna del correo` no encuentra `'Correo'`; `colSpan={10}` no está en el archivo (hoy dice `colSpan={9}`).

- [ ] **Paso 3: Agregar el encabezado**

En `src/app/fila/page.tsx`, dentro de `<TableRow>` del `<TableHeader>`, insertar la celda **antes** de la de Agencia:

```tsx
              <TableHead className="text-base">Solicitante</TableHead>
              <TableHead className="text-base">Correo</TableHead>
              <TableHead className="text-base">Agencia</TableHead>
```

- [ ] **Paso 4: Agregar la celda**

En el `map` de `filtrados`, antes de la celda de `caso.agencia`:

```tsx
                  <TableCell>{caso.nombreSolicitante ?? '—'}</TableCell>
                  <TableCell className="break-all text-muted-foreground">
                    {caso.correoSolicitante ?? '—'}
                  </TableCell>
                  <TableCell>{caso.agencia ?? '—'}</TableCell>
```

`break-all` porque los correos largos no tienen espacios donde cortar y sin esto estiran la tabla.

- [ ] **Paso 5: Corregir el `colSpan`**

```tsx
                <TableCell colSpan={10} className="py-12 text-center text-base text-muted-foreground">
```

- [ ] **Paso 6: Correr las pruebas y verlas pasar**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Esperado: 29+ archivos, todo verde.

- [ ] **Paso 7: Commit**

```bash
git add src/app/fila/page.tsx src/app/fila/tabla.test.ts
git commit -m "feat: muestra el correo del solicitante en la tabla de la fila"
```

---

### Task 2: Botón de generar folios

Sustituye el input de captura manual. Lee toda la columna `JY`, toma el máximo numérico y reparte los consecutivos entre los casos sin folio, en orden de fila. Aparece solo si hay casos sin folio, con formato de aviso, en la vista de la fila y en la del caso.

**Files:**
- Create: `src/lib/casos/folios.ts`
- Test: `src/lib/casos/folios.test.ts`
- Modify: `src/lib/google/sheet-reader.ts` (agregar `leerColumnaFolios`)
- Modify: `src/lib/google/sheet-writer.ts` (`escribirFolios` sustituye a `escribirFolio`)
- Test: `src/lib/google/sheet-writer.test.ts` (reescribir el `describe('escribirFolio')` de la línea 363)
- Modify: `src/lib/casos/consulta.ts` (`cargarCaso` devuelve `sinFolioTotal`)
- Create: `src/app/acciones-folios.ts`
- Create: `src/components/generar-folios.tsx`
- Modify: `src/app/fila/page.tsx`, `src/app/caso/[fila]/page.tsx`
- Modify: `src/app/caso/[fila]/acciones.ts` (quitar `capturarFolio`)
- Delete: `src/app/caso/[fila]/folio-form.tsx`

**Interfaces:**
- Consume: `MapaEsquema`, `DepsLectura`, `FilaCambiadaError`, `sinFolio`, `registrarAccion`, `letraColumna`.
- Produce:
  - `siguienteFolio(valores: string[]): number | null`
  - `asignarFolios(filas: number[], valores: string[]): { fila: number; folio: string }[]`
  - `TOPE_POR_TANDA: number`
  - `leerColumnaFolios(deps: DepsLectura, mapa: MapaEsquema): Promise<string[]>`
  - `escribirFolios(deps, mapa, asignaciones: { fila: number; folio: string }[], testigos: Map<number, string>): Promise<void>`
  - `generarFolios(): Promise<{ ok: true; generados: number } | { ok: false; error: string }>`
  - `<GenerarFolios faltantes={number} />`

- [ ] **Paso 1: Escribir la prueba del cálculo**

Crear `src/lib/casos/folios.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { asignarFolios, siguienteFolio } from './folios'

describe('siguienteFolio', () => {
  it('continúa desde el folio más alto, no desde el último de la columna', () => {
    // Caso real de la hoja: las filas pre-arrastradas dejan 7052-7054 al final,
    // y arriba hay folios mayores del histórico. Seguir "el de abajo" duplicaría.
    expect(siguienteFolio(['7051', '7052', '7053', '7054'])).toBe(7055)
    expect(siguienteFolio(['7060', '7051', '7052'])).toBe(7061)
  })

  it('ignora celdas vacías y valores que no son número', () => {
    expect(siguienteFolio(['', '  ', '7051', 'N/A', 'pendiente'])).toBe(7052)
  })

  it('sin ningún folio numérico no inventa una serie', () => {
    // Devolver 1 sería peor que no hacer nada: significaría que la columna no es
    // la que creemos y hay que mirar la hoja antes de escribir.
    expect(siguienteFolio([])).toBeNull()
    expect(siguienteFolio(['', 'N/A'])).toBeNull()
  })
})

describe('asignarFolios', () => {
  it('reparte consecutivos en orden de fila ascendente', () => {
    expect(asignarFolios([7230, 7228, 7229], ['7051', '7054'])).toEqual([
      { fila: 7228, folio: '7055' },
      { fila: 7229, folio: '7056' },
      { fila: 7230, folio: '7057' },
    ])
  })

  it('sin filas pendientes no devuelve nada', () => {
    expect(asignarFolios([], ['7054'])).toEqual([])
  })

  it('sin serie de la que partir no asigna nada', () => {
    expect(asignarFolios([7228], [])).toEqual([])
  })
})
```

- [ ] **Paso 2: Correr y verla fallar**

Run: `pnpm vitest run src/lib/casos/folios.test.ts`
Esperado: FAIL, `Failed to resolve import "./folios"`.

- [ ] **Paso 3: Escribir el módulo**

Crear `src/lib/casos/folios.ts`:

```ts
/**
 * El folio de atención (columna `JY`) lo llenaba la mesa a mano, arrastrando la
 * serie hacia abajo. Ese arrastre es la causa de los 210 folios duplicados que
 * tiene la hoja: cuando entra una respuesta, el formulario **inserta** la fila
 * arriba de las que ya venían pre-arrastradas, así que continuar desde el folio
 * de la fila de arriba repite un número que ya existe más abajo.
 *
 * Por eso la serie se continúa desde el **máximo de toda la columna**. El
 * resultado puede quedar visualmente desordenado —un 7055 arriba de un 7052—,
 * pero nunca duplica, y el folio es un identificador, no un orden.
 */

/** Más de esto en una sola tanda significa que algo pasó con la hoja. */
export const TOPE_POR_TANDA = 50

/**
 * El folio con el que sigue la serie, o null si la columna no trae ni un valor
 * numérico: en ese caso no se escribe nada y se pide mirar la hoja.
 */
export function siguienteFolio(valoresDeLaColumna: string[]): number | null {
  const numeros = valoresDeLaColumna
    .map((v) => (v ?? '').trim())
    .filter((v) => /^\d+$/.test(v))
    .map(Number)
  if (numeros.length === 0) return null
  return Math.max(...numeros) + 1
}

/**
 * Reparte consecutivos entre las filas sin folio, de la más antigua a la más
 * reciente, que es el orden en que la mesa las habría llenado a mano.
 */
export function asignarFolios(
  filasSinFolio: number[],
  valoresDeLaColumna: string[],
): { fila: number; folio: string }[] {
  const inicio = siguienteFolio(valoresDeLaColumna)
  if (inicio === null) return []
  return [...filasSinFolio]
    .sort((a, b) => a - b)
    .map((fila, i) => ({ fila, folio: String(inicio + i) }))
}
```

- [ ] **Paso 4: Correr y verla pasar**

Run: `pnpm vitest run src/lib/casos/folios.test.ts`
Esperado: PASS, 6 pruebas.

- [ ] **Paso 5: Commit del cálculo**

```bash
git add src/lib/casos/folios.ts src/lib/casos/folios.test.ts
git commit -m "feat: calcula la serie de folios desde el máximo de la columna"
```

- [ ] **Paso 6: Escribir la prueba de la lectura de la columna**

En `src/lib/google/sheet-reader.test.ts`, agregar al final:

```ts
describe('leerColumnaFolios', () => {
  it('lee la columna completa desde la fila 2, incluidas las filas sin datos', () => {
    // Las filas pre-arrastradas traen folio y ninguna otra celda; `construirCasos`
    // las descarta, así que el máximo de la serie solo se ve leyendo la columna.
    const urls: string[] = []
    const deps = {
      fetch: (async (url: string) => {
        urls.push(url)
        return {
          ok: true,
          status: 200,
          json: async () => ({ values: [['7051'], [''], ['7054']] }),
        }
      }) as unknown as typeof globalThis.fetch,
      accessToken: 't',
      sheetId: 'hoja',
      pestana: 'Respuestas de formulario 1',
    }
    const mapa = { columnasPorCampo: { folio: [285] }, columnasAdjuntos: [], indicesSinResolver: [] }

    return leerColumnaFolios(deps, mapa as never).then((valores) => {
      expect(valores).toEqual(['7051', '', '7054'])
      expect(decodeURIComponent(urls[0])).toContain('Respuestas de formulario 1!JY2:JY')
    })
  })
})
```

Agregar `leerColumnaFolios` al `import` que ya encabeza el archivo.

- [ ] **Paso 7: Correr y verla fallar**

Run: `pnpm vitest run src/lib/google/sheet-reader.test.ts`
Esperado: FAIL, `leerColumnaFolios is not exported`.

- [ ] **Paso 8: Implementar la lectura**

En `src/lib/google/sheet-reader.ts`, después de `leerFilas`:

```ts
/**
 * Todos los valores de la columna del folio, desde la fila 2. Se lee la columna
 * entera y no los casos, porque las filas que la mesa pre-arrastró traen folio
 * sin traer petición y son justo las que fijan el máximo de la serie.
 */
export async function leerColumnaFolios(
  deps: DepsLectura,
  mapa: MapaEsquema,
): Promise<string[]> {
  const columna = mapa.columnasPorCampo.folio[0]
  if (!columna) return []
  const letra = letraColumna(columna)
  const filas = await pedirValores(deps, `${letra}2:${letra}`)
  return filas.map((f) => f[0] ?? '')
}
```

- [ ] **Paso 9: Correr y verla pasar**

Run: `pnpm vitest run src/lib/google/sheet-reader.test.ts`
Esperado: PASS.

- [ ] **Paso 10: Escribir la prueba de la escritura en lote**

En `src/lib/google/sheet-writer.test.ts`, **sustituir** el bloque `describe('escribirFolio', …)` de la línea 363 por:

```ts
describe('escribirFolios', () => {
  const mapa = mapaDePrueba() // el ayudante que ya usa el resto del archivo

  function depsQueResponde(
    celdas: Record<string, string>,
    registro: { llamadas: { url: string; body?: unknown }[] },
  ) {
    return {
      fetch: (async (url: string, init?: RequestInit) => {
        registro.llamadas.push({
          url,
          body: init?.body ? JSON.parse(init.body as string) : undefined,
        })
        if (url.includes('values:batchGet')) {
          const rangos = [...new URL(url).searchParams.getAll('ranges')]
          return {
            ok: true,
            status: 200,
            json: async () => ({
              valueRanges: rangos.map((r) => {
                const celda = r.split('!')[1]
                const valor = celdas[celda]
                return valor ? { values: [[valor]] } : {}
              }),
            }),
          }
        }
        return { ok: true, status: 200, json: async () => ({}) }
      }) as unknown as typeof globalThis.fetch,
      accessToken: 't',
      sheetId: 'hoja',
      pestana: 'Hoja',
    }
  }

  it('escribe todos los folios en un solo lote y como número', async () => {
    const registro = { llamadas: [] as { url: string; body?: unknown }[] }
    const deps = depsQueResponde({ A7228: '12/8/2026 13:50', A7229: '12/8/2026 14:00' }, registro)

    await escribirFolios(
      deps,
      mapa,
      [
        { fila: 7228, folio: '7055' },
        { fila: 7229, folio: '7056' },
      ],
      new Map([
        [7228, '12/8/2026 13:50'],
        [7229, '12/8/2026 14:00'],
      ]),
    )

    const escrituras = registro.llamadas.filter((l) => l.url.includes('values:batchUpdate'))
    expect(escrituras).toHaveLength(1)
    // USER_ENTERED y no RAW: la columna es numérica en toda la hoja y RAW
    // dejaría el folio como texto, alineado a la izquierda y fuera de orden.
    expect(escrituras[0].url).toContain('valueInputOption=USER_ENTERED')
    expect((escrituras[0].body as { data: unknown[] }).data).toHaveLength(2)
  })

  it('no escribe nada si una de las filas ya tiene folio', async () => {
    const registro = { llamadas: [] as { url: string; body?: unknown }[] }
    const deps = depsQueResponde(
      { A7228: '12/8/2026 13:50', JY7228: '9999', A7229: '12/8/2026 14:00' },
      registro,
    )

    await expect(
      escribirFolios(
        deps,
        mapa,
        [
          { fila: 7228, folio: '7055' },
          { fila: 7229, folio: '7056' },
        ],
        new Map([
          [7228, '12/8/2026 13:50'],
          [7229, '12/8/2026 14:00'],
        ]),
      ),
    ).rejects.toThrow(FilaCambiadaError)

    expect(registro.llamadas.filter((l) => l.url.includes('batchUpdate'))).toHaveLength(0)
  })

  it('no escribe nada si una marca temporal cambió', async () => {
    const registro = { llamadas: [] as { url: string; body?: unknown }[] }
    const deps = depsQueResponde({ A7228: 'otra fecha' }, registro)

    await expect(
      escribirFolios(deps, mapa, [{ fila: 7228, folio: '7055' }], new Map([[7228, '12/8/2026 13:50']])),
    ).rejects.toThrow(FilaCambiadaError)
    expect(registro.llamadas.filter((l) => l.url.includes('batchUpdate'))).toHaveLength(0)
  })

  it('rechaza folios que no sean dígitos antes de tocar la hoja', async () => {
    const registro = { llamadas: [] as { url: string; body?: unknown }[] }
    const deps = depsQueResponde({}, registro)
    await expect(
      escribirFolios(deps, mapa, [{ fila: 7228, folio: '=SUMA(A1)' }], new Map([[7228, 'x']])),
    ).rejects.toThrow(/dígitos/)
    expect(registro.llamadas).toHaveLength(0)
  })

  it('rechaza un lote con folios repetidos entre sí', async () => {
    const registro = { llamadas: [] as { url: string; body?: unknown }[] }
    const deps = depsQueResponde({}, registro)
    await expect(
      escribirFolios(
        deps,
        mapa,
        [
          { fila: 7228, folio: '7055' },
          { fila: 7229, folio: '7055' },
        ],
        new Map(),
      ),
    ).rejects.toThrow(/repetido/)
    expect(registro.llamadas).toHaveLength(0)
  })
})
```

Si el archivo no tiene un ayudante `mapaDePrueba()`, usar el objeto literal que ya emplean los `describe` anteriores para construir el mapa —hay que leerlo antes de escribir esto y reutilizar exactamente ese ayudante, sin duplicarlo—. El mapa necesita al menos `marcaTemporal: [1]` y `folio: [285]`.

- [ ] **Paso 11: Correr y verla fallar**

Run: `pnpm vitest run src/lib/google/sheet-writer.test.ts`
Esperado: FAIL, `escribirFolios is not exported`.

- [ ] **Paso 12: Implementar la escritura en lote**

En `src/lib/google/sheet-writer.ts`, **sustituir** `escribirFolio` (línea 247 hasta el final) por:

```ts
/**
 * Única vía autorizada para escribir la columna del folio.
 *
 * Escribe todas las filas pendientes en un solo lote, y solo después de
 * comprobar en una sola lectura que las dos condiciones se cumplen en **todas**:
 * la marca temporal sigue siendo la que el usuario vio, y el folio sigue vacío.
 * Si una falla, no se escribe ninguna: un lote a medias dejaría huecos en la
 * serie y nadie sabría por dónde se quedó.
 *
 * Va con `USER_ENTERED` porque la columna es numérica en toda la hoja; el valor
 * son dígitos generados por la aplicación, así que no hay riesgo de que Sheets
 * lo interprete como fórmula o como fecha.
 */
export async function escribirFolios(
  deps: DepsLectura,
  mapa: MapaEsquema,
  asignaciones: { fila: number; folio: string }[],
  testigos: Map<number, string>,
): Promise<void> {
  if (asignaciones.length === 0) return

  for (const { folio } of asignaciones) {
    if (!/^\d+$/.test(folio)) {
      throw new Error(`El folio "${folio}" no son solo dígitos; la herramienta no lo escribe.`)
    }
  }
  const distintos = new Set(asignaciones.map((a) => a.folio))
  if (distintos.size !== asignaciones.length) {
    throw new Error('El lote trae un folio repetido; no se escribe nada.')
  }

  const colFecha = columnaDe(mapa, 'marcaTemporal')
  const colFolio = columnaDe(mapa, 'folio')
  const celda = (columna: number, fila: number) =>
    `${deps.pestana}!${letraColumna(columna)}${fila}`

  const rangos = asignaciones.flatMap(({ fila }) => [
    celda(colFecha, fila),
    celda(colFolio, fila),
  ])
  const url =
    `${BASE}/${deps.sheetId}/values:batchGet?` +
    rangos.map((r) => `ranges=${encodeURIComponent(r)}`).join('&') +
    '&majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE'

  const respuesta = await pedir(deps, url)
  const cuerpo = (await respuesta.json()) as { valueRanges?: { values?: string[][] }[] }
  const leer = (indice: number) =>
    (cuerpo.valueRanges?.[indice]?.values?.[0]?.[0] ?? '').trim() || null

  asignaciones.forEach(({ fila }, i) => {
    const fechaActual = leer(i * 2)
    const esperada = (testigos.get(fila) ?? '').trim() || null
    if (fechaActual !== esperada) {
      throw new FilaCambiadaError({
        campo: 'marca temporal',
        esperado: esperada,
        encontrado: fechaActual,
      })
    }
    const folioActual = leer(i * 2 + 1)
    if (folioActual) {
      throw new FilaCambiadaError({ campo: 'folio', esperado: null, encontrado: folioActual })
    }
  })

  // No se usa `escribirCeldas`: esa función escribe celdas de una sola fila y
  // aquí cada celda va en la suya. El lote se arma a mano.
  await pedir(
    deps,
    `${BASE}/${deps.sheetId}/values:batchUpdate?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: asignaciones.map(({ fila, folio }) => ({
          range: celda(colFolio, fila),
          majorDimension: 'ROWS',
          values: [[folio]],
        })),
      }),
    },
  )
}
```

Cuidado al adaptar: `escribirCeldas` no sirve aquí. Recibe una fila y le pega la letra de cada columna, y este lote necesita una fila distinta por celda. El `batchUpdate` se arma a mano, que es lo que hace el código de arriba.

- [ ] **Paso 13: Correr y verla pasar**

Run: `pnpm vitest run src/lib/google/sheet-writer.test.ts`
Esperado: PASS. El `import` de `escribirFolio` que quedó huérfano en `acciones.ts` lo arregla el paso 15.

- [ ] **Paso 14: Escribir la acción de servidor**

Crear `src/app/acciones-folios.ts`:

```ts
'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { requerirUsuario } from '@/lib/auth/guard'
import { registrarAccion } from '@/lib/casos/bitacora'
import { sinFolio } from '@/lib/casos/caso'
import { depsDeGoogle } from '@/lib/casos/consulta'
import { TOPE_POR_TANDA, asignarFolios } from '@/lib/casos/folios'
import { leerCasos, leerColumnaFolios } from '@/lib/google/sheet-reader'
import { FilaCambiadaError, escribirFolios } from '@/lib/google/sheet-writer'

export type ResultadoFolios = { ok: true; generados: number } | { ok: false; error: string }

/**
 * Llena de una vez la columna del folio en todos los casos que llegaron sin él,
 * continuando la serie desde el máximo de la columna. Sustituye al arrastre
 * manual que la mesa hacía en la hoja.
 */
export async function generarFolios(): Promise<ResultadoFolios> {
  const usuario = await requerirUsuario()
  const deps = await depsDeGoogle()

  const { casos, mapa } = await leerCasos(deps)
  const faltantes = casos.filter(sinFolio).sort((a, b) => a.fila - b.fila)
  if (faltantes.length === 0) return { ok: true, generados: 0 }

  if (faltantes.length > TOPE_POR_TANDA) {
    return {
      ok: false,
      error: `Hay ${faltantes.length} peticiones sin folio, más de las ${TOPE_POR_TANDA} que la herramienta genera de una vez. Revisa la hoja antes de continuar y avisa al desarrollo.`,
    }
  }

  const columna = await leerColumnaFolios(deps, mapa)
  const asignaciones = asignarFolios(
    faltantes.map((c) => c.fila),
    columna,
  )
  if (asignaciones.length === 0) {
    return {
      ok: false,
      error: 'La columna de folio no trae ningún número del que continuar la serie. Revisa la hoja.',
    }
  }

  const testigos = new Map(faltantes.map((c) => [c.fila, c.marcaTemporalTexto]))

  try {
    await escribirFolios(deps, mapa, asignaciones, testigos)
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof FilaCambiadaError
          ? `${e.message} No se generó ningún folio; vuelve a intentarlo.`
          : e instanceof Error
            ? e.message
            : 'No se pudieron generar los folios.',
    }
  }

  for (const { fila, folio } of asignaciones) {
    await registrarAccion(fila, folio, usuario.correo, 'Folio de atención', folio, 'folio_capturado')
  }

  updateTag('casos')
  revalidatePath('/fila')
  for (const { fila } of asignaciones) revalidatePath(`/caso/${fila}`)

  return { ok: true, generados: asignaciones.length }
}
```

- [ ] **Paso 15: Quitar la captura manual**

En `src/app/caso/[fila]/acciones.ts`: borrar la función `capturarFolio` completa (líneas 106-130) y quitar `escribirFolio` del `import` de `sheet-writer`. Si `registrarAccion` queda sin uso, quitarlo también del `import` de `bitacora`.

```bash
git rm src/app/caso/[fila]/folio-form.tsx
```

- [ ] **Paso 16: Escribir el componente del aviso**

Crear `src/components/generar-folios.tsx`:

```tsx
'use client'

import { LoaderCircle, TicketPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { generarFolios } from '@/app/acciones-folios'

/**
 * Aviso con el botón que llena los folios faltantes. Solo se dibuja cuando hay
 * algo que llenar: con toda la columna completa, la funcionalidad desaparece.
 */
export function GenerarFolios({ faltantes }: { faltantes: number }) {
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()
  const router = useRouter()

  if (faltantes === 0) return null

  const plural = faltantes === 1 ? 'petición' : 'peticiones'

  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-medium">
            {faltantes} {plural} sin folio de atención
          </p>
          <p className="text-sm text-muted-foreground">
            El folio se generará continuando la serie desde el número más alto de la hoja, en orden
            de llegada. Se escribe en la columna de folio de cada registro.
          </p>
        </div>
        <Button
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              setError(null)
              const r = await generarFolios()
              if (r.ok) router.refresh()
              else setError(r.error)
            })
          }
        >
          {pendiente ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <TicketPlus className="size-4" />
          )}
          {pendiente ? 'Generando…' : `Generar ${faltantes === 1 ? 'el folio' : 'los folios'}`}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
```

- [ ] **Paso 17: Colocarlo en la vista de la fila**

En `src/app/fila/page.tsx`:

```tsx
import { sinFolio } from '@/lib/casos/caso'
import { GenerarFolios } from '@/components/generar-folios'
```

Calcular sobre **todos** los casos leídos, no sobre los filtrados —el arrastre llena la columna entera, no la vista—:

```tsx
  const faltanFolio = resultado.casos.filter(sinFolio).length
```

Y dibujarlo como primer elemento del `<main>`, antes del párrafo de la descripción:

```tsx
      <main className="mx-auto max-w-7xl space-y-4 px-6 py-6">
        <GenerarFolios faltantes={faltanFolio} />
```

- [ ] **Paso 18: Colocarlo en la vista del caso**

En `src/lib/casos/consulta.ts`, devolver el total desde `cargarCaso` —ya lee todos los casos, así que no cuesta una llamada más—:

```ts
export async function cargarCaso(
  fila: number,
): Promise<{
  caso: Caso
  catalogos: Catalogos
  mapa: MapaEsquema
  sinFolioTotal: number
} | null> {
  const deps = await depsDeGoogle()
  const { casos, mapa } = await leerCasos(deps)
  const caso = casos.find((c) => c.fila === fila)
  if (!caso) return null
  const catalogos = await leerCatalogos(deps, mapa, fila)
  return { caso, catalogos, mapa, sinFolioTotal: casos.filter(sinFolio).length }
}
```

con `import { sinFolio } from './caso'` (ya importa `type { Caso }` de ahí; unificar el import).

En `src/app/caso/[fila]/page.tsx`: cambiar el destructurado a `const { caso, catalogos, sinFolioTotal } = cargado`, quitar `import { FolioForm }` y `import { sinFolio }`, agregar `import { GenerarFolios } from '@/components/generar-folios'`, y sustituir la línea 173:

```tsx
        <GenerarFolios faltantes={sinFolioTotal} />
```

El aviso aparece en el caso aunque el folio que falte sea de otro registro: es correcto, la acción llena la columna completa y así la mesa lo resuelve desde donde esté.

- [ ] **Paso 19: Actualizar la prueba de rutas**

`src/app/rutas.test.ts` comprueba que ningún archivo referencia `/cola`. Al borrar `folio-form.tsx` no cambia nada ahí, pero conviene correr la suite completa para detectar imports huérfanos.

Run: `pnpm test && pnpm typecheck && pnpm lint`
Esperado: todo verde. Si `typecheck` se queja de `.next/types`, correr `pnpm build` una vez.

- [ ] **Paso 20: Commit**

```bash
git add -A
git commit -m "feat: genera los folios faltantes continuando la serie de la hoja"
```

---

### Task 3: Subir archivos al caso

El panel de archivos gana una tercera vía: los que sube la mesa. Van al Drive de `mesadecontrol@`, en una carpeta que la propia aplicación crea, y su registro queda en Postgres. **La hoja no participa**: las columnas de adjuntos del formulario están protegidas sin editores.

**Requiere un permiso nuevo.** `SCOPES_MESA` hoy pide `drive.readonly`. Hay que agregar `drive.file` —que solo da acceso a los archivos que la propia aplicación crea— y **volver a autorizar una vez desde Ajustes**. Mientras no se reautorice, el panel muestra el aviso en lugar del botón; nada más se rompe.

**Files:**
- Modify: `src/lib/google/auth-mesa.ts` (scope nuevo + `scopesFaltantes`)
- Test: `src/lib/google/auth-mesa.test.ts` (agregar el describe de `scopesFaltantes`)
- Create: `src/lib/google/drive-subida.ts`
- Test: `src/lib/google/drive-subida.test.ts`
- Modify: `src/db/schema.ts` (tablas `archivos_caso` y `ajustes_app`)
- Create: `src/lib/casos/archivos.ts`
- Create: `src/app/api/archivo/subir/route.ts`
- Create: `src/app/api/archivo/[id]/route.ts`
- Create: `src/app/caso/[fila]/subir-archivos.tsx`
- Modify: `src/app/caso/[fila]/page.tsx` (tercera sección del panel)
- Modify: `src/app/ajustes/page.tsx` (aviso de permiso faltante)

**Interfaces:**
- Consume: `DepsLectura`-como-`DepsDrive`, `accessTokenDeLaMesa`, `leerCredencial`, `requerirUsuario`, `getDb`.
- Produce:
  - `scopesFaltantes(otorgados: string[]): string[]`
  - `cuerpoMultiparte(metadatos: object, tipo: string, contenido: Uint8Array): { cuerpo: Uint8Array; contentType: string }`
  - `crearCarpeta(deps: DepsDrive): Promise<string>`
  - `subirArchivo(deps, { carpetaId, nombre, tipo, contenido }): Promise<{ id: string; bytes: number }>`
  - `descargarArchivo(deps, id): Promise<{ contenido: ArrayBuffer; tipo: string }>`
  - `LIMITE_BYTES`, `TOPE_ARCHIVOS`
  - `carpetaDeArchivos(): Promise<string>`, `registrarArchivo(...)`, `listarArchivos(fila)`, `buscarArchivo(id)`

- [ ] **Paso 1: Escribir la prueba del permiso**

En `src/lib/google/auth-mesa.test.ts`, agregar:

```ts
describe('scopesFaltantes', () => {
  it('detecta el permiso de escritura en Drive cuando la credencial es vieja', () => {
    // La credencial se autorizó cuando la app solo leía Drive; subir archivos
    // necesita drive.file y eso exige volver a pasar por la pantalla de Google.
    const otorgados = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
    ]
    expect(scopesFaltantes(otorgados)).toEqual(['https://www.googleapis.com/auth/drive.file'])
  })

  it('con todos los permisos no falta ninguno', () => {
    expect(scopesFaltantes([...SCOPES_MESA])).toEqual([])
  })
})
```

- [ ] **Paso 2: Correr y verla fallar**

Run: `pnpm vitest run src/lib/google/auth-mesa.test.ts`
Esperado: FAIL, `scopesFaltantes is not exported`.

- [ ] **Paso 3: Agregar el permiso y el comparador**

En `src/lib/google/auth-mesa.ts`:

```ts
export const SCOPES_MESA = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
  // Solo los archivos que crea esta aplicación: no da acceso al resto del Drive
  // de la mesa. Es lo que permite subir evidencias al caso.
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
] as const

/**
 * Permisos que la aplicación necesita y la credencial guardada no tiene. Aparece
 * cuando se agrega un scope después de que alguien ya autorizó: el token viejo
 * sigue sirviendo para todo lo demás, así que no se invalida, solo se avisa.
 */
export function scopesFaltantes(otorgados: string[]): string[] {
  return SCOPES_MESA.filter((s) => !otorgados.includes(s))
}
```

- [ ] **Paso 4: Correr y verla pasar**

Run: `pnpm vitest run src/lib/google/auth-mesa.test.ts`
Esperado: PASS.

- [ ] **Paso 5: Escribir la prueba de la subida a Drive**

Crear `src/lib/google/drive-subida.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { NOMBRE_CARPETA, crearCarpeta, cuerpoMultiparte, subirArchivo } from './drive-subida'

const decodificar = (u: Uint8Array) => new TextDecoder().decode(u)

describe('cuerpoMultiparte', () => {
  it('arma las dos partes que pide Drive: metadatos JSON y contenido', () => {
    const { cuerpo, contentType } = cuerpoMultiparte(
      { name: 'captura.png', parents: ['carpeta-1'] },
      'image/png',
      new Uint8Array([1, 2, 3]),
    )
    const texto = decodificar(cuerpo)
    const frontera = contentType.match(/boundary=(.+)$/)![1]

    expect(contentType).toContain('multipart/related')
    expect(texto).toContain(`--${frontera}`)
    expect(texto).toContain('Content-Type: application/json')
    expect(texto).toContain('"name":"captura.png"')
    expect(texto).toContain('"parents":["carpeta-1"]')
    expect(texto).toContain('Content-Type: image/png')
    expect(texto.endsWith(`--${frontera}--\r\n`)).toBe(true)
  })

  it('no corrompe el contenido binario', () => {
    const bytes = new Uint8Array([0, 255, 13, 10, 128])
    const { cuerpo } = cuerpoMultiparte({ name: 'x' }, 'application/octet-stream', bytes)
    // Los cinco bytes originales aparecen tal cual, en ese orden.
    const indice = cuerpo.findIndex(
      (_, i) =>
        cuerpo[i] === 0 &&
        cuerpo[i + 1] === 255 &&
        cuerpo[i + 2] === 13 &&
        cuerpo[i + 3] === 10 &&
        cuerpo[i + 4] === 128,
    )
    expect(indice).toBeGreaterThan(0)
  })
})

describe('subirArchivo', () => {
  it('sube con uploadType=multipart y devuelve el id que dio Drive', async () => {
    const llamadas: { url: string; init?: RequestInit }[] = []
    const deps = {
      fetch: (async (url: string, init?: RequestInit) => {
        llamadas.push({ url, init })
        return { ok: true, status: 200, json: async () => ({ id: 'archivo-9', size: '3' }) }
      }) as unknown as typeof globalThis.fetch,
      accessToken: 'token',
    }

    const r = await subirArchivo(deps, {
      carpetaId: 'carpeta-1',
      nombre: 'captura.png',
      tipo: 'image/png',
      contenido: new Uint8Array([1, 2, 3]),
    })

    expect(r).toEqual({ id: 'archivo-9', bytes: 3 })
    expect(llamadas[0].url).toContain('uploadType=multipart')
    expect((llamadas[0].init?.headers as Record<string, string>).Authorization).toBe(
      'Bearer token',
    )
  })

  it('un 403 se explica en términos del permiso que falta', async () => {
    const deps = {
      fetch: (async () => ({ ok: false, status: 403, text: async () => 'denied' })) as never,
      accessToken: 'token',
    }
    await expect(
      subirArchivo(deps, {
        carpetaId: 'c',
        nombre: 'x',
        tipo: 'text/plain',
        contenido: new Uint8Array([1]),
      }),
    ).rejects.toThrow(/autoriza/i)
  })
})

describe('crearCarpeta', () => {
  it('crea la carpeta con el nombre acordado y tipo carpeta', async () => {
    let cuerpo: Record<string, unknown> = {}
    const deps = {
      fetch: (async (_url: string, init?: RequestInit) => {
        cuerpo = JSON.parse(init!.body as string)
        return { ok: true, status: 200, json: async () => ({ id: 'carpeta-nueva' }) }
      }) as unknown as typeof globalThis.fetch,
      accessToken: 'token',
    }

    expect(await crearCarpeta(deps)).toBe('carpeta-nueva')
    expect(cuerpo.name).toBe(NOMBRE_CARPETA)
    expect(cuerpo.mimeType).toBe('application/vnd.google-apps.folder')
  })
})
```

- [ ] **Paso 6: Correr y verla fallar**

Run: `pnpm vitest run src/lib/google/drive-subida.test.ts`
Esperado: FAIL, `Failed to resolve import "./drive-subida"`.

- [ ] **Paso 7: Implementar el módulo de Drive**

Crear `src/lib/google/drive-subida.ts`:

```ts
/**
 * Subida de archivos al Drive de la mesa. Los adjuntos que la mesa agrega a un
 * caso no pueden ir a la hoja: las columnas de adjuntos del formulario están
 * protegidas sin editores, así que un enlace ahí devolvería 403. Viven en una
 * carpeta que crea esta aplicación —lo único que el permiso `drive.file`
 * alcanza— y su registro queda en Postgres.
 */
export type DepsDrive = {
  fetch: typeof globalThis.fetch
  accessToken: string
}

export const NOMBRE_CARPETA = 'Mesa de Control · Archivos'

/** Tope por archivo. Drive aguanta mucho más; esto acota el gasto de la función. */
export const LIMITE_BYTES = 25 * 1024 * 1024

/** Tope de archivos por subida, para que un clic accidental no cargue 200. */
export const TOPE_ARCHIVOS = 10

const API = 'https://www.googleapis.com/drive/v3/files'
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files'

function concatenar(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((n, p) => n + p.length, 0)
  const salida = new Uint8Array(total)
  let offset = 0
  for (const p of partes) {
    salida.set(p, offset)
    offset += p.length
  }
  return salida
}

/**
 * Arma el cuerpo `multipart/related` de la API de Drive: una parte con los
 * metadatos en JSON y otra con el contenido. Se construye sobre bytes y no sobre
 * cadenas para no corromper archivos binarios.
 */
export function cuerpoMultiparte(
  metadatos: object,
  tipo: string,
  contenido: Uint8Array,
): { cuerpo: Uint8Array; contentType: string } {
  const frontera = `mesa-${Math.random().toString(36).slice(2)}-${contenido.length}`
  const cod = new TextEncoder()

  const encabezado = cod.encode(
    `--${frontera}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadatos)}\r\n` +
      `--${frontera}\r\n` +
      `Content-Type: ${tipo}\r\n\r\n`,
  )
  const cierre = cod.encode(`\r\n--${frontera}--\r\n`)

  return {
    cuerpo: concatenar([encabezado, contenido, cierre]),
    contentType: `multipart/related; boundary=${frontera}`,
  }
}

async function revisar(respuesta: { ok: boolean; status: number; text?: () => Promise<string> }) {
  if (respuesta.ok) return
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new Error(
      'Google rechazó la subida. Es probable que falte el permiso de escritura en Drive: pide al administrador que vuelva a autorizar el acceso en Ajustes.',
    )
  }
  const detalle = respuesta.text ? await respuesta.text() : ''
  throw new Error(`Drive respondió ${respuesta.status} al subir el archivo. ${detalle}`.trim())
}

export async function crearCarpeta(deps: DepsDrive): Promise<string> {
  const respuesta = await deps.fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deps.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: NOMBRE_CARPETA,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  await revisar(respuesta)
  const { id } = (await respuesta.json()) as { id: string }
  return id
}

export async function subirArchivo(
  deps: DepsDrive,
  archivo: { carpetaId: string; nombre: string; tipo: string; contenido: Uint8Array },
): Promise<{ id: string; bytes: number }> {
  const { cuerpo, contentType } = cuerpoMultiparte(
    { name: archivo.nombre, parents: [archivo.carpetaId] },
    archivo.tipo || 'application/octet-stream',
    archivo.contenido,
  )

  const respuesta = await deps.fetch(`${SUBIDA}?uploadType=multipart&fields=id,size`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deps.accessToken}`,
      'content-type': contentType,
    },
    body: cuerpo,
  })
  await revisar(respuesta)
  const { id } = (await respuesta.json()) as { id: string }
  return { id, bytes: archivo.contenido.length }
}

/** Descarga el contenido para servirlo por nuestra ruta: el archivo no se comparte. */
export async function descargarArchivo(
  deps: DepsDrive,
  id: string,
): Promise<{ contenido: ArrayBuffer; tipo: string }> {
  const respuesta = await deps.fetch(`${API}/${encodeURIComponent(id)}?alt=media`, {
    headers: { Authorization: `Bearer ${deps.accessToken}` },
  })
  await revisar(respuesta)
  return {
    contenido: await respuesta.arrayBuffer(),
    tipo: respuesta.headers.get('content-type') ?? 'application/octet-stream',
  }
}
```

- [ ] **Paso 8: Correr y verla pasar**

Run: `pnpm vitest run src/lib/google/drive-subida.test.ts`
Esperado: PASS, 5 pruebas.

- [ ] **Paso 9: Commit de la capa de Drive**

```bash
git add src/lib/google/auth-mesa.ts src/lib/google/auth-mesa.test.ts src/lib/google/drive-subida.ts src/lib/google/drive-subida.test.ts
git commit -m "feat: sube y descarga archivos del Drive de la mesa"
```

- [ ] **Paso 10: Agregar las tablas**

En `src/db/schema.ts`, al final:

```ts
/**
 * Archivos que la mesa sube a un caso. El contenido vive en el Drive de
 * `mesadecontrol@` y aquí queda el registro: la hoja no puede guardar el enlace
 * porque sus columnas de adjuntos están protegidas sin editores.
 */
export const archivosCaso = pgTable('archivos_caso', {
  id: serial('id').primaryKey(),
  fila: integer('fila').notNull(),
  driveFileId: text('drive_file_id').notNull(),
  nombre: text('nombre').notNull(),
  tipo: text('tipo').notNull(),
  bytes: integer('bytes').notNull(),
  subidoPor: text('subido_por').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
})

/** Pares clave-valor de configuración interna, como el id de la carpeta de Drive. */
export const ajustesApp = pgTable('ajustes_app', {
  clave: text('clave').primaryKey(),
  valor: text('valor').notNull(),
})
```

- [ ] **Paso 11: Aplicar el esquema**

Run: `pnpm db:push`
Esperado: crea `archivos_caso` y `ajustes_app`. Ninguna tabla existente se altera; si `drizzle-kit` propone borrar algo, **cancelar** y revisar.

- [ ] **Paso 12: Escribir la capa de datos**

Crear `src/lib/casos/archivos.ts`:

```ts
import { and, asc, eq } from 'drizzle-orm'
import { getDb } from '@/db/index'
import { ajustesApp, archivosCaso } from '@/db/schema'
import { accessTokenDeLaMesa } from '@/lib/google/auth-mesa'
import { crearCarpeta, type DepsDrive } from '@/lib/google/drive-subida'

const CLAVE_CARPETA = 'carpeta_drive_archivos'

export async function depsDrive(): Promise<DepsDrive> {
  return { fetch: globalThis.fetch, accessToken: await accessTokenDeLaMesa() }
}

/**
 * El id de la carpeta donde van los archivos, creándola la primera vez. Se
 * guarda para no depender de buscarla por nombre: si alguien la renombra en
 * Drive, las subidas siguen cayendo en el mismo lugar.
 */
export async function carpetaDeArchivos(): Promise<string> {
  const db = getDb()
  const [guardada] = await db
    .select()
    .from(ajustesApp)
    .where(eq(ajustesApp.clave, CLAVE_CARPETA))
    .limit(1)
  if (guardada) return guardada.valor

  const id = await crearCarpeta(await depsDrive())
  await db
    .insert(ajustesApp)
    .values({ clave: CLAVE_CARPETA, valor: id })
    .onConflictDoNothing({ target: ajustesApp.clave })
  const [confirmada] = await db
    .select()
    .from(ajustesApp)
    .where(eq(ajustesApp.clave, CLAVE_CARPETA))
    .limit(1)
  return confirmada?.valor ?? id
}

export async function registrarArchivo(datos: {
  fila: number
  driveFileId: string
  nombre: string
  tipo: string
  bytes: number
  subidoPor: string
}): Promise<void> {
  await getDb().insert(archivosCaso).values(datos)
}

export type ArchivoDeLaMesa = {
  id: number
  nombre: string
  bytes: number
  subidoPor: string
  creadoEn: Date
}

export async function listarArchivos(fila: number): Promise<ArchivoDeLaMesa[]> {
  const filas = await getDb()
    .select()
    .from(archivosCaso)
    .where(eq(archivosCaso.fila, fila))
    .orderBy(asc(archivosCaso.creadoEn))
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    bytes: f.bytes,
    subidoPor: f.subidoPor,
    creadoEn: f.creadoEn,
  }))
}

/** Busca por el id interno, no por el de Drive: la URL no expone ids de Google. */
export async function buscarArchivo(id: number) {
  const [fila] = await getDb().select().from(archivosCaso).where(eq(archivosCaso.id, id)).limit(1)
  return fila ?? null
}
```

Si `and` queda sin uso, quitarlo del import.

- [ ] **Paso 13: Escribir la ruta de subida**

Crear `src/app/api/archivo/subir/route.ts`:

```ts
import { requerirUsuario } from '@/lib/auth/guard'
import { carpetaDeArchivos, depsDrive, registrarArchivo } from '@/lib/casos/archivos'
import { LIMITE_BYTES, TOPE_ARCHIVOS, subirArchivo } from '@/lib/google/drive-subida'

/**
 * Recibe los archivos que la mesa adjunta al caso.
 *
 * Es una ruta y no una Server Action porque el cuerpo de una acción está
 * limitado a 1 MB y subir mueve archivos de megas; una ruta acepta el cuerpo
 * completo sin tocar la configuración del proyecto.
 */
export async function POST(request: Request) {
  const usuario = await requerirUsuario()

  let datos: FormData
  try {
    datos = await request.formData()
  } catch {
    return Response.json({ ok: false, error: 'No se pudo leer el envío.' }, { status: 400 })
  }

  const fila = Number(datos.get('fila'))
  if (!Number.isInteger(fila) || fila < 2) {
    return Response.json({ ok: false, error: 'Caso no válido.' }, { status: 400 })
  }

  const archivos = datos.getAll('archivos').filter((a): a is File => a instanceof File)
  if (archivos.length === 0) {
    return Response.json({ ok: false, error: 'No elegiste ningún archivo.' }, { status: 400 })
  }
  if (archivos.length > TOPE_ARCHIVOS) {
    return Response.json(
      { ok: false, error: `Máximo ${TOPE_ARCHIVOS} archivos por vez.` },
      { status: 400 },
    )
  }
  const pesado = archivos.find((a) => a.size > LIMITE_BYTES)
  if (pesado) {
    return Response.json(
      {
        ok: false,
        error: `"${pesado.name}" pesa más de ${Math.round(LIMITE_BYTES / (1024 * 1024))} MB. Súbelo a Drive y comparte el enlace en las observaciones.`,
      },
      { status: 413 },
    )
  }

  try {
    const carpetaId = await carpetaDeArchivos()
    const deps = await depsDrive()

    for (const archivo of archivos) {
      const contenido = new Uint8Array(await archivo.arrayBuffer())
      const { id, bytes } = await subirArchivo(deps, {
        carpetaId,
        // El nombre lleva la fila para que la carpeta de Drive se entienda sola.
        nombre: `[${fila}] ${archivo.name}`,
        tipo: archivo.type,
        contenido,
      })
      await registrarArchivo({
        fila,
        driveFileId: id,
        nombre: archivo.name,
        tipo: archivo.type || 'application/octet-stream',
        bytes,
        subidoPor: usuario.correo,
      })
    }
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : 'No se pudieron subir los archivos.' },
      { status: 502 },
    )
  }

  return Response.json({ ok: true, subidos: archivos.length })
}
```

- [ ] **Paso 14: Escribir la ruta de descarga**

Crear `src/app/api/archivo/[id]/route.ts`:

```ts
import { requerirUsuario } from '@/lib/auth/guard'
import { buscarArchivo, depsDrive } from '@/lib/casos/archivos'
import { descargarArchivo } from '@/lib/google/drive-subida'

/**
 * Sirve un archivo que subió la mesa. El archivo de Drive no se comparte con
 * nadie: se pide con la credencial de la mesa y se entrega al navegador, igual
 * que los adjuntos del correo. La URL lleva el id interno y no el de Drive.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario()
  const { id: idTexto } = await params
  const id = Number(idTexto)
  if (!Number.isInteger(id)) return new Response('Referencia no válida.', { status: 400 })

  const archivo = await buscarArchivo(id)
  if (!archivo) return new Response('Ese archivo no está registrado.', { status: 404 })

  try {
    const { contenido, tipo } = await descargarArchivo(await depsDrive(), archivo.driveFileId)
    return new Response(contenido, {
      headers: {
        'content-type': archivo.tipo || tipo,
        'content-length': String(contenido.byteLength),
        'content-disposition': `attachment; filename="${archivo.nombre.replace(/["\\\r\n]/g, '_')}"`,
        'cache-control': 'private, no-store',
      },
    })
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'No se pudo descargar.', { status: 502 })
  }
}
```

- [ ] **Paso 15: Escribir el componente de subida**

Crear `src/app/caso/[fila]/subir-archivos.tsx`:

```tsx
'use client'

import { LoaderCircle, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Sube archivos al caso sin restricción de tipo: la mesa adjunta capturas, PDF,
 * correos exportados y lo que haga falta. El envío va por `fetch` a una ruta y
 * no por una Server Action, que está limitada a 1 MB de cuerpo.
 */
export function SubirArchivos({ fila }: { fila: number }) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function enviar(archivos: FileList) {
    setError(null)
    setSubiendo(true)
    try {
      const datos = new FormData()
      datos.set('fila', String(fila))
      for (const archivo of archivos) datos.append('archivos', archivo)

      const respuesta = await fetch('/api/archivo/subir', { method: 'POST', body: datos })
      const cuerpo = (await respuesta.json()) as { ok: boolean; error?: string }
      if (!cuerpo.ok) setError(cuerpo.error ?? 'No se pudieron subir los archivos.')
      else router.refresh()
    } catch {
      setError('Se cortó la conexión durante la subida. Vuelve a intentarlo.')
    } finally {
      setSubiendo(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={entrada}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void enviar(e.target.files)
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={subiendo}
        onClick={() => entrada.current?.click()}
      >
        {subiendo ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {subiendo ? 'Subiendo…' : 'Agregar archivos'}
      </Button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
```

- [ ] **Paso 16: Agregar la tercera sección al panel**

En `src/app/caso/[fila]/page.tsx`:

```tsx
import { listarArchivos } from '@/lib/casos/archivos'
import { SubirArchivos } from './subir-archivos'
```

Cargar la lista junto a la bitácora:

```tsx
  const bitacora = await leerBitacora(fila)
  const archivosDeLaMesa = await listarArchivos(fila)
```

Actualizar el contador de la tarjeta:

```tsx
                  <Badge variant="outline" className="ml-auto text-sm font-normal">
                    {caso.adjuntos.length + adjuntosDelCorreo.length + archivosDeLaMesa.length}
                  </Badge>
```

Y agregar la sección al final del `<CardContent>` del panel de archivos, después del bloque "De la conversación":

```tsx
                <div className="space-y-2">
                  <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                    Subidos por la mesa
                  </p>
                  {archivosDeLaMesa.length === 0 ? (
                    <p className="text-base text-muted-foreground">
                      Todavía no has subido archivos a este caso.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {archivosDeLaMesa.map((a) => (
                        <li key={a.id}>
                          <a
                            href={`/api/archivo/${a.id}`}
                            className="flex items-start gap-3 rounded-lg border bg-secondary/40 px-3 py-2.5 text-base transition-colors hover:border-primary/40 hover:bg-secondary"
                          >
                            <Download className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0">
                              <span className="block break-words">{a.nombre}</span>
                              <span className="text-sm text-muted-foreground">
                                {(a.bytes / (1024 * 1024)).toFixed(1)} MB ·{' '}
                                {a.subidoPor.split('@')[0]}
                              </span>
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <SubirArchivos fila={fila} />
                </div>
```

- [ ] **Paso 17: Avisar del permiso faltante en Ajustes**

En `src/app/ajustes/page.tsx`, donde ya se informa del estado de la credencial, agregar el aviso. Leer la credencial guardada (la página ya lo hace para mostrar el estado; reutilizar ese dato) y:

```tsx
{credencial && scopesFaltantes(credencial.scopes).length > 0 && (
  <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
    <p className="font-medium">Falta un permiso nuevo de Google</p>
    <p className="text-muted-foreground">
      La autorización actual no incluye {scopesFaltantes(credencial.scopes).join(', ')}. Hasta que
      vuelvas a autorizar, la mesa no podrá subir archivos a los casos; todo lo demás sigue
      funcionando.
    </p>
  </div>
)}
```

con `import { scopesFaltantes } from '@/lib/google/auth-mesa'`. Leer primero la página para acomodarlo donde corresponda y usar el nombre real de la variable de la credencial.

- [ ] **Paso 18: Correr todo**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Esperado: verde. `pnpm build` importa porque las dos rutas nuevas son las primeras con parámetro dinámico bajo `/api/archivo`.

- [ ] **Paso 19: Commit**

```bash
git add -A
git commit -m "feat: permite a la mesa subir archivos al caso"
```

- [ ] **Paso 20: Reautorizar y comprobar en el navegador**

Pasos humanos, después de desplegar:

1. Entrar a **Ajustes** con la cuenta admin y volver a autorizar el acceso a Google. La pantalla de consentimiento debe pedir ahora "ver, editar, crear y eliminar solo los archivos específicos de Google Drive que uses con esta app".
2. Abrir un caso y subir una captura y un PDF. Deben aparecer en "Subidos por la mesa" y descargarse al pulsarlos.
3. Confirmar en el Drive de `mesadecontrol@` que existe la carpeta **Mesa de Control · Archivos** con los dos archivos, nombrados `[fila] nombre`.
4. Cuando llegue una petición nueva sin folio, comprobar que el aviso ámbar aparece en la fila y en el caso, que el folio generado es el máximo de la columna + 1, y que después el aviso desaparece.

---

## Revisión propia del plan

- **Cobertura:** los tres puntos del pedido tienen tarea. Correo antes de Agencia (Task 1). Botón de folio en las dos vistas, con formato de aviso, invisible sin faltantes, en sustitución del input (Task 2, pasos 15-18). Subida libre de archivos en el panel (Task 3).
- **Sin marcadores:** no hay TBD ni "implementar después". Los dos únicos lugares donde el ejecutor debe leer antes de escribir están señalados de forma explícita: el ayudante del mapa en `sheet-writer.test.ts` (paso 10) y la variable de la credencial en `ajustes/page.tsx` (paso 17).
- **Tipos consistentes:** `escribirFolios` recibe `Map<number, string>` en la implementación, en la prueba y en la acción. `cargarCaso` devuelve `sinFolioTotal` y los dos consumidores lo destructuran. `GenerarFolios` recibe `faltantes: number` en ambas vistas.
- **Riesgo señalado:** el paso 12 advierte por qué `escribirCeldas` no se puede reutilizar para el lote de folios; es el atajo que más fácilmente se cuela al pasar de una fila a varias.
