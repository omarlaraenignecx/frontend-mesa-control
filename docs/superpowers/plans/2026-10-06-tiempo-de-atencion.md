# Tiempo de atención por caso — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada caso de la Mesa de Control que se cierra (Concluida o Improcedente) guarda en una columna nueva, «Tiempo de atención (horas)», las horas naturales entre su llegada (A) y su atención final (KD). Un script llena el histórico.

**Architecture:** La columna es de la zona de la mesa, como KV «Reclasificación»: se localiza por encabezado (`sheet-schema.ts`), entra a la lista blanca del writer (`sheet-writer.ts`) y se manda como número con RAW. La regla de cuándo y cuánto vive en un módulo puro (`lib/casos/tiempo-atencion.ts`), que usan tanto `guardarSeguimiento` como el script del histórico.

**Tech Stack:** Next.js 16 (server actions), TypeScript, Vitest (`pnpm test`, con `TZ=UTC`), Google Sheets API v4 por `fetch`, tsx + dotenv-cli para scripts.

**Spec:** `docs/superpowers/specs/2026-10-06-tiempo-de-atencion-design.md`

## Global Constraints

- Encabezado exacto de la columna: `Tiempo de atención (horas)`. Normalizado: `tiempo de atencion (horas)`.
- Estatus que cierran: los de `ESTATUS_TERMINALES` (`concluida`, `improcedente`), sin lista nueva.
- Unidad: horas naturales, número redondeado a 2 decimales.
- Sólo casos de la mesa: `esSiniestro(caso)` ⇒ nunca se escribe.
- Nunca sobrescribir una celda de tiempo con dato.
- Se escribe con `valueInputOption=RAW` y el valor como **número JSON**, nunca como cadena.
- Ningún cambio de interfaz (formulario o listado).
- Comentarios y mensajes en español, con el tono de los archivos vecinos (explican el porqué).
- Commits en español con prefijo (`feat:`, `test:`, `docs:`) y la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- El script **nunca** escribe sin `--escribir`, y no se corre contra la hoja productiva sin la autorización explícita de Omar.

## Review Focus

1. **KD sin hora («5/8/2026»):** no debe producir un tiempo. Lo prueba la Tarea 3 (`tiempoASellar` da `null`).
2. **El formulario manda `tiempoAtencion` por su cuenta:** se descarta y se recalcula. Lo prueba la Tarea 4 (`conTiempoAtencion`).
3. **La hoja todavía no tiene la columna (despliegue antes del script):** el guardado sigue sin el tiempo y sin lanzar `ColumnaNoEscribibleError`. Lo prueba la Tarea 4 (`hayColumna = false`).
4. **Valor no numérico en `tiempoAtencion` al writer:** se rechaza antes de cualquier llamada HTTP. Lo prueba la Tarea 2.
5. **Alguien movió la columna entre la lectura y la escritura del script:** `escribirTiempos` relee el encabezado y aborta. Lo prueba la Tarea 5.

---

### Task 1: La hoja conoce la columna «Tiempo de atención (horas)»

**Files:**
- Rename: `src/lib/google/__fixtures__/encabezados-308.json` → `src/lib/google/__fixtures__/encabezados-309.json`
- Modify: `src/lib/google/sheet-schema.ts`
- Modify: `src/lib/casos/caso.ts` (tipo `Caso`)
- Modify: `src/lib/google/sheet-reader.ts` (`construirCasos`)
- Modify: `src/lib/casos/__fixtures__/caso.ts` (`casoDePrueba`)
- Modify imports of the fixture in: `src/lib/google/sheet-schema.test.ts`, `sheet-writer.test.ts`, `sheet-catalogs.test.ts`, `sheet-reader.test.ts`
- Test: `src/lib/google/sheet-schema.test.ts`, `src/lib/google/sheet-reader.test.ts`

**Interfaces:**
- Produces: `CampoLogico` incluye `'tiempoAtencion'`; `Caso.tiempoAtencion: string | null`; `ENCABEZADO_TIEMPO_ATENCION = 'Tiempo de atención (horas)'` y `ubicarColumnaTiempo(encabezados: string[]): { columna: number; existe: boolean }`, exportados de `sheet-schema.ts`.

- [ ] **Step 1: Mover el fixture y agregar la columna 309**

```bash
git mv src/lib/google/__fixtures__/encabezados-308.json src/lib/google/__fixtures__/encabezados-309.json
sed -i '' "s#encabezados-308.json#encabezados-309.json#" src/lib/google/sheet-schema.test.ts src/lib/google/sheet-writer.test.ts src/lib/google/sheet-catalogs.test.ts src/lib/google/sheet-reader.test.ts
```

