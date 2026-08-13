# Etapa 4 · Producción y cierre — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar la herramienta trabajando sobre la hoja productiva de Gplus Seguros, con las fechas que sella escritas correctamente, y cerrar el proyecto con su documentación en el repo de PRDs.

**Architecture:** Dos correcciones de código acotadas y un cambio de configuración. La primera concentra en un módulo nuevo (`src/lib/reloj.ts`) el único hecho que hoy nadie sabe en el sistema: que la hoja vive en UTC−6 y el servidor en UTC. La segunda parte la escritura en dos grupos según el tipo de dato, para que `KB` y `KD` queden como fecha de verdad sin exponer el texto de la mesa a que Sheets lo reinterprete. Después, el cambio de `SHEET_ID` en Vercel y la verificación en vivo con el área.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript estricto, Vitest, Google Sheets API v4, pnpm 11.5.1, Vercel CLI.

**Fuera de alcance de este plan:** **RF-13, importación bajo demanda** de periodos anteriores a 2026, excluida por decisión del 13/8/2026. Con ella queda fuera el evento `importacion_solicitada`, que es el único de los siete del PRD que no se emite; los otros seis ya se emiten y no requieren trabajo. El valor sigue declarado en el enum de `src/db/schema.ts`, así que retomarla después no necesita migración.

**Cobertura del diseño.** La sección 11 del diseño técnico define esta etapa como «los 7 eventos de BI, importación bajo demanda, afinado de errores, apuntar a la hoja productiva, despliegue a producción, `PLAN.md` y `AVANCE.md` al repo de PRDs», con la verificación «Keynor y Paty trabajan una jornada real en la herramienta». Aquí: los eventos de BI y la importación quedan resueltos o excluidos en el párrafo anterior; el **afinado de errores** es la ruta de falla parcial del guardado, en la Task 2, que es el único defecto de manejo de errores que la inspección encontró; la hoja productiva y el despliegue son la Task 3; la documentación y la jornada real, la Task 4.

## Global Constraints

- **La hoja productiva es `1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0`** y la copia de desarrollo es `1rimFXIxaM4HrBHC9YQfwYfkh0l-RBJdbe7SLM0CGxEQ`. `.env.local` **se queda apuntando a la copia** durante todo el plan: el cambio ocurre solo en la variable de entorno de Vercel, para que ninguna prueba local escriba en el registro real del cliente.
- **Zona horaria de la hoja: `Etc/GMT+6`**, es decir seis horas detrás de UTC, fija y sin horario de verano. `locale: es_MX`. Verificado en las dos hojas el 13/8/2026.
- **Ninguna prueba automatizada llama a Google.** El `fetch` se inyecta por `DepsLectura` y se simula, como en todo el repo.
- **`pnpm typecheck` es obligatorio** antes de dar por bueno cualquier cambio de tipos: `next build` no typechequea los archivos de prueba.
- **No usar `prettier`** en este repo: sin configuración reescribe archivos completos con un estilo que contradice el del código.
- La lista blanca de `CAMPOS_ESCRIBIBLES` en `src/lib/google/sheet-writer.ts` **no cambia** en este plan. Ninguna tarea agrega columnas escribibles.
- Comentarios y mensajes de interfaz en español, con acentos. Sin punto y coma, comillas simples, 100 columnas: el estilo del repo.

---

### Task 1: Reloj de la mesa — la hoja vive en UTC−6 y el servidor en UTC

**Contexto del defecto.** No hay una sola mención de zona horaria en `src/`. `formatearFechaHoja(new Date())` lee los componentes locales del proceso, y Vercel corre en UTC. Evidencia medida el 13/8/2026: el evento `conversacion_iniciada` de la fila 7182 quedó en la bitácora a las 22:07:12 UTC —16:07 de la Ciudad de México— y el sello que la app escribió en `KB` dice `11/8/2026 22:07:11`. Afecta a tres lugares: el sello de `KB`, el sello de `KD` y el prefijo `D/M/YYYY Nombre:` de las Observaciones, que además de la hora equivoca el **día** después de las 18:00 locales.

La corrección va en un módulo propio y no dentro de `fecha.ts`, porque el desfase también lo necesitan el parseo de la marca temporal y el conteo de días de espera, que no son formateo.

**Files:**
- Create: `src/lib/reloj.ts`
- Create: `src/lib/reloj.test.ts`
- Modify: `src/lib/fecha.ts` (`formatearFechaHoja`, `fechaCorta`)
- Modify: `src/lib/casos/caso.ts:43-52` (`parsearFechaHoja`)
- Modify: `src/lib/casos/semaforo.ts:35-41` (`diasDeEspera`)
- Modify: `package.json` (script `test`)
- Test: `src/lib/reloj.test.ts`, `src/lib/fecha.test.ts`, `src/lib/casos/caso.test.ts`, `src/lib/casos/semaforo.test.ts`

