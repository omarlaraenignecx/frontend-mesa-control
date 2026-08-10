# Etapa 2 — Vista de caso y escritura del seguimiento · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la mesa abra un caso, vea únicamente lo que trae dato con sus adjuntos a un clic, capture el seguimiento y lo guarde en la fila correcta de la hoja — con confirmación previa, bitácora de quién cambió qué, y sin que dos personas se pisen.

**Architecture:** El escritor es la única pieza con permiso de escritura y opera con lista blanca de columnas; cualquier intento fuera de ella falla antes de llamar a Google. Antes de escribir revalida que la fila siga siendo el mismo caso comparando marca temporal y folio, lo que también detecta ediciones hechas directo en la hoja. El bloqueo y la bitácora viven en Supabase. La vista de caso es un Server Component; la captura es un formulario con Server Action.

**Tech Stack:** lo ya instalado (Next.js 16, TypeScript, Tailwind, shadcn/ui, Drizzle, Vitest).

## Global Constraints

Aplican todas las de las etapas anteriores, y además:

- **Escritura permitida exclusivamente en estas columnas** (lista blanca): `JZ`, `KA`, `KB`, `KD`, `KE`, `KF`, `KG`, `KH`, `KI`, `KJ`. Y `JY` **solo** en el caso de captura de folio faltante.
- **Prohibido escribir**: columnas del formulario (`A`–`JX`), fórmulas (`KC`, `KO`–`KU`), duplicados residuales (`KL`–`KN`). Un intento debe lanzar error **antes** de la llamada HTTP.
- Toda escritura va contra la **hoja de desarrollo** (`SHEET_ID`). La productiva no se toca en esta etapa.
- **Ninguna escritura automática**: solo por acción explícita del usuario, con confirmación del diff (RF-06).
- La escritura es **una sola petición por lote** de celdas de la fila, para no dejar la fila a medias (RNF-06).
- Las columnas se resuelven por el mapa del esquema, nunca por letra codificada: si el formulario crece, el escritor sigue apuntando a la columna correcta.
- Observaciones (`KJ`): **acumulativo**, se antepone `D/M/YYYY Nombre: texto` conservando íntegro lo anterior (RF-12).
- `KE` (Quien Atendió) llega precargado con el nombre del usuario y es editable. Nada más se autocompleta, salvo `KB` y `KD`.
- Zona horaria de las fechas que se escriben: la del servidor, formateadas con `formatearFechaHoja` (`D/M/YYYY H:mm:ss`), igual que las escribe la hoja hoy.
- El caso sigue siendo un objeto **serializable**: nada de `Date` en los modelos que cruzan el caché.
- Los catálogos de los desplegables se leen de la **validación de datos** de la hoja; la app nunca introduce una variante de texto nueva.

---

## File Structure

| Archivo | Responsabilidad |
| --- | --- |
| `src/lib/google/sheet-catalogs.ts` | Leer la validación de datos de las columnas de seguimiento |
| `src/lib/google/sheet-writer.ts` | Única pieza que escribe. Lista blanca, revalidación de fila, lote |
| `src/lib/casos/campos-extra.ts` | Agrupar los campos no clasificados por encabezado |
| `src/lib/casos/seguimiento.ts` | Modelo del seguimiento editable, diff y validación |
| `src/lib/casos/observaciones.ts` | Composición acumulativa de la bitácora de `KJ` |
| `src/lib/casos/bloqueo.ts` | Adquirir, liberar y forzar el bloqueo de un caso |
| `src/lib/casos/bitacora.ts` | Registro de cambios |
| `src/lib/casos/eventos.ts` | Emisión de los eventos de BI de esta etapa |
| `src/app/caso/[fila]/page.tsx` | Vista del caso |
| `src/app/caso/[fila]/seguimiento-form.tsx` | Formulario de captura con confirmación |
| `src/app/caso/[fila]/acciones.ts` | Server Actions: guardar, liberar, forzar bloqueo |

---

## Task 1: Catálogos desde la validación de datos

**Files:**
- Create: `src/lib/google/sheet-catalogs.ts`
- Test: `src/lib/google/sheet-catalogs.test.ts`

**Interfaces:**
- Consumes: `MapaEsquema`, `letraColumna` de `sheet-schema.ts`; `DepsLectura` de `sheet-reader.ts`.
- Produces:
  - `type Catalogos = Partial<Record<CampoSeguimiento, string[]>>`
  - `type CampoSeguimiento = 'estatusInicial' | 'estatusFinal' | 'quienAtendio' | 'aseguradoraSeguimiento' | 'teniaPermisos' | 'causaSeguimiento'`
  - `leerCatalogos(deps: DepsLectura, mapa: MapaEsquema, filaEjemplo: number): Promise<Catalogos>`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/google/sheet-catalogs.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/encabezados-307.json'
import { leerCatalogos } from './sheet-catalogs'
import { construirMapa } from './sheet-schema'

const MAPA = construirMapa(fixture.encabezados as string[])

/** Respuesta de spreadsheets.get con includeGridData, tal como la devuelve Sheets. */
function respuestaConValidaciones(porColumna: Record<number, string[]>) {
  const primeraColumna = 285 // JY, inicio de la zona de seguimiento
  const values = Array.from({ length: 12 }, (_, i) => {
    const columna = primeraColumna + i
    const lista = porColumna[columna]
    return lista
      ? {
          dataValidation: {
            condition: {
              type: 'ONE_OF_LIST',
              values: lista.map((v) => ({ userEnteredValue: v })),
            },
          },
        }
      : {}
  })
  return { sheets: [{ data: [{ rowData: [{ values }] }] }] }
}

function fetchQueResponde(cuerpo: unknown, status = 200) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(cuerpo), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof globalThis.fetch
}

const DEPS_BASE = {
  accessToken: 'ya29.token',
  sheetId: 'sheet-dev',
  pestana: 'Respuestas de formulario 1',
}