Edita el JSON a mano:
- Agrega `"Tiempo de atención (horas)"` al final del arreglo `encabezados`, después de `"Reclasificación"`.
- Cambia `"columnas": 308` por `"columnas": 309`.
- Agrega al final de `descripcion`: ` La columna 309 (KW, 'Tiempo de atención (horas)') se agregó el 6 de octubre de 2026: también es de la mesa, y guarda las horas entre la llegada de la petición y su atención final.`

- [ ] **Step 2: Escribir las pruebas que fallan**

En `sheet-schema.test.ts`:
- agrega `expect(letraColumna(309)).toBe('KW')` en el `describe('letraColumna')`;
- agrega `'tiempoAtencion'` a la lista `DE_SEGUIMIENTO` de la prueba «ningún campo del formulario toma columnas de la zona de seguimiento»;
- agrega `ubicarColumnaTiempo` al import de `./sheet-schema` y añade este bloque:

```ts
describe('columna del tiempo de atención', () => {
  const mapa = construirMapa(ENCABEZADOS)

  it('resuelve KW como tiempoAtencion, de la zona de la mesa', () => {
    expect(mapa.columnasPorCampo.tiempoAtencion).toEqual([309]) // KW
    expect(mapa.indicesSinResolver).not.toContain(309)
  })

  it('la ubica por encabezado cuando ya existe', () => {
    expect(ubicarColumnaTiempo(ENCABEZADOS)).toEqual({ columna: 309, existe: true })
  })

  it('cuando falta, propone la primera columna después de la última con encabezado', () => {
    const sinTiempo = ENCABEZADOS.slice(0, 308)
    expect(ubicarColumnaTiempo(sinTiempo)).toEqual({ columna: 309, existe: false })
    // Celdas vacías al final no cuentan como columna ocupada.
    expect(ubicarColumnaTiempo([...sinTiempo, '', ''])).toEqual({ columna: 309, existe: false })
  })
})
```

En `sheet-reader.test.ts`, cambia `new Array(307)` por `new Array(309)` en el helper `fila` (y su comentario a «309 celdas»), y agrega:

```ts
  it('lee el tiempo de atención de su columna', () => {
    const [caso] = construirCasos(
      [fila({ 1: '5/8/2026 15:14:58', 285: '7000', 309: '26.5' })],
      MAPA,
      ENCABEZADOS,
      2026,
    )
    expect(caso.tiempoAtencion).toBe('26.5')
  })
```

- [ ] **Step 3: Correr y verificar que fallan**

Run: `pnpm test src/lib/google/sheet-schema.test.ts src/lib/google/sheet-reader.test.ts`
Expected: FAIL (`ubicarColumnaTiempo` no existe; `tiempoAtencion` undefined).

- [ ] **Step 4: Implementar**

`sheet-schema.ts`:
- agrega `| 'tiempoAtencion'` al final de `CampoLogico`;
- en `ALIAS`, después de `reclasificacion`:

```ts
  /**
   * Horas naturales entre la llegada de la petición (A) y su atención final (KD).
   * Columna de la mesa (KW), como la reclasificación; la escribe la aplicación al
   * cerrar un caso. Ver `lib/casos/tiempo-atencion.ts`.
   */
  tiempoAtencion: ['tiempo de atencion (horas)'],
```

- agrega `'tiempoAtencion'` al final de `CAMPOS_COLUMNA_UNICA`;
- al final del archivo:

```ts
export const ENCABEZADO_TIEMPO_ATENCION = 'Tiempo de atención (horas)'

/**
 * Dónde vive —o dónde va a vivir— la columna del tiempo de atención. Si la hoja
 * ya la tiene, se ubica por encabezado; si no, es la primera después de la última
 * columna con encabezado, que es donde el área abrió la de reclasificación.
 */
export function ubicarColumnaTiempo(encabezados: string[]): { columna: number; existe: boolean } {
  const clave = normalizarEncabezado(ENCABEZADO_TIEMPO_ATENCION)
  const actual = encabezados.findIndex((t) => normalizarEncabezado(t ?? '') === clave)
  if (actual >= 0) return { columna: actual + 1, existe: true }
  let ultima = 0
  encabezados.forEach((t, i) => {
    if (t?.trim()) ultima = i + 1
  })
  return { columna: ultima + 1, existe: false }
}
```

`caso.ts`, en el tipo `Caso`, después de `reclasificacion`:

```ts
  /**
   * Horas de atención que escribió la aplicación al cerrar el caso, tal como las
   * muestra la hoja. Sólo se usa para saber si ya hay dato: nunca se sobrescribe.
   */
  tiempoAtencion: string | null
```

`sheet-reader.ts`, en `construirCasos`, después de `reclasificacion: campo(fila, 'reclasificacion'),`:

```ts
      tiempoAtencion: campo(fila, 'tiempoAtencion'),
```

`__fixtures__/caso.ts`, en `casoDePrueba`, después de `reclasificacion: null,`:

```ts
    tiempoAtencion: null,
```

- [ ] **Step 5: Correr toda la suite y el typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. Si una prueba existente fijaba el número de columnas (308) o el rango de lectura (`A2:KV`), actualízala a 309 / `A2:KW`. Es la consecuencia esperada de la columna nueva y no indica un error.

- [ ] **Step 6: Commit**

```bash
git add -A src/lib/google src/lib/casos/caso.ts src/lib/casos/__fixtures__/caso.ts
git commit -m "feat: la hoja conoce la columna del tiempo de atención

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: El writer puede escribir el tiempo, como número

**Files:**
- Modify: `src/lib/google/sheet-writer.ts`
- Modify: `src/lib/casos/seguimiento.ts` (`ETIQUETAS_SEGUIMIENTO`)
- Test: `src/lib/google/sheet-writer.test.ts`

**Interfaces:**
- Consumes: `CampoLogico 'tiempoAtencion'` (Task 1).
- Produces: `CampoEscribible` incluye `'tiempoAtencion'`; `escribirSeguimiento(deps, mapa, fila, { tiempoAtencion: '26.5' }, testigo)` manda `values: [[26.5]]` con RAW; `ETIQUETAS_SEGUIMIENTO.tiempoAtencion === 'Tiempo de atención (horas)'`.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `sheet-writer.test.ts`, agrega `'tiempoAtencion',` a la lista esperada de la prueba «declara las diez columnas…», con el comentario `// Columna de la mesa (KW); la calcula la aplicación al cerrar.`. Luego agrega:

```ts
describe('tiempo de atención', () => {
  it('lo manda como número y con RAW, para que PROMEDIO lo cuente', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { tiempoAtencion: '26.5' },
      TESTIGO,
    )
    const [escritura] = escrituras(llamadas)
    expect(escritura.url).toContain('valueInputOption=RAW')
    const cuerpo = JSON.parse(String(escritura.init!.body))
    expect(cuerpo.data).toEqual([
      {
        range: 'Respuestas de formulario 1!KW7176',
        majorDimension: 'ROWS',
        values: [[26.5]],
      },
    ])
  })

  it('rechaza un tiempo que no es número sin llamar a Google', async () => {
    const { fetchMock } = fetchDeEscritura()
    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchMock },
        MAPA,
        7176,
        { tiempoAtencion: 'veinte' },
        TESTIGO,
      ),
    ).rejects.toThrow(/no es un número/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm test src/lib/google/sheet-writer.test.ts`
Expected: FAIL (`tiempoAtencion` rechazado por la lista blanca con `ColumnaNoEscribibleError`).

- [ ] **Step 3: Implementar**

En `sheet-writer.ts`:
- agrega `| 'tiempoAtencion'` a `CampoEscribible` y `'tiempoAtencion',` al final de `CAMPOS_ESCRIBIBLES`. Al comentario de la lista blanca añade un párrafo:

```ts
 * `tiempoAtencion` es otra columna de la mesa (KW). No la teclea nadie: la calcula
 * la aplicación al cerrar un caso, a partir de A y KD. Ver `lib/casos/tiempo-atencion.ts`.
```

- debajo de `esCampoDeFecha`:

```ts
/**
 * Campos que van a la hoja como número. Con RAW, una cadena "26.5" quedaría como
 * texto y `PROMEDIO` la ignoraría; con `USER_ENTERED` el punto decimal dependería
 * de la configuración regional del libro. Un número JSON con RAW no depende de
 * ninguna de las dos cosas.
 */
const CAMPOS_NUMERICOS = ['tiempoAtencion'] as const satisfies readonly CampoEscribible[]

function valorParaLaHoja(campo: CampoEscribible, valor: string): string | number {
  if (!(CAMPOS_NUMERICOS as readonly string[]).includes(campo)) return valor
  const numero = Number(valor)
  if (!valor.trim() || !Number.isFinite(numero)) {
    throw new Error(`El ${campo} "${valor}" no es un número; la herramienta no lo escribe.`)
  }
  return numero
}
```

- en `escribirCeldas`, cambia el tipo de `celdas` a `{ columna: number; valor: string | number }[]`.
- en `escribirSeguimiento`, justo después del `for` de la lista blanca y **antes** de `confirmarFila`, valida y convierte:

```ts
  // También antes de cualquier llamada: un tiempo ilegible se rechaza sin tocar la hoja.
  const convertidos = entradas.map(([campo, valor]) => [campo, valorParaLaHoja(campo, valor)] as const)
```