**Interfaces:**
- Produces: `partesDeLaMesa(instante: Date): PartesDeFecha` con `{ anio, mes, dia, horas, minutos, segundos }` donde `mes` va de 1 a 12; `instanteDeLaMesa(partes: PartesDeFecha): Date`; `diaDeLaMesa(instante: Date): number` (milisegundos de la medianoche de ese día, comparable entre instantes); `HORAS_DETRAS_DE_UTC: number`.
- Consumes: nada de otras tareas. Es la primera.

- [ ] **Step 1: Fijar la zona horaria de las pruebas en UTC**

Las pruebas corren hoy con la zona de la máquina, que en la Ciudad de México coincide con la de la hoja y esconde justo esta clase de error. Con `TZ=UTC` el entorno de prueba se parece a Vercel.

En `package.json`, en `"scripts"`:

```json
    "test": "TZ=UTC vitest run",
```

Verificar cómo queda escrito hoy antes de editar; si el script trae otros argumentos, se conservan y solo se antepone `TZ=UTC`.

- [ ] **Step 2: Correr la suite completa con la zona en UTC**

Run: `pnpm test`
Expected: la suite pasa o falla en pruebas que construyen fechas con `new Date(2026, 7, 11, 9, 30)` y comparan contra un texto. Anotar cuáles fallan: son las que asumían la zona de la máquina y se corrigen en el Step 10.

- [ ] **Step 3: Escribir las pruebas del reloj**

Crear `src/lib/reloj.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { diaDeLaMesa, instanteDeLaMesa, partesDeLaMesa } from './reloj'

describe('partesDeLaMesa', () => {
  it('traduce un instante a la hora que la mesa ve en la hoja', () => {
    // Caso real: la bitácora registró este envío a las 22:07:12 UTC y la hoja
    // debía decir 16:07, no 22:07.
    expect(partesDeLaMesa(new Date('2026-08-11T22:07:11Z'))).toEqual({
      anio: 2026,
      mes: 8,
      dia: 11,
      horas: 16,
      minutos: 7,
      segundos: 11,
    })
  })

  it('no adelanta el día cuando en UTC ya es mañana', () => {
    // 03:30 UTC del 12 son las 21:30 del 11 en la mesa: el día no cambia.
    expect(partesDeLaMesa(new Date('2026-08-12T03:30:00Z'))).toEqual({
      anio: 2026,
      mes: 8,
      dia: 11,
      horas: 21,
      minutos: 30,
      segundos: 0,
    })
  })

  it('cruza el fin de año sin equivocar el año', () => {
    expect(partesDeLaMesa(new Date('2027-01-01T04:00:00Z'))).toEqual({
      anio: 2026,
      mes: 12,
      dia: 31,
      horas: 22,
      minutos: 0,
      segundos: 0,
    })
  })
})

describe('instanteDeLaMesa', () => {
  it('es el inverso exacto de partesDeLaMesa', () => {
    const instante = new Date('2026-08-11T22:07:11Z')
    expect(instanteDeLaMesa(partesDeLaMesa(instante)).toISOString()).toBe(instante.toISOString())
  })

  it('interpreta una hora de pared de la hoja como el instante correcto', () => {
    // Las 9:30 del 11 de agosto en la hoja son las 15:30 UTC.
    const instante = instanteDeLaMesa({
      anio: 2026,
      mes: 8,
      dia: 11,
      horas: 9,
      minutos: 30,
      segundos: 0,
    })
    expect(instante.toISOString()).toBe('2026-08-11T15:30:00.000Z')
  })
})

describe('diaDeLaMesa', () => {
  it('dos instantes del mismo día en la mesa dan el mismo día', () => {
    const manana = new Date('2026-08-11T18:00:00Z') // 12:00 en la mesa
    const noche = new Date('2026-08-12T03:00:00Z') // 21:00 del mismo día
    expect(diaDeLaMesa(noche)).toBe(diaDeLaMesa(manana))
  })

  it('un día de diferencia son 24 horas exactas', () => {
    const uno = new Date('2026-08-11T18:00:00Z')
    const otro = new Date('2026-08-12T18:00:00Z')
    expect(diaDeLaMesa(otro) - diaDeLaMesa(uno)).toBe(24 * 60 * 60 * 1000)
  })
})
```

- [ ] **Step 4: Correr las pruebas y verificar que fallan**

Run: `pnpm vitest run src/lib/reloj.test.ts`
Expected: FAIL — `Failed to resolve import "./reloj"`.

- [ ] **Step 5: Escribir el reloj**

Crear `src/lib/reloj.ts`:

```ts
/**
 * La hoja declara `timeZone: Etc/GMT+6` y `locale: es_MX`: seis horas detrás de
 * UTC, fijas, sin horario de verano —México lo eliminó en 2022—. El servidor, en
 * cambio, corre en UTC cuando está en Vercel, así que `new Date()` y los getters
 * locales no dan la hora que la mesa ve en la hoja.
 *
 * Este módulo es el único lugar del sistema que conoce ese desfase. Se resuelve
 * con aritmética sobre el instante y los getters UTC, y no con `Intl`, para que
 * el resultado no dependa del ICU del entorno: esa dependencia ya nos obligó a
 * armar a mano los nombres de mes en `fecha.ts`.
 */
export const HORAS_DETRAS_DE_UTC = 6

const MS_POR_HORA = 60 * 60 * 1000

/** El mes va de 1 a 12, como se lee en la hoja, no como lo numera `Date`. */
export type PartesDeFecha = {
  anio: number
  mes: number
  dia: number
  horas: number
  minutos: number
  segundos: number
}

/** Los componentes de calendario que la mesa ve en la hoja para ese instante. */
export function partesDeLaMesa(instante: Date): PartesDeFecha {
  const corrido = new Date(instante.getTime() - HORAS_DETRAS_DE_UTC * MS_POR_HORA)
  return {
    anio: corrido.getUTCFullYear(),
    mes: corrido.getUTCMonth() + 1,
    dia: corrido.getUTCDate(),
    horas: corrido.getUTCHours(),
    minutos: corrido.getUTCMinutes(),
    segundos: corrido.getUTCSeconds(),
  }
}

/** El inverso: el instante real que corresponde a una hora de pared de la hoja. */
export function instanteDeLaMesa(partes: PartesDeFecha): Date {
  const utc = Date.UTC(
    partes.anio,
    partes.mes - 1,
    partes.dia,
    partes.horas,
    partes.minutos,
    partes.segundos,
  )
  return new Date(utc + HORAS_DETRAS_DE_UTC * MS_POR_HORA)
}

/**
 * La medianoche del día de la mesa, en milisegundos, para contar días naturales
 * sin que la hora estorbe y sin que el corte de las 18:00 locales mueva la
 * cuenta.
 */
export function diaDeLaMesa(instante: Date): number {
  const { anio, mes, dia } = partesDeLaMesa(instante)
  return Date.UTC(anio, mes - 1, dia)
}
```

- [ ] **Step 6: Correr las pruebas del reloj**

Run: `pnpm vitest run src/lib/reloj.test.ts`
Expected: PASS, 7 pruebas.

- [ ] **Step 7: Escribir las pruebas del formateo y del parseo con el reloj puesto**

En `src/lib/fecha.test.ts`, reemplazar el `describe('formatearFechaHoja')` completo por:

```ts
describe('formatearFechaHoja', () => {
  it('usa la hora de la mesa, no la del servidor', () => {
    // El servidor está en UTC: este instante son las 16:07 en la hoja.
    expect(formatearFechaHoja(new Date('2026-08-11T22:07:11Z'))).toBe('11/8/2026 16:07:11')
  })

  it('conserva el formato con el que la hoja guarda las fechas', () => {
    // Día y mes sin cero inicial, hora sin cero inicial, minutos y segundos con dos.
    expect(formatearFechaHoja(new Date('2026-08-11T15:05:03Z'))).toBe('11/8/2026 9:05:03')
  })

  it('no escribe el día siguiente cuando en UTC ya cambió la fecha', () => {
    expect(formatearFechaHoja(new Date('2026-08-12T02:30:00Z'))).toBe('11/8/2026 20:30:00')
  })
})
```

Y en el `describe('fechaCorta')` del mismo archivo, reemplazar las dos primeras pruebas por versiones con instantes explícitos:

```ts
  it('muestra solo el día, sin la hora', () => {
    expect(fechaCorta('2026-08-11T15:30:00.000Z', '11/8/2026 9:30:00')).toBe('11 ago 2026')
  })

  it('escribe el mes con tres letras en español y respeta el día de la mesa', () => {
    expect(fechaCorta('2026-01-06T18:00:00.000Z', '')).toBe('6 ene 2026')
    // 04:00 UTC del 1 de enero son las 22:00 del 31 de diciembre en la mesa.
    expect(fechaCorta('2027-01-01T04:00:00.000Z', '')).toBe('31 dic 2026')
  })
```

En `src/lib/casos/caso.test.ts`, agregar dentro del `describe` de `parsearFechaHoja`:

```ts
  it('interpreta el texto de la hoja como hora de la mesa, no del servidor', () => {
    // La hoja dice 9:30 del 11 de agosto; ese instante es 15:30 UTC.
    expect(parsearFechaHoja('11/8/2026 9:30:00')?.toISOString()).toBe('2026-08-11T15:30:00.000Z')
  })
```

- [ ] **Step 8: Correr esas pruebas y verificar que fallan**

Run: `pnpm vitest run src/lib/fecha.test.ts src/lib/casos/caso.test.ts`
Expected: FAIL. `formatearFechaHoja` devolverá `11/8/2026 22:07:11` en lugar de `16:07:11`, y `parsearFechaHoja` devolverá `2026-08-11T09:30:00.000Z`.

- [ ] **Step 9: Aplicar el reloj en las tres funciones**