describe('leerCatalogos', () => {
  it('devuelve los valores permitidos de cada columna de seguimiento', async () => {
    const fetchMock = fetchQueResponde(
      respuestaConValidaciones({
        286: ['Atendida / Concluida', 'Atendida/en trámite'], // JZ
        287: ['Concluida', 'Improcedente', 'Tramite'], // KA
        291: ['José Juan', 'Norma', 'Paty', 'Keynor'], // KE
      }),
    )
    const catalogos = await leerCatalogos({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176)

    expect(catalogos.estatusInicial).toEqual(['Atendida / Concluida', 'Atendida/en trámite'])
    expect(catalogos.estatusFinal).toEqual(['Concluida', 'Improcedente', 'Tramite'])
    expect(catalogos.quienAtendio).toEqual(['José Juan', 'Norma', 'Paty', 'Keynor'])
  })

  it('omite el campo cuando la celda no tiene validación, en lugar de inventar valores', async () => {
    const fetchMock = fetchQueResponde(respuestaConValidaciones({ 286: ['Uno'] }))
    const catalogos = await leerCatalogos({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176)
    expect(catalogos.estatusInicial).toEqual(['Uno'])
    expect(catalogos.aseguradoraSeguimiento).toBeUndefined()
  })

  it('conserva los valores tal cual, con sus espacios e inconsistencias', async () => {
    // 'GPLUS ' viene con espacio final en la hoja; escribir 'GPLUS' rompería el
    // reporteo de Keynor, así que el valor no se normaliza.
    const fetchMock = fetchQueResponde(respuestaConValidaciones({ 293: ['GPLUS ', 'CHUBB'] }))
    const catalogos = await leerCatalogos({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176)
    expect(catalogos.aseguradoraSeguimiento).toEqual(['GPLUS ', 'CHUBB'])
  })

  it('pide solo la fila de ejemplo y solo los campos de validación', async () => {
    const fetchMock = fetchQueResponde(respuestaConValidaciones({}))
    await leerCatalogos({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176)
    const [url] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toContain('includeGridData=true')
    expect(String(url)).toContain('dataValidation')
    expect(String(url)).toContain('7176')
  })

  it('devuelve catálogos vacíos sin lanzar si la hoja no trae rowData', async () => {
    const fetchMock = fetchQueResponde({ sheets: [{ data: [{}] }] })
    const catalogos = await leerCatalogos({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176)
    expect(catalogos).toEqual({})
  })

  it('explica el 403 igual que el lector', async () => {
    const fetchMock = fetchQueResponde({ error: { code: 403 } }, 403)
    await expect(
      leerCatalogos({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176),
    ).rejects.toThrow(/permiso/)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/google/sheet-catalogs.test.ts`
Expected: FAIL — no existe `./sheet-catalogs`.

- [ ] **Step 3: Implementar**

Crear `src/lib/google/sheet-catalogs.ts`:

```ts
import type { DepsLectura } from './sheet-reader'
import { letraColumna, type CampoLogico, type MapaEsquema } from './sheet-schema'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

export type CampoSeguimiento =
  | 'estatusInicial'
  | 'estatusFinal'
  | 'quienAtendio'
  | 'aseguradoraSeguimiento'
  | 'teniaPermisos'
  | 'causaSeguimiento'

export const CAMPOS_CON_CATALOGO: CampoSeguimiento[] = [
  'estatusInicial',
  'estatusFinal',
  'quienAtendio',
  'aseguradoraSeguimiento',
  'teniaPermisos',
  'causaSeguimiento',
]

export type Catalogos = Partial<Record<CampoSeguimiento, string[]>>

type CeldaConValidacion = {
  dataValidation?: {
    condition?: { type?: string; values?: { userEnteredValue?: string }[] }
  }
}

/**
 * Los valores permitidos se leen de la validación de datos de la propia hoja,
 * nunca se codifican: si Keynor cambia una lista, la app la refleja sin
 * despliegue y jamás escribe una variante de texto que rompa su tabla dinámica.
 */
export async function leerCatalogos(
  deps: DepsLectura,
  mapa: MapaEsquema,
  filaEjemplo: number,
): Promise<Catalogos> {
  const columnas = CAMPOS_CON_CATALOGO.map((campo) => ({
    campo,
    columna: mapa.columnasPorCampo[campo as CampoLogico][0],
  })).filter((c) => Boolean(c.columna))

  if (columnas.length === 0) return {}

  const primera = Math.min(...columnas.map((c) => c.columna))
  const ultima = Math.max(...columnas.map((c) => c.columna))
  const rango = `${deps.pestana}!${letraColumna(primera)}${filaEjemplo}:${letraColumna(ultima)}${filaEjemplo}`

  const url =
    `${BASE}/${deps.sheetId}?includeGridData=true` +
    `&ranges=${encodeURIComponent(rango)}` +
    `&fields=${encodeURIComponent('sheets(data(rowData(values(dataValidation))))')}`

  const respuesta = await deps.fetch(url, {
    headers: { Authorization: `Bearer ${deps.accessToken}` },
  })

  if (respuesta.status === 403) {
    throw new Error('La cuenta de la mesa no tiene permiso para leer esta hoja de cálculo.')
  }
  if (!respuesta.ok) {
    throw new Error(`Sheets respondió ${respuesta.status} al leer los catálogos.`)
  }

  const cuerpo = (await respuesta.json()) as {
    sheets?: { data?: { rowData?: { values?: CeldaConValidacion[] }[] }[] }[]
  }
  const celdas = cuerpo.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values
  if (!celdas) return {}

  const catalogos: Catalogos = {}
  for (const { campo, columna } of columnas) {
    const celda = celdas[columna - primera]
    const condicion = celda?.dataValidation?.condition
    if (condicion?.type !== 'ONE_OF_LIST') continue
    const valores = (condicion.values ?? [])
      .map((v) => v.userEnteredValue)
      .filter((v): v is string => typeof v === 'string')
    if (valores.length > 0) catalogos[campo] = valores
  }
  return catalogos
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm test src/lib/google/sheet-catalogs.test.ts`
Expected: PASS, 6 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: catálogos leídos de la validación de datos de la hoja"
```

---

## Task 2: Escritor de seguimiento — la pieza crítica

**Files:**
- Create: `src/lib/google/sheet-writer.ts`
- Test: `src/lib/google/sheet-writer.test.ts`

**Interfaces:**
- Consumes: `MapaEsquema`, `letraColumna` de `sheet-schema.ts`; `DepsLectura` de `sheet-reader.ts`.
- Produces:
  - `CAMPOS_ESCRIBIBLES: readonly CampoEscribible[]`
  - `type CampoEscribible = 'estatusInicial' | 'estatusFinal' | 'fechaRespuestaCorreo' | 'fechaAtencionFinal' | 'quienAtendio' | 'folioInterno' | 'aseguradoraSeguimiento' | 'teniaPermisos' | 'causaSeguimiento' | 'observaciones'`
  - `class ColumnaNoEscribibleError extends Error`
  - `class FilaCambiadaError extends Error` con `readonly detalle: { campo: string; esperado: string | null; encontrado: string | null }`
  - `escribirSeguimiento(deps: DepsLectura, mapa: MapaEsquema, fila: number, valores: Partial<Record<CampoEscribible, string>>, testigo: { marcaTemporalTexto: string; folio: string | null }): Promise<void>`
  - `escribirFolio(deps: DepsLectura, mapa: MapaEsquema, fila: number, folio: string, testigo: {...}): Promise<void>`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `src/lib/google/sheet-writer.test.ts`. Estas son las pruebas más importantes de todo el proyecto: son la red que impide que un bug toque los datos del solicitante o las fórmulas de la hoja.

```ts
import { describe, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/encabezados-307.json'
import { construirMapa } from './sheet-schema'
import {
  CAMPOS_ESCRIBIBLES,
  ColumnaNoEscribibleError,
  FilaCambiadaError,
  escribirFolio,
  escribirSeguimiento,
} from './sheet-writer'

const ENCABEZADOS = fixture.encabezados as string[]
const MAPA = construirMapa(ENCABEZADOS)
const TESTIGO = { marcaTemporalTexto: '5/8/2026 15:14:58', folio: '7000' }

/** El escritor primero relee la fila (testigo) y luego escribe. */
function fetchDeEscritura(opciones: {
  marcaTemporal?: string
  folio?: string
  statusEscritura?: number
} = {}) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    llamadas.push({ url: String(url), init })
    const esLectura = !init?.method || init.method === 'GET'
    if (esLectura) {
      return new Response(
        JSON.stringify({
          values: [[opciones.marcaTemporal ?? TESTIGO.marcaTemporalTexto, opciones.folio ?? '7000']],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    return new Response(JSON.stringify({ totalUpdatedCells: 3 }), {
      status: opciones.statusEscritura ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof globalThis.fetch
  return { fetchMock, llamadas }
}

const DEPS_BASE = { accessToken: 'ya29.token', sheetId: 'sheet-dev', pestana: 'Respuestas de formulario 1' }

describe('lista blanca de columnas', () => {
  it('declara exactamente las diez columnas de seguimiento acordadas', () => {
    expect([...CAMPOS_ESCRIBIBLES].sort()).toEqual(
      [
        'aseguradoraSeguimiento',
        'causaSeguimiento',
        'estatusFinal',
        'estatusInicial',
        'fechaAtencionFinal',
        'fechaRespuestaCorreo',
        'folioInterno',
        'observaciones',
        'quienAtendio',
        'teniaPermisos',
      ].sort(),
    )
  })

  it('rechaza escribir un campo del formulario antes de llamar a Google', async () => {
    const { fetchMock } = fetchDeEscritura()
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { tipoTramite: 'Emisión' } as never,
        TESTIGO,
      ),
    ).rejects.toBeInstanceOf(ColumnaNoEscribibleError)
    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })

  it('rechaza escribir el folio por la vía del seguimiento', async () => {
    const { fetchMock } = fetchDeEscritura()
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { folio: '9999' } as never,
        TESTIGO,
      ),
    ).rejects.toBeInstanceOf(ColumnaNoEscribibleError)
  })

  it('nunca compone un rango que toque una columna de fórmula o residual', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { estatusFinal: 'Concluida', observaciones: 'nota' },
      TESTIGO,
    )
    const prohibidas = ['KC', 'KL', 'KM', 'KN', 'KO', 'KP', 'KQ', 'KR', 'KS', 'KT', 'KU']
    for (const { url, init } of llamadas) {
      const cuerpo = typeof init?.body === 'string' ? init.body : ''
      for (const col of prohibidas) {
        expect(decodeURIComponent(url)).not.toContain(`!${col}`)
        expect(cuerpo).not.toContain(`!${col}`)
      }
    }
  })
})

describe('revalidación de la fila', () => {
  it('escribe cuando la fila sigue siendo el mismo caso', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { estatusFinal: 'Concluida' },
      TESTIGO,
    )
    expect(llamadas.some((l) => l.init?.method && l.init.method !== 'GET')).toBe(true)
  })

  it('aborta sin escribir si la marca temporal de la fila cambió', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura({ marcaTemporal: '9/8/2026 10:00:00' })
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { estatusFinal: 'Concluida' },
        TESTIGO,
      ),
    ).rejects.toBeInstanceOf(FilaCambiadaError)
    expect(llamadas.every((l) => !l.init?.method || l.init.method === 'GET')).toBe(true)
  })

  it('aborta si el folio de la fila cambió, aunque la fecha coincida', async () => {
    const { fetchMock } = fetchDeEscritura({ folio: '8888' })
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { estatusFinal: 'Concluida' },
        TESTIGO,
      ),
    ).rejects.toBeInstanceOf(FilaCambiadaError)
  })

  it('el error de fila cambiada dice qué campo no coincidió y con qué valores', async () => {
    const { fetchMock } = fetchDeEscritura({ marcaTemporal: '9/8/2026 10:00:00' })
    try {
      await escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { estatusFinal: 'Concluida' },
        TESTIGO,
      )
      throw new Error('debió lanzar')
    } catch (e) {
      expect(e).toBeInstanceOf(FilaCambiadaError)
      const detalle = (e as FilaCambiadaError).detalle
      expect(detalle.campo).toBe('marca temporal')
      expect(detalle.esperado).toBe('5/8/2026 15:14:58')
      expect(detalle.encontrado).toBe('9/8/2026 10:00:00')
    }
  })

  it('acepta un caso sin folio: el testigo compara nulo contra vacío', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura({ folio: '' })
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { estatusInicial: 'Atendida/en trámite' },
      { marcaTemporalTexto: '5/8/2026 15:14:58', folio: null },
    )
    expect(llamadas.some((l) => l.init?.method === 'POST' || l.init?.method === 'PUT')).toBe(true)
  })
})

describe('forma de la escritura', () => {
  it('escribe todas las celdas en una sola petición, para no dejar la fila a medias', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      {
        estatusInicial: 'Atendida / Concluida',
        estatusFinal: 'Concluida',
        quienAtendio: 'Keynor',
        observaciones: 'nota',
      },
      TESTIGO,
    )
    const escrituras = llamadas.filter((l) => l.init?.method && l.init.method !== 'GET')
    expect(escrituras).toHaveLength(1)
  })

  it('usa RAW para no que Sheets reinterprete el texto que captura la mesa', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { folioInterno: '0426014703' },
      TESTIGO,
    )
    const escritura = llamadas.find((l) => l.init?.method && l.init.method !== 'GET')!
    expect(escritura.url).toContain('valueInputOption=RAW')
  })

  it('apunta a la fila indicada y a la columna que dice el mapa, no a letras fijas', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { observaciones: 'nota' },
      TESTIGO,
    )
    const escritura = llamadas.find((l) => l.init?.method && l.init.method !== 'GET')!
    const cuerpo = JSON.parse(escritura.init!.body as string) as { data: { range: string }[] }
    // KJ es observaciones en el esquema actual; lo relevante es que incluya la fila.
    expect(cuerpo.data.some((d) => d.range.includes('7176'))).toBe(true)
  })

  it('no escribe nada cuando no hay valores que cambiar', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176, {}, TESTIGO)
    expect(llamadas.filter((l) => l.init?.method && l.init.method !== 'GET')).toHaveLength(0)
  })

  it('traduce el 403 de escritura a un mensaje sobre permisos de edición', async () => {
    const { fetchMock } = fetchDeEscritura({ statusEscritura: 403 })
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { estatusFinal: 'Concluida' },
        TESTIGO,
      ),
    ).rejects.toThrow(/permiso de edición/)
  })
})

describe('escribirFolio', () => {
  it('es la única vía que puede tocar la columna del folio', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura({ folio: '' })
    await escribirFolio({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7180, '7010', {
      marcaTemporalTexto: '5/8/2026 15:14:58',
      folio: null,
    })
    const escritura = llamadas.find((l) => l.init?.method && l.init.method !== 'GET')!
    expect(escritura.init!.body).toContain('7010')
  })

  it('se niega a sobrescribir un folio que ya existe', async () => {
    const { fetchMock } = fetchDeEscritura({ folio: '7000' })
    await expect(
      escribirFolio({ ...DEPS_BASE, fetch: fetchMock }, MAPA, 7176, '9999', TESTIGO),
    ).rejects.toThrow(/ya tiene folio/)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/google/sheet-writer.test.ts`
Expected: FAIL — no existe `./sheet-writer`.

- [ ] **Step 3: Implementar el escritor**

Crear `src/lib/google/sheet-writer.ts`:

```ts
import type { DepsLectura } from './sheet-reader'
import { letraColumna, type CampoLogico, type MapaEsquema } from './sheet-schema'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

export type CampoEscribible =
  | 'estatusInicial'
  | 'estatusFinal'
  | 'fechaRespuestaCorreo'
  | 'fechaAtencionFinal'
  | 'quienAtendio'
  | 'folioInterno'
  | 'aseguradoraSeguimiento'
  | 'teniaPermisos'
  | 'causaSeguimiento'
  | 'observaciones'

/**
 * Lista blanca: las únicas columnas que esta aplicación puede escribir.
 *
 * Todo lo demás está prohibido, en particular las respuestas del formulario
 * (registro del solicitante), las columnas de fórmula y los duplicados
 * residuales de estatus. La comprobación ocurre antes de cualquier llamada HTTP.
 */
export const CAMPOS_ESCRIBIBLES = [
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
] as const satisfies readonly CampoEscribible[]

export class ColumnaNoEscribibleError extends Error {
  constructor(readonly campo: string) {
    super(
      `El campo "${campo}" no está en la lista de columnas que la herramienta puede escribir.`,
    )
    this.name = 'ColumnaNoEscribibleError'
  }
}

export class FilaCambiadaError extends Error {
  constructor(
    readonly detalle: { campo: string; esperado: string | null; encontrado: string | null },
  ) {
    super(
      `La fila cambió desde que abriste el caso: su ${detalle.campo} era "${detalle.esperado ?? '(vacío)'}" y ahora es "${detalle.encontrado ?? '(vacío)'}".`,
    )
    this.name = 'FilaCambiadaError'
  }
}

export type Testigo = { marcaTemporalTexto: string; folio: string | null }

function columnaDe(mapa: MapaEsquema, campo: string): number {
  const columnas = mapa.columnasPorCampo[campo as CampoLogico]
  if (!columnas?.length) {
    throw new ColumnaNoEscribibleError(campo)
  }
  return columnas[0]
}

async function pedir(deps: DepsLectura, url: string, init?: RequestInit) {
  const respuesta = await deps.fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${deps.accessToken}`,
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (respuesta.status === 403) {
    throw new Error(
      'La cuenta de la mesa no tiene permiso de edición sobre esta hoja de cálculo.',
    )
  }
  if (respuesta.status === 429) {
    throw new Error(
      'Google limitó las consultas por exceso de peticiones. Vuelve a intentar el guardado en un momento.',
    )
  }
  if (!respuesta.ok) {
    throw new Error(`Sheets respondió ${respuesta.status} al guardar los cambios.`)
  }
  return respuesta
}

/** Relee la fila y confirma que sigue siendo el caso que el usuario abrió. */
async function confirmarFila(
  deps: DepsLectura,
  mapa: MapaEsquema,
  fila: number,
  testigo: Testigo,
): Promise<void> {
  const colFecha = columnaDe(mapa, 'marcaTemporal')
  const colFolio = columnaDe(mapa, 'folio')
  const primera = Math.min(colFecha, colFolio)
  const ultima = Math.max(colFecha, colFolio)
  const rango = `${deps.pestana}!${letraColumna(primera)}${fila}:${letraColumna(ultima)}${fila}`

  const respuesta = await pedir(
    deps,
    `${BASE}/${deps.sheetId}/values/${encodeURIComponent(rango)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,
  )
  const cuerpo = (await respuesta.json()) as { values?: string[][] }
  const valores = cuerpo.values?.[0] ?? []

  const leer = (columna: number) => (valores[columna - primera] ?? '').trim() || null

  const fechaActual = leer(colFecha)
  if (fechaActual !== testigo.marcaTemporalTexto.trim()) {
    throw new FilaCambiadaError({
      campo: 'marca temporal',
      esperado: testigo.marcaTemporalTexto,
      encontrado: fechaActual,
    })
  }

  const folioActual = leer(colFolio)
  const folioEsperado = testigo.folio?.trim() || null
  if (folioActual !== folioEsperado) {
    throw new FilaCambiadaError({
      campo: 'folio',
      esperado: folioEsperado,
      encontrado: folioActual,
    })
  }
}

async function escribirCeldas(
  deps: DepsLectura,
  fila: number,
  celdas: { columna: number; valor: string }[],
): Promise<void> {
  if (celdas.length === 0) return
  const url = `${BASE}/${deps.sheetId}/values:batchUpdate?valueInputOption=RAW`
  await pedir(deps, url, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: celdas.map(({ columna, valor }) => ({
        range: `${deps.pestana}!${letraColumna(columna)}${fila}`,
        majorDimension: 'ROWS',
        values: [[valor]],
      })),
    }),
  })
}

export async function escribirSeguimiento(
  deps: DepsLectura,
  mapa: MapaEsquema,
  fila: number,
  valores: Partial<Record<CampoEscribible, string>>,
  testigo: Testigo,
): Promise<void> {
  const entradas = Object.entries(valores).filter(([, v]) => v !== undefined)

  // Primero la lista blanca: si algo no está permitido, no se hace ni una
  // llamada a Google.
  for (const [campo] of entradas) {
    if (!CAMPOS_ESCRIBIBLES.includes(campo as CampoEscribible)) {
      throw new ColumnaNoEscribibleError(campo)
    }
  }
  if (entradas.length === 0) return

  await confirmarFila(deps, mapa, fila, testigo)

  await escribirCeldas(
    deps,
    fila,
    entradas.map(([campo, valor]) => ({
      columna: columnaDe(mapa, campo),
      valor: valor as string,
    })),
  )
}

/** Única vía autorizada para escribir la columna del folio. */
export async function escribirFolio(
  deps: DepsLectura,
  mapa: MapaEsquema,
  fila: number,
  folio: string,
  testigo: Testigo,
): Promise<void> {
  if (testigo.folio?.trim()) {
    throw new Error('Este caso ya tiene folio; la herramienta no lo sobrescribe.')
  }
  if (!folio.trim()) throw new Error('El folio no puede quedar vacío.')

  await confirmarFila(deps, mapa, fila, testigo)
  await escribirCeldas(deps, fila, [{ columna: columnaDe(mapa, 'folio'), valor: folio.trim() }])
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm test src/lib/google/sheet-writer.test.ts`
Expected: PASS, 15 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: escritor de seguimiento con lista blanca y revalidación de fila"
```

---

## Task 3: Observaciones acumulativas y campos extra agrupados

**Files:**
- Create: `src/lib/casos/observaciones.ts`, `src/lib/casos/campos-extra.ts`
- Test: `src/lib/casos/observaciones.test.ts`, `src/lib/casos/campos-extra.test.ts`

**Interfaces:**
- Consumes: `formatearFechaHoja` de `@/lib/fecha`; `Caso` de `./caso`.
- Produces:
  - `componerObservaciones(existente: string | null, nota: string, autor: string, cuando: Date): string`
  - `agruparCamposExtra(campos: { etiqueta: string; valor: string }[]): { etiqueta: string; valor: string }[]`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `src/lib/casos/observaciones.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { componerObservaciones } from './observaciones'

const CUANDO = new Date(2026, 7, 10, 14, 30, 0)

describe('componerObservaciones', () => {
  it('antepone la nota nueva con fecha y autor', () => {
    const r = componerObservaciones(null, 'Se solicitó la factura', 'Keynor', CUANDO)
    expect(r).toBe('10/8/2026 14:30:00 Keynor: Se solicitó la factura')
  })

  it('conserva íntegro lo que ya había escrito alguien', () => {
    const existente = 'SE ENVIAN DATOS DE APLICACION DE PAGO Y FACTURA A PATY.'
    const r = componerObservaciones(existente, 'Se cerró el caso', 'Paty', CUANDO)
    expect(r.startsWith('10/8/2026 14:30:00 Paty: Se cerró el caso')).toBe(true)
    expect(r).toContain(existente)
  })

  it('separa las entradas con un salto de línea', () => {
    const r = componerObservaciones('anterior', 'nueva', 'Keynor', CUANDO)
    expect(r.split('\n')).toHaveLength(2)
  })

  it('acumula varias entradas manteniendo la más reciente arriba', () => {
    const uno = componerObservaciones(null, 'primera', 'Keynor', new Date(2026, 7, 9, 9, 0, 0))
    const dos = componerObservaciones(uno, 'segunda', 'Paty', CUANDO)
    const lineas = dos.split('\n')
    expect(lineas[0]).toContain('segunda')
    expect(lineas[1]).toContain('primera')
  })

  it('devuelve lo existente sin tocar si la nota viene vacía', () => {
    expect(componerObservaciones('anterior', '   ', 'Keynor', CUANDO)).toBe('anterior')
    expect(componerObservaciones(null, '', 'Keynor', CUANDO)).toBe('')
  })

  it('recorta espacios de la nota pero respeta sus saltos internos', () => {
    const r = componerObservaciones(null, '  línea uno\nlínea dos  ', 'Keynor', CUANDO)
    expect(r).toBe('10/8/2026 14:30:00 Keynor: línea uno\nlínea dos')
  })

  it('usa el correo cuando el usuario no tiene nombre en la hoja', () => {
    const r = componerObservaciones(null, 'nota', 'mesadecontrol@gplusseguros.mx', CUANDO)
    expect(r).toContain('mesadecontrol@gplusseguros.mx:')
  })
})
```

Crear `src/lib/casos/campos-extra.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { agruparCamposExtra } from './campos-extra'

describe('agruparCamposExtra', () => {
  it('colapsa el mismo encabezado repetido en varias columnas del formulario', () => {
    // "Número de póliza" existe en 4 columnas por los bloques replicados.
    const r = agruparCamposExtra([
      { etiqueta: 'Número de póliza', valor: 'L1146000273' },
      { etiqueta: 'Número de póliza', valor: 'L1146000273' },
    ])
    expect(r).toEqual([{ etiqueta: 'Número de póliza', valor: 'L1146000273' }])
  })

  it('conserva ambos valores cuando el mismo encabezado trae datos distintos', () => {
    const r = agruparCamposExtra([
      { etiqueta: 'Número de póliza', valor: 'AAA' },
      { etiqueta: 'Número de póliza', valor: 'BBB' },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].valor).toContain('AAA')
    expect(r[0].valor).toContain('BBB')
  })

  it('agrupa ignorando acentos, mayúsculas y signos, como el mapeador', () => {
    const r = agruparCamposExtra([
      { etiqueta: '¿Tipo de endoso?', valor: 'Cambio de conductor' },
      { etiqueta: 'Tipo de endoso:', valor: 'Cambio de conductor' },
    ])
    expect(r).toHaveLength(1)
  })

  it('usa la primera etiqueta como la visible', () => {
    const r = agruparCamposExtra([
      { etiqueta: 'Teléfono del cliente', valor: '5512345678' },
      { etiqueta: 'teléfono del cliente', valor: '5512345678' },
    ])
    expect(r[0].etiqueta).toBe('Teléfono del cliente')
  })

  it('descarta los campos sin valor', () => {
    expect(agruparCamposExtra([{ etiqueta: 'Portal', valor: '   ' }])).toEqual([])
  })

  it('conserva el orden de aparición', () => {
    const r = agruparCamposExtra([
      { etiqueta: 'Número de siniestro', valor: 'S1' },
      { etiqueta: 'Portal', valor: 'Qualitas' },
    ])
    expect(r.map((x) => x.etiqueta)).toEqual(['Número de siniestro', 'Portal'])
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `pnpm test src/lib/casos/observaciones.test.ts src/lib/casos/campos-extra.test.ts`
Expected: FAIL — no existen los módulos.

- [ ] **Step 3: Implementar**

Crear `src/lib/casos/observaciones.ts`:

```ts
import { formatearFechaHoja } from '@/lib/fecha'

/**
 * La celda KJ es la bitácora real que usa la mesa: nunca se sobrescribe.
 * La entrada nueva va arriba, encabezada por fecha y autor, y todo lo anterior
 * se conserva tal cual (RF-12).
 */
export function componerObservaciones(
  existente: string | null,
  nota: string,
  autor: string,
  cuando: Date,
): string {
  const limpia = nota.trim()
  if (!limpia) return existente ?? ''
  const entrada = `${formatearFechaHoja(cuando)} ${autor}: ${limpia}`
  const previo = existente?.trim()
  return previo ? `${entrada}\n${previo}` : entrada
}
```

Crear `src/lib/casos/campos-extra.ts`:

```ts
import { normalizarEncabezado } from '@/lib/google/sheet-schema'

/**
 * El formulario repite cada pregunta en 4 o 5 columnas según la rama que
 * respondió el solicitante. Sin agrupar, la vista del caso mostraría "Número de
 * póliza" cuatro veces con el mismo valor.
 */
export function agruparCamposExtra(
  campos: { etiqueta: string; valor: string }[],
): { etiqueta: string; valor: string }[] {
  const grupos = new Map<string, { etiqueta: string; valores: string[] }>()

  for (const { etiqueta, valor } of campos) {
    const limpio = valor?.trim()
    if (!limpio || !etiqueta?.trim()) continue
    const clave = normalizarEncabezado(etiqueta)
    const grupo = grupos.get(clave)
    if (!grupo) {
      grupos.set(clave, { etiqueta: etiqueta.trim(), valores: [limpio] })
    } else if (!grupo.valores.includes(limpio)) {
      grupo.valores.push(limpio)
    }
  }

  return [...grupos.values()].map(({ etiqueta, valores }) => ({
    etiqueta,
    valor: valores.join(' · '),
  }))
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `pnpm test src/lib/casos/observaciones.test.ts src/lib/casos/campos-extra.test.ts`
Expected: PASS, 13 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: observaciones acumulativas con autor y agrupación de campos extra"
```

---

## Task 4: Bloqueo de caso, bitácora y eventos

**Files:**
- Create: `src/lib/casos/bloqueo.ts`, `src/lib/casos/bitacora.ts`, `src/lib/casos/eventos.ts`
- Test: `src/lib/casos/diff.test.ts`
- Create: `src/lib/casos/seguimiento.ts`

**Interfaces:**
- Consumes: `getDb`, `schema` de `@/db`; `Caso` de `./caso`; `CampoEscribible` de `sheet-writer.ts`.
- Produces:
  - `type Seguimiento = Partial<Record<CampoEscribible, string>>`
  - `type Cambio = { campo: CampoEscribible; etiqueta: string; anterior: string | null; nuevo: string }`
  - `calcularDiff(caso: Caso, propuesto: Seguimiento): Cambio[]` — solo los campos que de verdad cambian.
  - `ETIQUETAS_SEGUIMIENTO: Record<CampoEscribible, string>`
  - `adquirirBloqueo(fila, correo): Promise<{ ok: true } | { ok: false; dueno: string; tomadoEn: Date; ultimoLatido: Date }>`
  - `liberarBloqueo(fila, correo): Promise<void>`, `forzarBloqueo(fila, correo): Promise<string | null>` (devuelve quién lo tenía), `leerBloqueo(fila)`, `latir(fila, correo)`
  - `registrarCambios(fila, folio, correo, cambios, tipo): Promise<void>`, `leerBitacora(fila)`
  - `emitirEvento(...)`

- [ ] **Step 1: Escribir la prueba del diff, que es la lógica pura**

Crear `src/lib/casos/diff.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Caso } from './caso'
import { ETIQUETAS_SEGUIMIENTO, calcularDiff } from './seguimiento'

function caso(parcial: Partial<Caso> = {}): Caso {
  return {
    fila: 7176,
    folio: '7000',
    marcaTemporalIso: new Date(2026, 7, 5).toISOString(),
    marcaTemporalTexto: '5/8/2026 15:14:58',
    tipoTramite: 'Emisión',
    tipoNegocio: null,
    nombreSolicitante: 'Ricardo Hernandez',
    correoSolicitante: 'a@b.mx',
    agencia: 'CHEVROLET CAMPESTRE',
    motivo: null,
    aseguradoraDeclarada: null,
    nombreCliente: null,
    estatusInicial: 'Atendida/en trámite',
    estatusFinal: 'Tramite',
    quienAtendio: 'Keynor',
    folioInterno: null,
    aseguradoraSeguimiento: 'LA LATINO',
    teniaPermisos: 'No',
    causaSeguimiento: 'Función de GPLUS',
    observaciones: 'nota previa',
    fechaRespuestaCorreo: null,
    fechaAtencionFinal: null,
    adjuntos: [],
    camposExtra: [],
    ...parcial,
  }
}

describe('calcularDiff', () => {
  it('lista solo los campos que de verdad cambian', () => {
    const cambios = calcularDiff(caso(), {
      estatusFinal: 'Concluida',
      quienAtendio: 'Keynor', // igual: no es un cambio
    })
    expect(cambios).toHaveLength(1)
    expect(cambios[0]).toEqual({
      campo: 'estatusFinal',
      etiqueta: ETIQUETAS_SEGUIMIENTO.estatusFinal,
      anterior: 'Tramite',
      nuevo: 'Concluida',
    })
  })

  it('trata el paso de vacío a con dato como un cambio', () => {
    const cambios = calcularDiff(caso({ folioInterno: null }), { folioInterno: '0426014703' })
    expect(cambios).toEqual([
      {
        campo: 'folioInterno',
        etiqueta: ETIQUETAS_SEGUIMIENTO.folioInterno,
        anterior: null,
        nuevo: '0426014703',
      },
    ])
  })

  it('ignora las diferencias que son solo espacios', () => {
    expect(calcularDiff(caso(), { estatusFinal: '  Tramite  ' })).toEqual([])
  })

  it('devuelve lista vacía cuando no se propone nada', () => {
    expect(calcularDiff(caso(), {})).toEqual([])
  })

  it('no inventa cambios en campos que no se proponen', () => {
    const cambios = calcularDiff(caso(), { estatusFinal: 'Concluida' })
    expect(cambios.map((c) => c.campo)).toEqual(['estatusFinal'])
  })

  it('cada campo escribible tiene una etiqueta en español para el diff', () => {
    for (const etiqueta of Object.values(ETIQUETAS_SEGUIMIENTO)) {
      expect(etiqueta.length).toBeGreaterThan(0)
    }
    expect(ETIQUETAS_SEGUIMIENTO.estatusInicial).toBe('Estatus inicial')
    expect(ETIQUETAS_SEGUIMIENTO.observaciones).toBe('Observaciones')
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/casos/diff.test.ts`
Expected: FAIL — no existe `./seguimiento`.

- [ ] **Step 3: Implementar el modelo de seguimiento**

Crear `src/lib/casos/seguimiento.ts`:

```ts
import type { CampoEscribible } from '@/lib/google/sheet-writer'
import type { Caso } from './caso'

export type Seguimiento = Partial<Record<CampoEscribible, string>>

export type Cambio = {
  campo: CampoEscribible
  etiqueta: string
  anterior: string | null
  nuevo: string
}

export const ETIQUETAS_SEGUIMIENTO: Record<CampoEscribible, string> = {
  estatusInicial: 'Estatus inicial',
  estatusFinal: 'Estatus final',
  fechaRespuestaCorreo: 'Fecha de respuesta por correo',
  fechaAtencionFinal: 'Fecha de atención final',
  quienAtendio: 'Quien atendió',
  folioInterno: 'Folio de aseguradora',
  aseguradoraSeguimiento: 'Aseguradora',
  teniaPermisos: '¿El ejecutivo tenía permisos?',
  causaSeguimiento: 'Causa',
  observaciones: 'Observaciones',
}

/** Solo los campos cuyo valor realmente cambia; el resto no se escribe. */
export function calcularDiff(caso: Caso, propuesto: Seguimiento): Cambio[] {
  const cambios: Cambio[] = []
  for (const [campo, valor] of Object.entries(propuesto) as [CampoEscribible, string][]) {
    if (valor === undefined) continue
    const nuevo = valor.trim()
    const anterior = (caso[campo] as string | null)?.trim() || null
    if ((anterior ?? '') === nuevo) continue
    cambios.push({ campo, etiqueta: ETIQUETAS_SEGUIMIENTO[campo], anterior, nuevo })
  }
  return cambios
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm test src/lib/casos/diff.test.ts`
Expected: PASS, 6 pruebas.

- [ ] **Step 5: Implementar bloqueo, bitácora y eventos**

Crear `src/lib/casos/bloqueo.ts`:

```ts
import { and, eq } from 'drizzle-orm'
import { getDb, schema } from '@/db'

export type EstadoBloqueo = {
  fila: number
  correoDueno: string
  tomadoEn: Date
  ultimoLatido: Date
}

export async function leerBloqueo(fila: number): Promise<EstadoBloqueo | null> {
  const [b] = await getDb()
    .select()
    .from(schema.bloqueos)
    .where(eq(schema.bloqueos.fila, fila))
    .limit(1)
  return b ?? null
}

/**
 * Se toma al abrir el caso. No expira por tiempo: la liberación es manual, por
 * el dueño o forzada por cualquiera (decisión del área).
 */
export async function adquirirBloqueo(
  fila: number,
  correo: string,
): Promise<{ ok: true } | { ok: false; bloqueo: EstadoBloqueo }> {
  const existente = await leerBloqueo(fila)
  if (existente && existente.correoDueno !== correo) return { ok: false, bloqueo: existente }

  if (existente) {
    await getDb()
      .update(schema.bloqueos)
      .set({ ultimoLatido: new Date() })
      .where(eq(schema.bloqueos.fila, fila))
    return { ok: true }
  }

  await getDb()
    .insert(schema.bloqueos)
    .values({ fila, correoDueno: correo })
    .onConflictDoNothing()

  // Si otra persona ganó la carrera, su bloqueo es el que vale.
  const tras = await leerBloqueo(fila)
  if (tras && tras.correoDueno !== correo) return { ok: false, bloqueo: tras }
  return { ok: true }
}

export async function latir(fila: number, correo: string): Promise<void> {
  await getDb()
    .update(schema.bloqueos)
    .set({ ultimoLatido: new Date() })
    .where(and(eq(schema.bloqueos.fila, fila), eq(schema.bloqueos.correoDueno, correo)))
}

export async function liberarBloqueo(fila: number, correo: string): Promise<void> {
  await getDb()
    .delete(schema.bloqueos)
    .where(and(eq(schema.bloqueos.fila, fila), eq(schema.bloqueos.correoDueno, correo)))
}

/** Devuelve el correo de quien lo tenía, para poder registrarlo en la bitácora. */
export async function forzarBloqueo(fila: number): Promise<string | null> {
  const previo = await leerBloqueo(fila)
  await getDb().delete(schema.bloqueos).where(eq(schema.bloqueos.fila, fila))
  return previo?.correoDueno ?? null
}
```

Crear `src/lib/casos/bitacora.ts`:

```ts
import { desc, eq } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import type { Cambio } from './seguimiento'

type TipoBitacora = 'guardado' | 'bloqueo_forzado' | 'folio_capturado'

export async function registrarCambios(
  fila: number,
  folio: string | null,
  correoUsuario: string,
  cambios: Cambio[],
  tipo: TipoBitacora = 'guardado',
): Promise<void> {
  if (cambios.length === 0) return
  await getDb()
    .insert(schema.bitacora)
    .values(
      cambios.map((c) => ({
        fila,
        folio,
        correoUsuario,
        campo: c.etiqueta,
        valorAnterior: c.anterior,
        valorNuevo: c.nuevo,
        tipo,
      })),
    )
}

export async function registrarAccion(
  fila: number,
  folio: string | null,
  correoUsuario: string,
  campo: string,
  detalle: string,
  tipo: TipoBitacora,
): Promise<void> {
  await getDb().insert(schema.bitacora).values({
    fila,
    folio,
    correoUsuario,
    campo,
    valorAnterior: null,
    valorNuevo: detalle,
    tipo,
  })
}

export async function leerBitacora(fila: number, limite = 50) {
  return getDb()
    .select()
    .from(schema.bitacora)
    .where(eq(schema.bitacora.fila, fila))
    .orderBy(desc(schema.bitacora.creadoEn))
    .limit(limite)
}
```

Crear `src/lib/casos/eventos.ts`:

```ts
import { getDb, schema } from '@/db'

type TipoEvento =
  | 'caso_visualizado'
  | 'caso_tomado'
  | 'conversacion_iniciada'
  | 'respuesta_enviada'
  | 'caso_guardado'
  | 'caso_cerrado'
  | 'importacion_solicitada'

/**
 * Eventos de la sección 11 del PRD, insumo del reporteo de la Fase 2.
 * Nunca deben tumbar la operación: si el registro falla, se anota y se sigue.
 */
export async function emitirEvento(evento: {
  tipo: TipoEvento
  fila?: number
  folio?: string | null
  tipoTramite?: string | null
  estatusResultante?: string | null
  motivo?: string | null
  correoUsuario: string
}): Promise<void> {
  try {
    await getDb().insert(schema.eventosBi).values({
      tipo: evento.tipo,
      fila: evento.fila ?? null,
      folio: evento.folio ?? null,
      tipoTramite: evento.tipoTramite ?? null,
      estatusResultante: evento.estatusResultante ?? null,
      motivo: evento.motivo ?? null,
      correoUsuario: evento.correoUsuario,
    })
  } catch (e) {
    console.error('No se pudo registrar el evento de BI', evento.tipo, e)
  }
}
```

- [ ] **Step 6: Suite completa y commit**

Run: `pnpm test && pnpm build`

```bash
git add -A
git commit -m "feat: bloqueo de caso, bitácora de cambios y eventos de BI"
```

---

## Task 5: Vista del caso

**Files:**
- Create: `src/app/caso/[fila]/page.tsx`, `src/app/caso/[fila]/seguimiento-form.tsx`, `src/app/caso/[fila]/acciones.ts`
- Modify: `src/app/cola/page.tsx` (enlazar cada fila al caso), `src/lib/casos/consulta.ts` (añadir `cargarCaso`)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - `cargarCaso(fila: number): Promise<{ caso: Caso; catalogos: Catalogos; mapa: MapaEsquema } | null>` en `consulta.ts`. Devuelve el mapa para que el guardado no relea la hoja.
  - Server Actions en `acciones.ts`: `guardarSeguimiento(fila, formData)`, `liberar(fila)`, `forzar(fila)`, `capturarFolio(fila, folio)`.

- [ ] **Step 1: Añadir la carga del caso individual**

En `src/lib/casos/consulta.ts`, agregar. Nótese que **no se cachea por caso**: se reutiliza la lectura de la cola y se filtra, para no multiplicar las llamadas a Sheets.

```ts
import { leerCatalogos } from '@/lib/google/sheet-catalogs'
import type { Catalogos } from '@/lib/google/sheet-catalogs'

export async function cargarCaso(
  fila: number,
): Promise<{ caso: Caso; catalogos: Catalogos; mapa: MapaEsquema } | null> {
  const accessToken = await accessTokenDeLaMesa()
  const deps = {
    fetch: globalThis.fetch,
    accessToken,
    sheetId: process.env.SHEET_ID!,
    pestana: process.env.SHEET_PESTANA ?? 'Respuestas de formulario 1',
  }
  const { casos, mapa } = await leerCasos(deps)
  const caso = casos.find((c) => c.fila === fila)
  if (!caso) return null
  const catalogos = await leerCatalogos(deps, mapa, fila)
  // Se devuelve el mapa para que guardar no tenga que releer las 1,426 filas:
  // una lectura completa por guardado sería gasto de cuota sin necesidad.
  return { caso, catalogos, mapa }
}
```

- [ ] **Step 2: Server Actions**

Crear `src/app/caso/[fila]/acciones.ts`:

```ts
'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { requerirUsuario } from '@/lib/auth/guard'
import { registrarAccion, registrarCambios } from '@/lib/casos/bitacora'
import { forzarBloqueo, liberarBloqueo } from '@/lib/casos/bloqueo'
import { estaVivo } from '@/lib/casos/caso'
import { cargarCaso } from '@/lib/casos/consulta'
import { emitirEvento } from '@/lib/casos/eventos'
import { componerObservaciones } from '@/lib/casos/observaciones'
import { calcularDiff, type Seguimiento } from '@/lib/casos/seguimiento'
import { formatearFechaHoja } from '@/lib/fecha'
import { accessTokenDeLaMesa } from '@/lib/google/auth-mesa'
import { FilaCambiadaError, escribirFolio, escribirSeguimiento } from '@/lib/google/sheet-writer'

export type ResultadoGuardado =
  | { ok: true; cambios: number }
  | { ok: false; error: string; conflicto?: boolean }

async function depsDeGoogle() {
  const accessToken = await accessTokenDeLaMesa()
  return {
    fetch: globalThis.fetch,
    accessToken,
    sheetId: process.env.SHEET_ID!,
    pestana: process.env.SHEET_PESTANA ?? 'Respuestas de formulario 1',
  }
}

export async function guardarSeguimiento(
  fila: number,
  propuesto: Seguimiento,
  notaNueva: string,
): Promise<ResultadoGuardado> {
  const usuario = await requerirUsuario()
  const cargado = await cargarCaso(fila)
  if (!cargado) return { ok: false, error: 'El caso ya no existe en la hoja.' }
  const { caso, mapa } = cargado

  const valores: Seguimiento = { ...propuesto }

  // Observaciones: acumulativo, nunca sobrescribe.
  const ahora = new Date()
  if (notaNueva.trim()) {
    valores.observaciones = componerObservaciones(
      caso.observaciones,
      notaNueva,
      usuario.nombreEnHoja ?? usuario.correo,
      ahora,
    )
  } else {
    delete valores.observaciones
  }

  // Sellado de la fecha de atención final al cerrar el caso.
  const cerrandoAhora =
    valores.estatusFinal && !estaVivo({ estatusFinal: valores.estatusFinal }) && estaVivo(caso)
  if (cerrandoAhora && !caso.fechaAtencionFinal) {
    valores.fechaAtencionFinal = formatearFechaHoja(ahora)
  }

  const cambios = calcularDiff(caso, valores)
  if (cambios.length === 0) return { ok: true, cambios: 0 }

  try {
    await escribirSeguimiento(await depsDeGoogle(), mapa, fila, valores, {
      marcaTemporalTexto: caso.marcaTemporalTexto,
      folio: caso.folio,
    })
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error desconocido al guardar.',
      conflicto: e instanceof FilaCambiadaError,
    }
  }

  await registrarCambios(fila, caso.folio, usuario.correo, cambios)
  await emitirEvento({
    tipo: 'caso_guardado',
    fila,
    folio: caso.folio,
    tipoTramite: caso.tipoTramite,
    estatusResultante: valores.estatusFinal ?? caso.estatusFinal,
    correoUsuario: usuario.correo,
  })
  if (cerrandoAhora) {
    await emitirEvento({
      tipo: 'caso_cerrado',
      fila,
      folio: caso.folio,
      tipoTramite: caso.tipoTramite,
      estatusResultante: valores.estatusFinal,
      correoUsuario: usuario.correo,
    })
  }

  updateTag('casos')
  revalidatePath(`/caso/${fila}`)
  return { ok: true, cambios: cambios.length }
}

export async function liberar(fila: number): Promise<void> {
  const usuario = await requerirUsuario()
  await liberarBloqueo(fila, usuario.correo)
  revalidatePath(`/caso/${fila}`)
}

export async function forzar(fila: number): Promise<void> {
  const usuario = await requerirUsuario()
  const previo = await forzarBloqueo(fila)
  if (previo && previo !== usuario.correo) {
    await registrarAccion(
      fila,
      null,
      usuario.correo,
      'Bloqueo',
      `Liberación forzada; lo tenía ${previo}`,
      'bloqueo_forzado',
    )
  }
  revalidatePath(`/caso/${fila}`)
}

export async function capturarFolio(fila: number, folio: string): Promise<ResultadoGuardado> {
  const usuario = await requerirUsuario()
  const cargado = await cargarCaso(fila)
  if (!cargado) return { ok: false, error: 'El caso ya no existe en la hoja.' }

  try {
    await escribirFolio(await depsDeGoogle(), cargado.mapa, fila, folio, {
      marcaTemporalTexto: cargado.caso.marcaTemporalTexto,
      folio: cargado.caso.folio,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al capturar el folio.' }
  }

  await registrarAccion(fila, folio, usuario.correo, 'Folio de atención', folio, 'folio_capturado')
  updateTag('casos')
  revalidatePath(`/caso/${fila}`)
  return { ok: true, cambios: 1 }
}
```

- [ ] **Step 3: Formulario de captura**

Crear `src/app/caso/[fila]/seguimiento-form.tsx` como Client Component. Requisitos concretos:

- Un `<select>` por cada campo con catálogo, con las opciones exactas que devuelve `leerCatalogos` y una opción vacía inicial.
- `quienAtendio` preseleccionado con `nombreEnHoja` del usuario si el caso no tiene responsable.
- `folioInterno` como texto libre.
- Un `<textarea>` para **la nota nueva** de observaciones, con el histórico mostrado arriba en modo lectura y la leyenda "tu nota se agregará arriba, sin borrar lo anterior".
- Al pulsar **Guardar cambios**, mostrar el diff (`etiqueta: anterior → nuevo`) y pedir confirmación antes de llamar a la Server Action.
- Si la acción devuelve `conflicto`, mostrar el mensaje de fila cambiada **conservando lo capturado** y ofreciendo reintentar.
- Deshabilitar el formulario cuando el caso está bloqueado por otra persona.

- [ ] **Step 4: Página del caso**

Crear `src/app/caso/[fila]/page.tsx`. Requisitos concretos:

- `requerirUsuario()` primero; `cargarCaso(fila)`; si es null, mostrar "ese caso no existe" con enlace a la cola.
- `adquirirBloqueo` al entrar. Si lo tiene otro: banner con quién y desde cuándo, formulario deshabilitado y botón **Forzar liberación**. Si es propio: botón **Liberar**.
- Emitir `caso_visualizado` y, cuando se adquiere el bloqueo, `caso_tomado`.
- Columna izquierda: datos de la petición mostrando **solo los campos con dato**, más `agruparCamposExtra(caso.camposExtra)`.
- Adjuntos como enlaces `target="_blank"` con su etiqueta.
- Si `sinFolio(caso)`: aviso con el campo para capturarlo.
- Columna derecha: por ahora un marcador con la leyenda "La conversación por correo llega en la etapa 3".
- Debajo del formulario: la bitácora (`leerBitacora`) con autor, campo, valor anterior y nuevo.

- [ ] **Step 5: Enlazar la cola con el caso**

En `src/app/cola/page.tsx`, envolver el folio de cada fila en `<a href={`/caso/${caso.fila}`}>` y dar `cursor-pointer` a la fila.

- [ ] **Step 6: Suite y build**

Run: `pnpm test && pnpm build`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: vista de caso con captura de seguimiento, bloqueo y bitácora"
```

---

## Task 6: Verificación de escritura sobre la hoja de pruebas

Esta tarea es la primera vez que el sistema escribe. **Se avisa al solicitante antes de ejecutarla.**

- [ ] **Step 1: Elegir una fila de prueba**

Localizar en la hoja de **desarrollo** un caso reciente y anotar su fila, folio, marca temporal y el contenido actual de `JZ`, `KA`, `KE`, `KJ`, para poder comparar después.

- [ ] **Step 2: Guardar un cambio mínimo**

Abrir el caso en la app, cambiar **solo** el estatus inicial, confirmar el diff y guardar.

- [ ] **Step 3: Verificar en la hoja, celda por celda**

Comprobar en la hoja de desarrollo:
1. `JZ` tiene el valor nuevo.
2. `KA`, `KE`, `KF`, `KG`, `KH`, `KI`, `KJ` **no cambiaron**.
3. Ninguna columna del formulario (`A`–`JX`) cambió.
4. Las fórmulas de `KO`–`KU` siguen siendo fórmulas, no valores.

- [ ] **Step 4: Verificar la bitácora**

La entrada aparece con el usuario correcto, el valor anterior y el nuevo.

- [ ] **Step 5: Probar la nota de observaciones**

Agregar una nota; verificar que en `KJ` quedó arriba con fecha y autor, y que el texto anterior sigue íntegro.

- [ ] **Step 6: Probar el conflicto de fila**

Con el caso abierto en la app, editar a mano la marca temporal de esa fila en la hoja, luego guardar desde la app. Debe abortar con el mensaje de fila cambiada y **sin** escribir. Restaurar la marca temporal.

- [ ] **Step 7: Probar el bloqueo**

Abrir el mismo caso en dos navegadores con cuentas distintas. El segundo debe verlo bloqueado con el nombre del primero, y poder forzarlo; el forzado queda en la bitácora.

- [ ] **Step 8: Probar el cierre**

Poner `KA` en `Concluida` y verificar que `KD` se llenó con la fecha y hora, y que el caso sale de la cola.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: verificación de escritura contra la hoja de pruebas"
```

---

## Task 7: Despliegue y cierre

- [ ] **Step 1: Suite completa**

Run: `pnpm test && pnpm build`

- [ ] **Step 2: Confirmar que la escritura sigue acotada**

```bash
grep -rn "escribirSeguimiento\|escribirFolio\|values:batchUpdate" src/ | grep -v test
```

Expected: solo `sheet-writer.ts` construye la petición, y solo `acciones.ts` la invoca.

- [ ] **Step 3: Desplegar**

```bash
vercel --prod --yes
```

- [ ] **Step 4: Verificar en producción**

Repetir en producción los pasos 2 a 5 de la Task 6, sobre la hoja de desarrollo.

- [ ] **Step 5: Actualizar el avance**

Añadir a `docs/AVANCE.md` el estado de la Etapa 2 y los hallazgos nuevos.

---

## Criterio de cierre de la Etapa 2

La etapa está terminada cuando, en producción: se abre un caso desde la cola y se ven solo sus campos con dato y sus adjuntos navegables; los desplegables ofrecen exactamente los valores de la validación de la hoja; el guardado escribe únicamente las columnas de seguimiento de la fila correcta tras confirmar el diff; una nota nueva se acumula en `KJ` con autor y fecha sin borrar lo anterior; cerrar el caso sella `KD` y lo saca de la cola; editar la fila por fuera hace que el guardado aborte con explicación; el bloqueo impide que dos personas se pisen y su forzado queda registrado; y la suite pasa completa.

Al cerrar, se escribe el plan de la Etapa 3 (conversación por correo).