y arma `celdas` desde `convertidos` en lugar de `entradas`:

```ts
  const celdas = convertidos.map(([campo, valor]) => ({
    campo,
    columna: columnaDe(mapa, campo),
    valor,
  }))
```

En `seguimiento.ts`, agrega al final de `ETIQUETAS_SEGUIMIENTO`:

```ts
  // No se captura en el formulario; aparece en la bitácora cuando la aplicación lo sella.
  tiempoAtencion: 'Tiempo de atención (horas)',
```

- [ ] **Step 4: Correr toda la suite y el typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/sheet-writer.ts src/lib/google/sheet-writer.test.ts src/lib/casos/seguimiento.ts
git commit -m "feat: el tiempo de atención entra a la lista blanca y se escribe como número

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: La regla del tiempo de atención

**Files:**
- Create: `src/lib/casos/tiempo-atencion.ts`
- Test: `src/lib/casos/tiempo-atencion.test.ts`

**Interfaces:**
- Consumes: `Caso.tiempoAtencion` (Task 1); `esSiniestro` de `./area`; `estaVivo`, `parsearFechaHoja` de `./caso`.
- Produces:
  - `horasDeAtencion(recibido: Date, cierre: Date): number | null`
  - `tiempoASellar(caso: Pick<Caso, 'area' | 'marcaTemporalTexto' | 'tiempoAtencion'>, estatusFinal: string | null | undefined, fechaCierreTexto: string | null | undefined): number | null`

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
import { describe, expect, it } from 'vitest'
import { casoDePrueba, siniestroDePrueba } from './__fixtures__/caso'
import { horasDeAtencion, tiempoASellar } from './tiempo-atencion'

// casoDePrueba llegó el 5/8/2026 15:14:58.
const LLEGADA = '5/8/2026 15:14:58'

describe('horasDeAtencion', () => {
  it('cuenta horas naturales con dos decimales', () => {
    const a = new Date('2026-08-05T21:14:58Z')
    expect(horasDeAtencion(a, new Date('2026-08-06T23:44:58Z'))).toBe(26.5)
    expect(horasDeAtencion(a, new Date('2026-08-05T21:34:58Z'))).toBe(0.33)
  })

  it('un cierre anterior a la llegada no es un tiempo', () => {
    const a = new Date('2026-08-05T21:14:58Z')
    expect(horasDeAtencion(a, new Date('2026-08-05T20:00:00Z'))).toBeNull()
  })
})