En `src/lib/fecha.ts`, agregar el import y reescribir las dos funciones:

```ts
import { partesDeLaMesa } from './reloj'

/**
 * Formato con el que la hoja "Respuestas de formulario 1" guarda las fechas:
 * día y mes sin cero inicial, hora sin cero inicial, minutos y segundos con dos
 * dígitos. La hora es la de la mesa, no la del servidor, que en Vercel es UTC.
 */
export function formatearFechaHoja(instante: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  const { dia, mes, anio, horas, minutos, segundos } = partesDeLaMesa(instante)
  return `${dia}/${mes}/${anio} ${horas}:${dos(minutos)}:${dos(segundos)}`
}
```

Y dentro de `fechaCorta`, sustituir el cuerpo del `if (!Number.isNaN(...))` por:

```ts
      const { dia, mes, anio } = partesDeLaMesa(d)
      return `${dia} ${MESES[mes - 1]} ${anio}`
```

En `src/lib/casos/caso.ts`, importar `instanteDeLaMesa` desde `@/lib/reloj` y sustituir la construcción de la fecha en `parsearFechaHoja`:

```ts
  const fecha = instanteDeLaMesa({
    anio: Number(a),
    mes: Number(mes),
    dia: Number(d),
    horas: Number(h),
    minutos: Number(min),
    segundos: Number(s),
  })
```

En `src/lib/casos/semaforo.ts`, importar `diaDeLaMesa` desde `@/lib/reloj` y reescribir el cuerpo de `diasDeEspera` a partir del `if (!recibido)`:

```ts
  return Math.max(0, Math.round((diaDeLaMesa(hoy) - diaDeLaMesa(recibido)) / MS_POR_DIA))
```

Quedan sin usar las dos construcciones de medianoche local que había; borrarlas.

- [ ] **Step 10: Correr la suite completa**

Run: `pnpm test`
Expected: PASS. Si alguna prueba de `semaforo.test.ts`, `cola.test.ts`, `cierre.test.ts`, `observaciones.test.ts` o `sheet-reader.test.ts` falla, es porque construye su fecha con `new Date(2026, 7, 11, 9, 30)` y compara contra un texto: reemplazar ese constructor por un instante ISO explícito que corresponda a la hora de la mesa que la prueba quiere expresar —`new Date('2026-08-11T15:30:00Z')` para las 9:30—, sin cambiar lo que la prueba afirma.

- [ ] **Step 11: Typecheck**

Run: `pnpm typecheck`
Expected: sin errores.

- [ ] **Step 12: Commit**

```bash
git add src/lib/reloj.ts src/lib/reloj.test.ts src/lib/fecha.ts src/lib/fecha.test.ts src/lib/casos/caso.ts src/lib/casos/caso.test.ts src/lib/casos/semaforo.ts src/lib/casos/semaforo.test.ts package.json
git commit -m "fix: la hoja vive en UTC-6 y el servidor en UTC"
```

Si el Step 10 obligó a tocar más archivos de prueba, incluirlos en el `git add`.

---

### Task 2: Sellar `KB` y `KD` como fecha de verdad, sin perder el guardado si el sello falla

**Contexto del defecto.** La app escribe con `valueInputOption=RAW`, que guarda el texto tal cual. El histórico de `KB` y `KD` en la hoja productiva son números de serie con formato de fecha (`dd/mm/yyyy h:mm` y `dd/mm/yyyy`), y la fórmula de `KC` es `=KB−A`. Una cadena ahí no se ordena, no se filtra por fecha y rompería esa resta el día que alguien arrastre la fórmula, que hoy solo llega a la fila 6383.

**Decisión tomada con el área el 13/8/2026:** `USER_ENTERED` **solo** para los dos campos de fecha. El resto sigue con RAW a propósito, y no por comodidad: `USER_ENTERED` convertiría en fórmula unas Observaciones que empiecen con `=`, y volvería el folio interno `0426014703` en el número `426014703`, perdiendo el cero inicial.

**El costo de esa decisión, que esta tarea paga.** `values:batchUpdate` acepta un solo `valueInputOption` por petición, así que dos tipos de dato son dos llamadas, y eso rompe la invariante que hoy declara `escribirCeldas`: *"Una sola petición por lote: la fila nunca queda escrita a medias (RNF-06)"*. Se mitiga con el orden y con la honestidad del error: primero va el texto —lo que la mesa capturó y espera ver guardado— y después el sello, que la app deriva y puede reconstruir. Si falla la segunda llamada, el guardado **sí** ocurrió: la bitácora y los eventos tienen que registrarlo y la interfaz tiene que decir exactamente qué quedó pendiente, en lugar de reportar un fracaso total y perder el rastro de lo que sí se escribió.

**Files:**
- Modify: `src/lib/google/sheet-writer.ts` (`escribirCeldas`, `escribirSeguimiento`, nueva clase de error)
- Modify: `src/lib/google/sheet-writer.test.ts`
- Modify: `src/app/caso/[fila]/acciones.ts:13-15` (tipo `ResultadoGuardado`) y el `catch` de `guardarSeguimiento`
- Modify: `src/app/caso/[fila]/seguimiento-form.tsx:181-190` (aviso en el bloque de resultado)

**Interfaces:**
- Consumes: `formatearFechaHoja` ya corregida en la Task 1. El valor que llega al escritor es el texto `D/M/YYYY H:MM:SS` en hora de la mesa.
- Produces: `SelloNoEscritoError` exportada desde `src/lib/google/sheet-writer.ts`, con la propiedad `campos: string[]`. `ResultadoGuardado` gana la variante `{ ok: true; cambios: number; aviso?: string }`.

- [ ] **Step 1: Escribir las pruebas del escritor**

En `src/lib/google/sheet-writer.test.ts`, dentro del `describe('forma de la escritura')`, agregar:

```ts
  it('escribe las fechas con USER_ENTERED para que la hoja las guarde como fecha', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      { fechaRespuestaCorreo: '11/8/2026 16:07:11' },
      TESTIGO,
    )
    const hechas = escrituras(llamadas)
    expect(hechas).toHaveLength(1)
    expect(hechas[0].url).toContain('valueInputOption=USER_ENTERED')
  })

  it('separa el texto de las fechas en dos peticiones, y el texto va primero', async () => {
    const { fetchMock, llamadas } = fetchDeEscritura()
    await escribirSeguimiento(
      { ...DEPS_BASE, fetch: fetchMock },
      MAPA,
      7176,
      {
        estatusFinal: 'Concluida',
        observaciones: 'nota',
        fechaAtencionFinal: '11/8/2026 16:07:11',
      },
      TESTIGO,
    )
    const hechas = escrituras(llamadas)
    expect(hechas).toHaveLength(2)
    expect(hechas[0].url).toContain('valueInputOption=RAW')
    expect(hechas[1].url).toContain('valueInputOption=USER_ENTERED')

    const primera = JSON.parse(hechas[0].init!.body as string) as { data: { range: string }[] }
    const segunda = JSON.parse(hechas[1].init!.body as string) as { data: { range: string }[] }
    expect(primera.data).toHaveLength(2)
    expect(segunda.data).toHaveLength(1)
    expect(segunda.data[0].range).toContain('KD') // fecha de atención final
  })

  it('si falla el sello, avisa cuál quedó pendiente y no niega lo ya guardado', async () => {
    // El texto se escribe en la primera llamada; la segunda, la del sello, falla.
    const { fetchMock, llamadas } = fetchDeEscritura()
    let escrituraNumero = 0
    const fetchQueFallaElSello: typeof globalThis.fetch = async (url, init) => {
      const esEscritura = String(url).includes('values:batchUpdate')
      if (esEscritura && ++escrituraNumero === 2) {
        return new Response('{}', { status: 500 })
      }
      return fetchMock(url, init)
    }

    await expect(
      escribirSeguimiento(
        { ...DEPS_BASE, fetch: fetchQueFallaElSello },
        MAPA,
        7176,
        { estatusFinal: 'Concluida', fechaAtencionFinal: '11/8/2026 16:07:11' },
        TESTIGO,
      ),
    ).rejects.toThrow(SelloNoEscritoError)

    expect(escrituras(llamadas)).toHaveLength(1) // el estatus sí quedó escrito
  })
```

Agregar `SelloNoEscritoError` al import de `./sheet-writer` que ya existe en la cabecera del archivo.

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Run: `pnpm vitest run src/lib/google/sheet-writer.test.ts`
Expected: FAIL — `SelloNoEscritoError` no existe y las escrituras salen todas con `valueInputOption=RAW` en una sola petición.

- [ ] **Step 3: Separar los grupos en el escritor**

En `src/lib/google/sheet-writer.ts`, después de la declaración de `CAMPOS_ESCRIBIBLES`, agregar:

```ts
/**
 * Los dos campos que van a columnas con formato de fecha (`KB` y `KD`). Se
 * escriben aparte, con `USER_ENTERED`, para que Sheets los guarde como fecha de
 * verdad: el histórico de esas columnas son números de serie y la fórmula de
 * `KC` es `=KB−A`, que con una cadena daría `#VALUE!`.
 *
 * El resto sigue con RAW a propósito. `USER_ENTERED` convertiría en fórmula unas
 * Observaciones que empiecen con `=`, y dejaría el folio interno `0426014703`
 * como el número `426014703`.
 */
const CAMPOS_DE_FECHA = [
  'fechaRespuestaCorreo',
  'fechaAtencionFinal',
] as const satisfies readonly CampoEscribible[]

function esCampoDeFecha(campo: CampoEscribible): boolean {
  return (CAMPOS_DE_FECHA as readonly string[]).includes(campo)
}
```

Y junto a las otras clases de error:

```ts
/**
 * El guardado ocurrió y el sello de fecha no. Es una falla parcial y el mensaje
 * lo dice con esas palabras, porque negar el guardado haría que la mesa volviera
 * a capturar lo que ya está en la hoja.
 */