describe('tiempoASellar', () => {
  const caso = casoDePrueba({ marcaTemporalTexto: LLEGADA })

  it('sella al quedar Concluida o Improcedente', () => {
    expect(tiempoASellar(caso, 'Concluida', '6/8/2026 17:44:58')).toBe(26.5)
    expect(tiempoASellar(caso, 'Improcedente', '5/8/2026 16:14:58')).toBe(1)
  })

  it('no sella un caso abierto', () => {
    expect(tiempoASellar(caso, 'Tramite', '6/8/2026 17:44:58')).toBeNull()
    expect(tiempoASellar(caso, '', '6/8/2026 17:44:58')).toBeNull()
    expect(tiempoASellar(caso, null, '6/8/2026 17:44:58')).toBeNull()
  })

  it('no mide siniestros', () => {
    const s = siniestroDePrueba({ marcaTemporalTexto: LLEGADA })
    expect(tiempoASellar(s, 'Concluida', '6/8/2026 17:44:58')).toBeNull()
  })

  it('no sobrescribe un tiempo que ya está en la hoja', () => {
    const conDato = casoDePrueba({ marcaTemporalTexto: LLEGADA, tiempoAtencion: '3' })
    expect(tiempoASellar(conDato, 'Concluida', '6/8/2026 17:44:58')).toBeNull()
  })

  it('sin fecha de cierre usable no hay tiempo', () => {
    expect(tiempoASellar(caso, 'Concluida', null)).toBeNull()
    expect(tiempoASellar(caso, 'Concluida', 'ayer')).toBeNull()
    // Sólo el día: mediría hasta la medianoche y daría un tiempo falso.
    expect(tiempoASellar(caso, 'Concluida', '6/8/2026')).toBeNull()
  })

  it('reconoce el estatus aunque venga con otra capitalización o espacios', () => {
    expect(tiempoASellar(caso, ' concluida ', '6/8/2026 17:44:58')).toBe(26.5)
  })
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm test src/lib/casos/tiempo-atencion.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

```ts
import { esSiniestro } from './area'
import { estaVivo, parsearFechaHoja, type Caso } from './caso'

/**
 * Cuánto tardó la mesa en atender un caso: horas naturales desde que llegó la
 * respuesta del formulario (A) hasta su atención final (KD). Se guarda en la
 * columna «Tiempo de atención (horas)» para que el área saque el promedio en la
 * hoja.
 *
 * Son horas naturales —noches y fines de semana cuentan— porque las hábiles
 * exigirían un horario que nadie ha definido, y el número puro es lo que deja
 * que `PROMEDIO` y las tablas dinámicas funcionen sin formato de duración.
 */

const MS_POR_HORA = 60 * 60 * 1000

/** Una fecha de la hoja con hora. «5/8/2026» a secas no sirve para medir horas. */
const TRAE_HORA = /\s\d{1,2}:\d{2}/

export function horasDeAtencion(recibido: Date, cierre: Date): number | null {
  const ms = cierre.getTime() - recibido.getTime()
  // Un cierre anterior a la llegada es un dato mal capturado, no un tiempo.
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.round((ms / MS_POR_HORA) * 100) / 100
}

/**
 * Las horas que hay que escribir, o null si no toca.
 *
 * No exige que el cierre ocurra en este guardado: un caso que alguien cerró a
 * mano en la hoja se completa la próxima vez que se guarde desde la aplicación.
 * Tampoco recalcula: si la columna ya tiene dato —un cierre anterior, o algo que
 * el área corrigió— se respeta, igual que la fecha de KD.
 */
export function tiempoASellar(
  caso: Pick<Caso, 'area' | 'marcaTemporalTexto' | 'tiempoAtencion'>,
  estatusFinal: string | null | undefined,
  fechaCierreTexto: string | null | undefined,
): number | null {
  if (esSiniestro(caso)) return null
  if (estaVivo({ estatusFinal: estatusFinal ?? null })) return null
  if (caso.tiempoAtencion?.trim()) return null
  if (!fechaCierreTexto || !TRAE_HORA.test(fechaCierreTexto.trim())) return null
  const recibido = parsearFechaHoja(caso.marcaTemporalTexto)
  const cierre = parsearFechaHoja(fechaCierreTexto)
  if (!recibido || !cierre) return null
  return horasDeAtencion(recibido, cierre)
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `pnpm test src/lib/casos/tiempo-atencion.test.ts && pnpm typecheck`
Expected: PASS. Si «otra capitalización» falla, revisa `estaVivo`: ya hace `trim().toLowerCase()`, así que debería pasar sin cambios.

- [ ] **Step 5: Commit**

```bash
git add src/lib/casos/tiempo-atencion.ts src/lib/casos/tiempo-atencion.test.ts
git commit -m "feat: regla del tiempo de atención por caso

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: El guardado sella el tiempo al cerrar

**Files:**
- Modify: `src/lib/casos/tiempo-atencion.ts` (agrega `conTiempoAtencion`)
- Modify: `src/app/caso/[fila]/acciones.ts` (`guardarSeguimiento`)
- Test: `src/lib/casos/tiempo-atencion.test.ts`

**Interfaces:**
- Consumes: `tiempoASellar` (Task 3); `Seguimiento` de `./seguimiento` (incluye `tiempoAtencion` desde Task 2).
- Produces: `conTiempoAtencion(caso: Caso, valores: Seguimiento, hayColumna: boolean): Seguimiento`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Agrega `conTiempoAtencion` al import y este bloque a `tiempo-atencion.test.ts`:

```ts
describe('conTiempoAtencion', () => {
  const caso = casoDePrueba({ marcaTemporalTexto: LLEGADA })

  it('agrega el tiempo, como texto, cuando el guardado cierra el caso', () => {
    const valores = { estatusFinal: 'Concluida', fechaAtencionFinal: '6/8/2026 17:44:58' }
    expect(conTiempoAtencion(caso, valores, true)).toEqual({ ...valores, tiempoAtencion: '26.5' })
  })

  it('usa la KD que ya tenía el caso si este guardado no la sella', () => {
    const cerrado = casoDePrueba({
      marcaTemporalTexto: LLEGADA,
      estatusFinal: 'Concluida',
      fechaAtencionFinal: '5/8/2026 16:14:58',
    })
    expect(conTiempoAtencion(cerrado, { observaciones: 'x' }, true)).toEqual({
      observaciones: 'x',
      tiempoAtencion: '1',
    })
  })

  it('descarta un tiempo que mande el formulario: lo decide la aplicación', () => {
    expect(conTiempoAtencion(caso, { tiempoAtencion: '1', estatusFinal: 'Tramite' }, true)).toEqual({
      estatusFinal: 'Tramite',
    })
  })

  it('si la hoja aún no tiene la columna, el guardado sigue sin el tiempo', () => {
    const valores = { estatusFinal: 'Concluida', fechaAtencionFinal: '6/8/2026 17:44:58' }
    expect(conTiempoAtencion(caso, valores, false)).toEqual(valores)
  })
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm test src/lib/casos/tiempo-atencion.test.ts`
Expected: FAIL (`conTiempoAtencion` no existe).

- [ ] **Step 3: Implementar la función**

En `tiempo-atencion.ts`, agrega `import type { Seguimiento } from './seguimiento'` y:

```ts
/**
 * Los valores de un guardado, con el tiempo de atención agregado si toca.
 *
 * Lo que mande el formulario en `tiempoAtencion` se descarta siempre: es un dato
 * que calcula la aplicación, y la acción se puede invocar sin pasar por la
 * pantalla. Si la hoja todavía no tiene la columna, el guardado sigue sin él: no
 * se frena a la mesa por un dato de reporte.
 *
 * Va como texto, igual que el resto del seguimiento, para que el diff y la
 * bitácora lo traten como cualquier otro campo; el writer lo convierte en número.
 */
export function conTiempoAtencion(
  caso: Caso,
  valores: Seguimiento,
  hayColumna: boolean,
): Seguimiento {
  const { tiempoAtencion: _delCliente, ...resto } = valores
  if (!hayColumna) return resto
  const horas = tiempoASellar(
    caso,
    resto.estatusFinal ?? caso.estatusFinal,
    resto.fechaAtencionFinal ?? caso.fechaAtencionFinal,
  )
  return horas === null ? resto : { ...resto, tiempoAtencion: String(horas) }
}
```

(Si eslint marca `_delCliente` como variable sin usar, usa `// eslint-disable-next-line @typescript-eslint/no-unused-vars` en la línea anterior.)

- [ ] **Step 4: Usarla en `guardarSeguimiento`**

En `src/app/caso/[fila]/acciones.ts`, importa `import { conTiempoAtencion } from '@/lib/casos/tiempo-atencion'` y reemplaza:

```ts
  const cambios = calcularDiff(caso, valores)
```

por:

```ts
  // El tiempo de atención se calcula con la KD que acaba de sellarse o con la que ya
  // tenía el caso. Sólo en la mesa y sólo una vez; ver `lib/casos/tiempo-atencion.ts`.
  const aEscribir = conTiempoAtencion(
    caso,
    valores,
    mapa.columnasPorCampo.tiempoAtencion.length > 0,
  )

  const cambios = calcularDiff(caso, aEscribir)
```

El resto de la función sigue usando `valores` para el estatus de los eventos, sin cambios.

- [ ] **Step 5: Correr toda la suite, el typecheck y el lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/casos/tiempo-atencion.ts src/lib/casos/tiempo-atencion.test.ts "src/app/caso/[fila]/acciones.ts"
git commit -m "feat: al cerrar un caso de la mesa se guarda su tiempo de atención

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: El writer crea la columna y escribe el histórico en lote

**Files:**
- Modify: `src/lib/google/sheet-writer.ts`
- Test: `src/lib/google/sheet-writer.test.ts`

**Interfaces:**
- Consumes: `ENCABEZADO_TIEMPO_ATENCION`, `normalizarEncabezado`, `letraColumna` (Task 1); `pedir` (privada, mismo archivo).
- Produces:
  - `crearColumnaTiempo(deps: DepsLectura, columna: number): Promise<void>`
  - `escribirTiempos(deps: DepsLectura, columna: number, asignaciones: { fila: number; horas: number }[]): Promise<void>`

- [ ] **Step 1: Escribir las pruebas que fallan**

Agrega `crearColumnaTiempo, escribirTiempos` al import de `./sheet-writer` y:

```ts
function fetchDeHoja(respuestas: ((url: string, init?: RequestInit) => unknown)[]) {
  const llamadas: { url: string; init?: RequestInit }[] = []
  let i = 0
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    llamadas.push({ url: String(url), init })
    const cuerpo = respuestas[i++]?.(String(url), init) ?? {}
    return new Response(JSON.stringify(cuerpo), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof globalThis.fetch
  return { fetchMock, llamadas }
}

const PROPIEDADES = (columnas: number) => ({
  sheets: [
    { properties: { sheetId: 0, title: 'Otra', gridProperties: { columnCount: 500 } } },
    {
      properties: {
        sheetId: 1234,
        title: 'Respuestas de formulario 1',
        gridProperties: { columnCount: columnas },
      },
    },
  ],
})

describe('crearColumnaTiempo', () => {
  it('agranda la cuadrícula si no alcanza y escribe el encabezado', async () => {
    const { fetchMock, llamadas } = fetchDeHoja([() => PROPIEDADES(308), () => ({}), () => ({})])
    await crearColumnaTiempo({ ...DEPS_BASE, fetch: fetchMock }, 309)

    const agrandar = JSON.parse(String(llamadas[1].init!.body))
    expect(llamadas[1].url).toContain(':batchUpdate')
    expect(agrandar.requests).toEqual([
      { appendDimension: { sheetId: 1234, dimension: 'COLUMNS', length: 1 } },
    ])
    const encabezado = JSON.parse(String(llamadas[2].init!.body))
    expect(encabezado.data).toEqual([
      {
        range: 'Respuestas de formulario 1!KW1',
        majorDimension: 'ROWS',
        values: [['Tiempo de atención (horas)']],
      },
    ])
  })

  it('no agranda la cuadrícula si ya alcanza', async () => {
    const { fetchMock, llamadas } = fetchDeHoja([() => PROPIEDADES(320), () => ({})])
    await crearColumnaTiempo({ ...DEPS_BASE, fetch: fetchMock }, 309)
    expect(llamadas).toHaveLength(2)
    expect(llamadas[1].url).toContain('values:batchUpdate')
  })
})

describe('escribirTiempos', () => {
  it('relee el encabezado y escribe todos los tiempos en un lote RAW', async () => {
    const { fetchMock, llamadas } = fetchDeHoja([
      () => ({ values: [['Tiempo de atención (horas)']] }),
      () => ({}),
    ])
    await escribirTiempos({ ...DEPS_BASE, fetch: fetchMock }, 309, [
      { fila: 10, horas: 26.5 },
      { fila: 12, horas: 1 },
    ])
    expect(llamadas[1].url).toContain('valueInputOption=RAW')
    const cuerpo = JSON.parse(String(llamadas[1].init!.body))
    expect(cuerpo.data).toEqual([
      { range: 'Respuestas de formulario 1!KW10', majorDimension: 'ROWS', values: [[26.5]] },
      { range: 'Respuestas de formulario 1!KW12', majorDimension: 'ROWS', values: [[1]] },
    ])
  })

  it('aborta sin escribir si la columna ya no es la del tiempo', async () => {
    const { fetchMock, llamadas } = fetchDeHoja([() => ({ values: [['Otra cosa']] })])
    await expect(
      escribirTiempos({ ...DEPS_BASE, fetch: fetchMock }, 309, [{ fila: 10, horas: 2 }]),
    ).rejects.toThrow(/no es la del tiempo de atención/)
    expect(llamadas).toHaveLength(1)
  })

  it('sin asignaciones no llama a Google', async () => {
    const { fetchMock } = fetchDeHoja([])
    await escribirTiempos({ ...DEPS_BASE, fetch: fetchMock }, 309, [])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `pnpm test src/lib/google/sheet-writer.test.ts`
Expected: FAIL (funciones no existen).

- [ ] **Step 3: Implementar**

En `sheet-writer.ts`, amplía el import de `./sheet-schema` con `ENCABEZADO_TIEMPO_ATENCION, normalizarEncabezado` y agrega al final:

```ts
/**
 * Abre la columna del tiempo de atención al final de la hoja: la agrega a la
 * cuadrícula si no alcanza —escribir fuera de ella falla— y le pone encabezado.
 * Sólo la usa el script del histórico; la aplicación nunca crea columnas.
 */
export async function crearColumnaTiempo(deps: DepsLectura, columna: number): Promise<void> {
  const respuesta = await pedir(
    deps,
    `${BASE}/${deps.sheetId}?fields=${encodeURIComponent(
      'sheets.properties(sheetId,title,gridProperties.columnCount)',
    )}`,
  )
  const cuerpo = (await respuesta.json()) as {
    sheets?: {
      properties?: { sheetId?: number; title?: string; gridProperties?: { columnCount?: number } }
    }[]
  }
  const pestana = cuerpo.sheets?.find((s) => s.properties?.title === deps.pestana)?.properties
  if (pestana?.sheetId === undefined) {
    throw new Error(`No se encontró la pestaña "${deps.pestana}" en la hoja.`)
  }
  const actuales = pestana.gridProperties?.columnCount ?? 0
  if (actuales < columna) {
    await pedir(deps, `${BASE}/${deps.sheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            appendDimension: {
              sheetId: pestana.sheetId,
              dimension: 'COLUMNS',
              length: columna - actuales,
            },
          },
        ],
      }),
    })
  }
  await escribirCeldas(deps, 1, [{ columna, valor: ENCABEZADO_TIEMPO_ATENCION }])
}

/**
 * Escribe los tiempos del histórico en un solo lote.
 *
 * Antes relee el encabezado de la columna: si alguien la movió entre la lectura
 * del script y este momento, escribir por posición pondría horas en la columna de
 * otro. En ese caso no se escribe nada.
 */
export async function escribirTiempos(
  deps: DepsLectura,
  columna: number,
  asignaciones: { fila: number; horas: number }[],
): Promise<void> {
  if (asignaciones.length === 0) return
  const letra = letraColumna(columna)
  const respuesta = await pedir(
    deps,
    `${BASE}/${deps.sheetId}/values/${encodeURIComponent(`${deps.pestana}!${letra}1`)}` +
      '?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE',
  )
  const cuerpo = (await respuesta.json()) as { values?: string[][] }
  const encabezado = cuerpo.values?.[0]?.[0] ?? ''
  if (normalizarEncabezado(encabezado) !== normalizarEncabezado(ENCABEZADO_TIEMPO_ATENCION)) {
    throw new Error(
      `La columna ${letra} dice "${encabezado}" y no es la del tiempo de atención; no se escribe nada.`,
    )
  }
  await pedir(deps, `${BASE}/${deps.sheetId}/values:batchUpdate?valueInputOption=RAW`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: asignaciones.map(({ fila, horas }) => ({
        range: `${deps.pestana}!${letra}${fila}`,
        majorDimension: 'ROWS',
        values: [[horas]],
      })),
    }),
  })
}
```

- [ ] **Step 4: Correr toda la suite y el typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/sheet-writer.ts src/lib/google/sheet-writer.test.ts
git commit -m "feat: el writer abre la columna del tiempo y escribe el histórico en lote

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Script del histórico y su instructivo

**Files:**
- Create: `scripts/llenar-tiempo-atencion.ts`
- Create: `docs/PASO-A-PRODUCCION-TIEMPO-ATENCION.md`

**Interfaces:**
- Consumes: `accessTokenDeLaMesa` (`@/lib/google/auth-mesa`), `leerCasos` (`@/lib/google/sheet-reader`), `ubicarColumnaTiempo`, `letraColumna` (`@/lib/google/sheet-schema`), `crearColumnaTiempo`, `escribirTiempos` (Task 5), `tiempoASellar` (Task 3), `estaVivo` (`@/lib/casos/caso`), `esSiniestro` (`@/lib/casos/area`).

- [ ] **Step 1: Escribir el script**

```ts
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
```

- [ ] **Step 2: Typecheck y lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. Si `tsconfig` excluye `scripts/`, verifica con `pnpm tsx --tsconfig tsconfig.json -e "import('./scripts/llenar-tiempo-atencion.ts')"` sólo si el paso 3 falla por alias. Los otros scripts de `scripts/` ya importan con `@/`, así que el alias debería funcionar.

- [ ] **Step 3: Simulacro contra la hoja de desarrollo**

Primero confirma que `SHEET_ID` en `.env.local` **no** es la hoja productiva (`1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0`).

Run: `pnpm dotenv -e .env.local -- pnpm tsx scripts/llenar-tiempo-atencion.ts`
Expected: el reporte con columna `KW (se va a crear)`, conteos y «Simulacro: no se escribió nada». Pega la salida en el reporte de la tarea. Si falla por credencial (`SinCredencialMesaError`), repórtalo y no lo esquives.

- [ ] **Step 4: Escribir el instructivo**

`docs/PASO-A-PRODUCCION-TIEMPO-ATENCION.md`:

```markdown
# Tiempo de atención — paso a producción

1. Desplegar la rama. Mientras la hoja no tenga la columna, la aplicación guarda
   igual que antes y simplemente no sella el tiempo.
2. Con las variables de producción, correr el simulacro y revisar el reporte:
   columna destino (debe ser la primera libre después de «Reclasificación»),
   cuántos casos se llenan y el promedio resultante.

       pnpm dotenv -e .env.production.local -- pnpm tsx scripts/llenar-tiempo-atencion.ts

3. Si el reporte cuadra, correrlo con `--escribir`. Crea la columna
   «Tiempo de atención (horas)» y llena el histórico. Se puede repetir: no toca
   celdas con dato.
4. Desde ese momento, cada caso de la mesa que se cierre desde la aplicación
   (Concluida o Improcedente) guarda sus horas. El promedio en la hoja:
   `=PROMEDIO(KW2:KW)` (o la letra que haya quedado).

Notas:
- Siniestros no se mide.
- Un caso cerrado a mano en la hoja se completa la próxima vez que alguien lo
  guarde desde la aplicación, o al volver a correr el script.
- Para recalcular un caso, vaciar su celda y volver a guardar o correr el script.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/llenar-tiempo-atencion.ts docs/PASO-A-PRODUCCION-TIEMPO-ATENCION.md
git commit -m "feat: script que llena el tiempo de atención del histórico

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