export class SelloNoEscritoError extends Error {
  constructor(
    readonly campos: string[],
    opciones?: { cause?: unknown },
  ) {
    super(
      `Se guardaron los cambios en la hoja, pero no se pudo sellar la fecha. Vuelve a guardar para completarla.`,
      opciones,
    )
    this.name = 'SelloNoEscritoError'
  }
}
```

- [ ] **Step 4: Parametrizar `escribirCeldas` y repartir en `escribirSeguimiento`**

Cambiar la firma y el cuerpo de `escribirCeldas`:

```ts
/**
 * Una petición por tipo de dato. El texto y las fechas no pueden ir juntos
 * porque `values:batchUpdate` acepta un solo `valueInputOption` por llamada.
 */
async function escribirCeldas(
  deps: DepsLectura,
  fila: number,
  celdas: { columna: number; valor: string }[],
  modo: 'RAW' | 'USER_ENTERED' = 'RAW',
): Promise<void> {
  if (celdas.length === 0) return
  await pedir(deps, `${BASE}/${deps.sheetId}/values:batchUpdate?valueInputOption=${modo}`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: modo,
      data: celdas.map(({ columna, valor }) => ({
        range: `${deps.pestana}!${letraColumna(columna)}${fila}`,
        majorDimension: 'ROWS',
        values: [[valor]],
      })),
    }),
  })
}
```

Y reemplazar el final de `escribirSeguimiento`, desde `await confirmarFila(...)`:

```ts
  await confirmarFila(deps, mapa, fila, testigo)

  const celdas = entradas.map(([campo, valor]) => ({
    campo,
    columna: columnaDe(mapa, campo),
    valor,
  }))
  const fechas = celdas.filter((c) => esCampoDeFecha(c.campo))
  const texto = celdas.filter((c) => !esCampoDeFecha(c.campo))

  // El texto primero: es lo que la mesa capturó. El sello lo deriva la app y se
  // puede reconstruir volviendo a guardar, así que es el que puede quedar
  // pendiente sin que se pierda trabajo de nadie.
  await escribirCeldas(deps, fila, texto)
  if (fechas.length === 0) return
  try {
    await escribirCeldas(deps, fila, fechas, 'USER_ENTERED')
  } catch (causa) {
    throw new SelloNoEscritoError(
      fechas.map((f) => f.campo),
      { cause: causa },
    )
  }
}
```

- [ ] **Step 5: Correr las pruebas del escritor**

Run: `pnpm vitest run src/lib/google/sheet-writer.test.ts`
Expected: PASS, incluidas las tres nuevas y la que ya existía sobre RAW y la de una sola petición, que sigue valiendo porque sus campos son todos de texto.

- [ ] **Step 6: Tratar el sello pendiente como guardado con aviso**

`guardarSeguimiento` es una Server Action con dependencias de sesión y de base, y el repo no la prueba de extremo a extremo: aquí la red de seguridad son los tipos y la comprobación en vivo del Step 9.

En `src/app/caso/[fila]/acciones.ts`, agregar `SelloNoEscritoError` al import desde `@/lib/google/sheet-writer` y cambiar el tipo:

```ts
export type ResultadoGuardado =
  | { ok: true; cambios: number; aviso?: string }
  | { ok: false; error: string; conflicto: boolean }
```

Y en `guardarSeguimiento`, reemplazar el bloque `try/catch` de la escritura por:

```ts
  let aviso: string | undefined
  try {
    await escribirSeguimiento(
      await depsDeGoogle(),
      mapa,
      fila,
      Object.fromEntries(cambios.map((c) => [c.campo, c.nuevo])),
      { marcaTemporalTexto: caso.marcaTemporalTexto, folio: caso.folio },
    )
  } catch (e) {
    // El sello es una falla parcial: los cambios sí están en la hoja, así que el
    // guardado continúa —bitácora, eventos y caché— y el aviso viaja con él.
    if (e instanceof SelloNoEscritoError) {
      aviso = e.message
    } else {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Error desconocido al guardar.',
        conflicto: e instanceof FilaCambiadaError,
      }
    }
  }
```

Y el `return` final de la función:

```ts
  return { ok: true, cambios: cambios.length, aviso }
```

- [ ] **Step 7: Mostrar el aviso en el formulario**

En `src/app/caso/[fila]/seguimiento-form.tsx`, después del bloque que dice "Guardado en la hoja", agregar:

```tsx
      {resultado?.ok && resultado.aviso && (
        <p className="text-base text-amber-700 dark:text-amber-400">{resultado.aviso}</p>
      )}
```

- [ ] **Step 8: Suite completa y typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: ambas sin errores.

- [ ] **Step 9: Comprobar el sellado contra la copia de desarrollo**

Con `pnpm dev` y `.env.local` apuntando a la **copia**, abrir el caso de la fila 7181 (folio 9001), ponerle un Estatus Final de `Concluida` y guardar. Después, leer la celda `KD7181` de la copia y confirmar que quedó como **número con formato de fecha** y no como texto, y que la hora corresponde a la de la Ciudad de México. Es la única comprobación que prueba que `USER_ENTERED` interpreta el formato `D/M/YYYY H:MM:SS` bajo el `locale es_MX` de la hoja; ninguna prueba automatizada puede afirmarlo, porque no llaman a Google.

Si quedó como texto, el formato que la app manda no es el que la hoja espera: revisar antes de continuar, porque es justo el defecto que esta tarea corrige.

- [ ] **Step 10: Commit**

```bash
git add src/lib/google/sheet-writer.ts src/lib/google/sheet-writer.test.ts "src/app/caso/[fila]/acciones.ts" "src/app/caso/[fila]/seguimiento-form.tsx"
git commit -m "fix: KB y KD se sellan como fecha, no como texto"
```

---

### Task 3: Apuntar a la hoja productiva

Sin código. Es el cambio de una variable de entorno y su verificación, y **requiere la autorización explícita del área**, que el diseño ya listaba como dependencia del solicitante para esta etapa.

**Files:**
- Modify: nada en el repositorio. La variable vive en el proyecto de Vercel `frontend-mesa-control` del equipo `omarlara-1860s-projects`.

**Interfaces:**
- Consumes: las Tasks 1 y 2 desplegadas. **No ejecutar esta tarea antes**: apuntar a la hoja real con el defecto de fechas vigente escribiría datos incorrectos en el registro del cliente.

- [ ] **Step 1: Confirmar la autorización del área**

Tener por escrito que Norma o Keynor autorizan que la herramienta empiece a escribir en la hoja productiva. Sin eso, esta tarea no empieza.

- [ ] **Step 2: Verificar que las correcciones están en producción**

```bash
git log --oneline -3
vercel ls frontend-mesa-control --prod
```

Expected: los dos commits de las Tasks 1 y 2 en `main`, y el despliegue de producción en estado Ready posterior a ellos. Si no, desplegar con `vercel deploy --prod --yes` antes de seguir.

- [ ] **Step 3: Ver el valor actual de la variable**

```bash
vercel env ls
```

Expected: `SHEET_ID` presente en Production, apuntando todavía a `1rimFXIxaM4HrBHC9YQfwYfkh0l-RBJdbe7SLM0CGxEQ`.

- [ ] **Step 4: Cambiar `SHEET_ID` en producción**

```bash
vercel env rm SHEET_ID production --yes
printf '1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0' | vercel env add SHEET_ID production
```

`.env.local` **no se toca**: el desarrollo local sigue escribiendo en la copia.

- [ ] **Step 5: Desplegar para que tome la variable**

```bash
vercel deploy --prod --yes
```

Una variable nueva solo entra con un despliegue, y de paso el cambio de build invalida la caché de casos, así que la cola no puede quedar mostrando datos de la copia.

- [ ] **Step 6: Verificar en la aplicación, sin escribir nada**

En `https://frontend-mesa-control.vercel.app`:

1. **Ajustes** debe decir `Hoja alcanzada correctamente: Formulario sin título (Respuestas)`. Ese es el título de la hoja productiva; la copia se llama `Prueba formulario mesa de control`, así que la pantalla distingue una de otra sin ambigüedad.
2. La **cola** debe traer **6 casos** en la vista por omisión y **2** en Rezago, y el filtro de Estatus final debe ofrecer Tramite con **206** casos. Son los números medidos el 13/8/2026; si no coinciden, es porque entraron peticiones nuevas, lo cual es esperable —hay que confirmar que la diferencia se explica por eso y no por un filtro mal aplicado.
3. Abrir uno de los casos de la cola y comprobar que se ven sus campos, sus adjuntos de Drive y, si tiene, su conversación.
4. **No** capturar folios ni guardar seguimientos todavía: la primera escritura sobre la hoja real ocurre en la Task 4, con el área presente.

- [ ] **Step 7: Anotar el cambio en `docs/AVANCE.md`**

En la tabla de Infraestructura, marcar que la hoja productiva ya es la que usa producción y que la copia queda solo para desarrollo local. Commit:

```bash
git add docs/AVANCE.md
git commit -m "docs: producción apunta a la hoja productiva"
```

---

### Task 4: Jornada real y cierre documental

**Files:**
- Modify: `docs/AVANCE.md`
- Create: `/Users/omarsaldanna/Documents/enginecx_prd/Gplus-Seguros/PJ2859-frontend-mesa-control/PLAN.md`
- Create: `/Users/omarsaldanna/Documents/enginecx_prd/Gplus-Seguros/PJ2859-frontend-mesa-control/AVANCE.md`

**Interfaces:**
- Consumes: la Task 3 terminada y verificada.

- [ ] **Step 1: Resolver las cuentas de los cuatro operadores**

Antes de la jornada: confirmar los correos reales de Keynor, Paty, Norma y José Juan. La lista de editores de `JY` en la hoja productiva incluye `patricia.ramirez@garantiplus.mx`, `israel.escutia@garantiplus.mx` y `mario.luna@garantiplus.mx`, además de `jose.mendoza@gplusseguros.mx`, que no coincide con el `juan.palafox@gplusseguros.mx` que sembramos. Una cuenta de `garantiplus.mx` **no puede entrar**: el consentimiento es Interno al dominio `gplusseguros.mx`. Si algún correo cambia, corregir la allowlist con `pnpm db:seed` y volver a probar el acceso.

- [ ] **Step 2: Pedir a Keynor los textos de las 14 plantillas**

Siguen siendo borradores con un `[Escribe aquí…]`. Se corrigen desde Ajustes, en la aplicación, y el texto real lo conoce la mesa. Sin esto, la conversación por correo sale con un marcador de posición al solicitante.

- [ ] **Step 3: Anticipar al área los tres puntos de operación**

Con los números ya medidos: que la cola por omisión mostrará **6 casos** y que los **206 de Tramite** se ven marcando su casilla en el filtro; que la lista de aseguradoras de `KG` cambia a partir de la fila 7222 y pierde `TODAS LAS ASEGURADORAS`, `GPLUS ` y `LA LATINO`, así que conviene que decidan cuál lista es la correcta y extiendan la validación; y que **"Ernesto"** tiene 475 de los 1,466 casos de 2026 sin estar en el catálogo de `KE`.

- [ ] **Step 4: Acompañar la jornada real de Keynor y Paty**

Es la verificación de cierre que pide el diseño. Durante la jornada quedan ejercidas, sobre casos reales y con la mesa presente, las cinco cosas que nunca se han probado en vivo:

1. **Captura de folio faltante** en las filas 7218–7220, que llegaron sin folio. Escribe `JY`, y `mesadecontrol@` sí es editor de esa protección.
2. **Sellado de `KD`** al cerrar un caso: que la fecha se llene sola, con la hora de la Ciudad de México, como número con formato de fecha, y que el caso salga de la cola.
3. **Botón "Atender yo este caso"** con una cuenta de operador. Con `mesadecontrol@` no funciona a propósito, porque ese usuario no tiene nombre en `KE`.
4. **Reenvío de la conversación con adjuntos**, y que la respuesta del tercero no aparezca en el chat del caso.
5. **Adjuntos de Drive** de un caso real, que se abran desde la aplicación.

Anotar en `docs/AVANCE.md` el resultado de cada una.

- [ ] **Step 5: Escribir `PLAN.md` para el repo de PRDs**

Crear `/Users/omarsaldanna/Documents/enginecx_prd/Gplus-Seguros/PJ2859-frontend-mesa-control/PLAN.md` con el índice de las cinco etapas, su estado final, y para cada una el enlace a su plan dentro del repositorio de código. Es el documento que permite retomar el proyecto sin este historial.

- [ ] **Step 6: Copiar `AVANCE.md` al repo de PRDs**

```bash
cp docs/AVANCE.md /Users/omarsaldanna/Documents/enginecx_prd/Gplus-Seguros/PJ2859-frontend-mesa-control/AVANCE.md
```

- [ ] **Step 7: Commit en los dos repositorios**

```bash
git add docs/AVANCE.md
git commit -m "docs: resultado de la jornada real y cierre de la etapa 4"
```

```bash
cd /Users/omarsaldanna/Documents/enginecx_prd
git add Gplus-Seguros/PJ2859-frontend-mesa-control/PLAN.md Gplus-Seguros/PJ2859-frontend-mesa-control/AVANCE.md
git commit -m "docs(PJ2859): plan y avance del frontend de mesa de control"
```

---

## Lo que queda abierto al terminar

No son tareas de este plan; son decisiones del área que conviene dejar anotadas:

- **RF-13, importación bajo demanda**, excluida de esta etapa. El PRD además deja dos preguntas sin responder que hay que resolver antes de diseñarla: quién solicita y quién autoriza una importación, y si el folio de petición se repite entre años, porque de ser así la búsqueda por folio deja de identificar un caso.
- **La ventana de 30 días** del rezago la definió el desarrollo; falta validarla con quien conoce el SLA.
- **Las fórmulas de `KL`–`KU`** solo llegan a la fila 3126 y `KO`/`KS` traen `#REF!`. Si el reporte semanal las usa, no tiene datos de los últimos dos años. Es la hoja, no la herramienta.
- **`KB` y `KD` abandonadas desde el 20 de marzo de 2026**: unos 837 casos de 2026 sin fecha de respuesta ni de cierre. A partir de ahora la app las llena, pero no hay con qué comparar hacia atrás.
- **Respuestas fuera del hilo**: si una agencia contesta con otro asunto, ese mensaje no llega al caso. Riesgo reconocido en el PRD; se decide cuando se vea su frecuencia real.
