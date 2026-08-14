# Notificaciones en vivo — Plan de implementación

> **Para quien lo ejecute:** las tareas van en orden y cada una termina en un commit con la suite verde. Los pasos usan casillas (`- [ ]`) para llevar el avance.

**Meta:** que la mesa vea sin recargar la página cuando llega una petición nueva a la hoja o una respuesta de correo a un caso, con una campanita, un panel lateral y actualización automática de la tabla y del chat.

**Arquitectura:** n8n agenda, la app detecta. Dos flujos de n8n con Schedule Trigger cada minuto llaman dos rutas de la app protegidas por secreto compartido; la app lee la hoja y Gmail con la credencial que ya tiene, genera los folios faltantes, y escribe en la tabla `notificaciones` de Supabase. El navegador sondea cada 30 segundos una ruta propia y reacciona: refresca la tabla, refresca el chat, pinta insignias.

**Pila:** Next.js 16.3 (App Router, Route Handlers, Server Actions), React 19, Drizzle + Supabase Postgres, Google Sheets API v4, Gmail API v1, Vitest, n8n (API REST).

## Restricciones globales

- **Todo se prueba contra la hoja de prueba** `1rimFXIxaM4HrBHC9YQfwYfkh0l-RBJdbe7SLM0CGxEQ`. Ninguna tarea escribe en la hoja productiva `1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0` hasta que el área lo autorice, y ese paso vive en la traza de la Tarea 11, no en el código.
- **La misma base de datos sirve a desarrollo y a producción** (`POSTGRES_URL` tiene un solo valor en los tres entornos). Toda fila de `notificaciones` lleva `sheet_id` y **toda** consulta filtra por él. Sin eso, una notificación de la copia aparece en un caso de producción con el mismo número de fila (restricción 20 de `AVANCE.md`).
- **La idempotencia es obligatoria.** Los flujos corren cada minuto y n8n reintenta: cada notificación lleva una `clave` única y se inserta con `onConflictDoNothing`. Correr un endpoint dos veces con los mismos datos no debe producir dos avisos.
- **La escritura a la hoja sigue la lista blanca existente.** La generación de folios reusa `escribirFolios`, que revalida la fila y aborta el lote completo si algo cambió. No se agrega ninguna columna escribible.
- **El idioma del código es español**, como el resto del repositorio: nombres, comentarios y mensajes al usuario.
- **Sin `any`.** `pnpm typecheck` y `pnpm lint` tienen que quedar limpios en cada tarea.
- Azul de las notificaciones: los tokens de shadcn ya existentes. Usar `bg-blue-600 text-white` para el punto y las insignias, y `text-blue-600 dark:text-blue-400` para el texto, igual que el ámbar de `GenerarFolios` usa la escala directa.

## Estructura de archivos

| Archivo | Responsabilidad |
| --- | --- |
| `src/db/schema.ts` | + `notificaciones` y `notificacionesLeidas` |
| `src/lib/notificaciones/claves.ts` | Claves de idempotencia (puro) |
| `src/lib/notificaciones/deteccion.ts` | Qué casos son nuevos frente a la marca de agua (puro) |
| `src/lib/notificaciones/secreto.ts` | Validación del secreto compartido (puro) |
| `src/lib/notificaciones/almacen.ts` | Lectura y escritura en las dos tablas |
| `src/lib/notificaciones/tipos.ts` | Tipos que cruzan servidor y navegador |
| `src/lib/google/gmail-buzon.ts` | Listar mensajes recientes del buzón y sus metadatos |
| `src/app/api/notificaciones/casos-nuevos/route.ts` | Endpoint que llama n8n (casos) |
| `src/app/api/notificaciones/correos/route.ts` | Endpoint que llama n8n (correos) |
| `src/app/api/notificaciones/route.ts` | Lo que sondea el navegador |
| `src/app/api/notificaciones/leidas/route.ts` | Marcar leídas |
| `src/components/notificaciones/proveedor.tsx` | Un solo sondeo por página, en contexto |
| `src/components/notificaciones/campanita.tsx` | Campanita + punto azul |
| `src/components/notificaciones/panel.tsx` | Barra lateral sobrepuesta |
| `src/components/notificaciones/insignia-correo.tsx` | Insignia por renglón de la tabla |
| `src/app/fila/acciones.ts` | `actualizar()` extraída de la página, reusable |
| `src/app/fila/auto-actualizar.tsx` | Refresco automático de la tabla |
| `src/app/caso/[fila]/aviso-mensajes.tsx` | "N mensajes nuevos" + refresco del chat |
| `docs/PASO-A-PRODUCCION-NOTIFICACIONES.md` | Traza de salida a producción (Tarea 11) |

---

### Tarea 1: Tablas de notificaciones y claves de idempotencia

**Archivos:**
- Modificar: `src/db/schema.ts`
- Crear: `src/lib/notificaciones/claves.ts`, `src/lib/notificaciones/claves.test.ts`
- Modificar: `src/app/api/archivo/subir/route.ts` (comentario desactualizado)

**Interfaces:**
- Produce: `schema.notificaciones`, `schema.notificacionesLeidas`, `claveDeCasoNuevo(sheetId, fila)`, `claveDeCorreo(sheetId, messageId)`.

- [ ] **Paso 1: la prueba de las claves**

```ts
// src/lib/notificaciones/claves.test.ts
import { describe, expect, it } from 'vitest'
import { claveDeCasoNuevo, claveDeCorreo } from './claves'

const COPIA = '1rimFXIxaM4HrBHC9YQfwYfkh0l-RBJdbe7SLM0CGxEQ'
const REAL = '1OfK8ve8twu5WCx-Yy3iJoiKJhs34klChq7dIqx4dfr0'

describe('claves de idempotencia', () => {
  it('la misma fila de la misma hoja produce la misma clave', () => {
    expect(claveDeCasoNuevo(COPIA, 7231)).toBe(claveDeCasoNuevo(COPIA, 7231))
  })

  it('la misma fila en hojas distintas son avisos distintos', () => {
    // La base es la misma para la copia y la hoja real: sin la hoja en la clave,
    // el aviso de desarrollo bloquearía el de producción.
    expect(claveDeCasoNuevo(COPIA, 7231)).not.toBe(claveDeCasoNuevo(REAL, 7231))
  })

  it('el mismo mensaje de Gmail en hojas distintas son avisos distintos', () => {
    expect(claveDeCorreo(COPIA, '18f2a')).not.toBe(claveDeCorreo(REAL, '18f2a'))
  })

  it('un caso nuevo y un correo nunca colisionan', () => {
    expect(claveDeCasoNuevo(COPIA, 7231)).not.toBe(claveDeCorreo(COPIA, '7231'))
  })
})
```

- [ ] **Paso 2: correrla y verla fallar**

`pnpm vitest run src/lib/notificaciones/claves.test.ts` → falla por módulo inexistente.

- [ ] **Paso 3: implementar las claves**

```ts
// src/lib/notificaciones/claves.ts
/**
 * Clave con la que se descarta un aviso repetido.
 *
 * Los flujos de n8n corren cada minuto y reintentan, así que el mismo caso y el
 * mismo mensaje se van a evaluar muchas veces. La clave es única en la tabla y la
 * inserción es `onConflictDoNothing`: el segundo intento no produce nada.
 *
 * Lleva la hoja porque una sola base de datos sirve a la copia y a la hoja real,
 * y la fila 7231 de cada una es un caso distinto.
 */
export function claveDeCasoNuevo(sheetId: string, fila: number): string {
  return `caso_nuevo:${sheetId}:${fila}`
}

export function claveDeCorreo(sheetId: string, messageId: string): string {
  return `correo:${sheetId}:${messageId}`
}
```

- [ ] **Paso 4: verla pasar**

`pnpm vitest run src/lib/notificaciones/claves.test.ts` → PASS.

- [ ] **Paso 5: las tablas**

En `src/db/schema.ts`, agregar `index` y `primaryKey` a los imports de `drizzle-orm/pg-core` y al final del archivo:

```ts
/**
 * Avisos para la mesa: una petición nueva en la hoja o una respuesta de correo en
 * un caso. Los produce la app cuando n8n la despierta; el navegador los sondea.
 *
 * `clave` es la idempotencia (ver `lib/notificaciones/claves.ts`) y `sheet_id`
 * separa la copia de la hoja real, que comparten esta base.
 */
export const notificaciones = pgTable(
  'notificaciones',
  {
    id: serial('id').primaryKey(),
    sheetId: text('sheet_id').notNull(),
    tipo: text('tipo', { enum: ['caso_nuevo', 'correo_recibido'] }).notNull(),
    fila: integer('fila').notNull(),
    folio: text('folio'),
    titulo: text('titulo').notNull(),
    detalle: text('detalle'),
    clave: text('clave').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('notificaciones_clave_idx').on(t.clave),
    index('notificaciones_hoja_idx').on(t.sheetId, t.id),
  ],
)

/**
 * Lo leído es por usuario, no por equipo: que Keynor lea un aviso no se lo quita
 * a Paty. Se guarda la marca de lectura y no un booleano en `notificaciones`
 * porque cada aviso tiene tantos estados como personas en la mesa.
 */
export const notificacionesLeidas = pgTable(
  'notificaciones_leidas',
  {
    notificacionId: integer('notificacion_id').notNull(),
    correoUsuario: text('correo_usuario').notNull(),
    leidoEn: timestamp('leido_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.notificacionId, t.correoUsuario] })],
)
```

- [ ] **Paso 6: aplicar el esquema a Supabase**

`pnpm db:push`

Debe reportar la creación de las dos tablas. Si se queda colgado en "Pulling schema from database", revisar que `drizzle.config.ts` siga apuntando a `POSTGRES_URL_NON_POOLING` (restricción 17 de `AVANCE.md`).

- [ ] **Paso 7: comprobar en la base que quedaron**

```bash
psql "$POSTGRES_URL_NON_POOLING" -c "\d notificaciones" -c "\d notificaciones_leidas"
```

Verificar el índice único sobre `clave`.

- [ ] **Paso 8: corregir el comentario que quedó falso**

En `src/app/api/archivo/subir/route.ts`, la explicación dice que subir el límite global de las acciones expondría todos los formularios. Eso ya se hizo el 14 de agosto de 2026 al arreglar el envío con adjuntos. Reemplazar esa frase por:

```
 * Es una ruta y no una Server Action porque mueve archivos de varios megas y no
 * depende del tope del cuerpo de las acciones, que la aplicación ya subió a 25 MB
 * para poder adjuntar al correo (ver `lib/correo/limites.ts`). Aquí el límite es
 * el de esta ruta y nada más.
```

- [ ] **Paso 9: commit**

```bash
git add src/db/schema.ts src/lib/notificaciones src/app/api/archivo/subir/route.ts
git commit -m "feat: tablas de notificaciones y claves de idempotencia"
```

---

### Tarea 2: Detección de casos nuevos y validación del secreto

**Archivos:**
- Crear: `src/lib/notificaciones/deteccion.ts`, `src/lib/notificaciones/deteccion.test.ts`
- Crear: `src/lib/notificaciones/secreto.ts`, `src/lib/notificaciones/secreto.test.ts`

**Interfaces:**
- Consume: `Caso` de `@/lib/casos/caso`.
- Produce: `casosNuevos(casos, marcaGuardada)`, `marcaMasAlta(casos)`, `secretoValido(cabecera, esperado)`.

- [ ] **Paso 1: la prueba de detección**

```ts
// src/lib/notificaciones/deteccion.test.ts
import { describe, expect, it } from 'vitest'
import type { Caso } from '@/lib/casos/caso'
import { casosNuevos, marcaMasAlta } from './deteccion'

const caso = (fila: number, iso: string): Caso =>
  ({ fila, folio: null, marcaTemporalIso: iso, marcaTemporalTexto: '', adjuntos: [], camposExtra: [] }) as unknown as Caso

const AYER = '2026-08-13T10:00:00.000Z'
const HOY = '2026-08-14T10:00:00.000Z'

describe('casosNuevos', () => {
  it('sin marca de agua no notifica nada: es el arranque', () => {
    // La primera corrida no puede avisar de los 1,466 casos de 2026.
    expect(casosNuevos([caso(7230, AYER), caso(7231, HOY)], null)).toEqual([])
  })

  it('devuelve los posteriores a la marca', () => {
    const nuevos = casosNuevos([caso(7230, AYER), caso(7231, HOY)], AYER)
    expect(nuevos.map((c) => c.fila)).toEqual([7230, 7231])
  })

  it('incluye los de la marca exacta, porque la clave descarta el repetido', () => {
    // Dos respuestas del formulario en el mismo segundo existen. Comparar con
    // "mayor o igual" nunca pierde una; el índice único evita el aviso doble.
    expect(casosNuevos([caso(7230, AYER)], AYER).map((c) => c.fila)).toEqual([7230])
  })

  it('descarta los anteriores', () => {
    expect(casosNuevos([caso(7229, AYER)], HOY)).toEqual([])
  })

  it('no falla con la lista vacía', () => {
    expect(casosNuevos([], AYER)).toEqual([])
  })
})

describe('marcaMasAlta', () => {
  it('es la marca temporal más reciente de la lectura', () => {
    expect(marcaMasAlta([caso(7230, AYER), caso(7231, HOY)])).toBe(HOY)
  })

  it('sin casos no hay marca', () => {
    expect(marcaMasAlta([])).toBeNull()
  })
})
```

- [ ] **Paso 2: correrla y verla fallar**

- [ ] **Paso 3: implementar la detección**

```ts
// src/lib/notificaciones/deteccion.ts
import type { Caso } from '@/lib/casos/caso'

/**
 * Qué casos de la lectura son nuevos frente a la última marca procesada.
 *
 * Se compara la marca temporal y no el número de fila: el formulario **inserta**
 * la respuesta nueva arriba de las filas que la mesa pre-arrastró para el folio,
 * así que "la fila más alta" no es "lo más reciente". Ese es el mismo mecanismo
 * que produjo los 210 folios duplicados de la hoja.
 *
 * Sin marca guardada no se notifica nada: es el arranque, y avisar de todo el
 * histórico sería inservible. La marca se siembra en silencio en la primera
 * corrida.
 */
export function casosNuevos(casos: Caso[], marcaGuardada: string | null): Caso[] {
  if (!marcaGuardada) return []
  // Mayor o igual, no mayor: dos respuestas del mismo segundo existen y ninguna
  // debe perderse. El repetido lo descarta la clave única de la tabla.
  return casos.filter((c) => c.marcaTemporalIso >= marcaGuardada)
}

export function marcaMasAlta(casos: Caso[]): string | null {
  return casos.reduce<string | null>(
    (alta, c) => (alta === null || c.marcaTemporalIso > alta ? c.marcaTemporalIso : alta),
    null,
  )
}
```

- [ ] **Paso 4: verla pasar**

- [ ] **Paso 5: la prueba del secreto**

```ts
// src/lib/notificaciones/secreto.test.ts
import { describe, expect, it } from 'vitest'
import { secretoValido } from './secreto'

const S = 'un-secreto-largo-de-verdad'

describe('secretoValido', () => {
  it('acepta el valor exacto con el prefijo Bearer', () => {
    expect(secretoValido(`Bearer ${S}`, S)).toBe(true)
  })

  it('acepta el valor sin prefijo, por si el flujo lo manda pelón', () => {
    expect(secretoValido(S, S)).toBe(true)
  })

  it('rechaza otro valor', () => {
    expect(secretoValido('Bearer otra-cosa', S)).toBe(false)
  })

  it('rechaza la cabecera ausente', () => {
    expect(secretoValido(null, S)).toBe(false)
  })

  it('rechaza todo si el servidor no tiene secreto configurado', () => {
    // Sin variable de entorno la ruta queda cerrada, no abierta.
    expect(secretoValido(`Bearer ${S}`, undefined)).toBe(false)
    expect(secretoValido(`Bearer ${S}`, '')).toBe(false)
  })

  it('rechaza un valor de otra longitud sin comparar byte por byte', () => {
    expect(secretoValido('Bearer corto', S)).toBe(false)
  })
})
```

- [ ] **Paso 6: correrla y verla fallar**

- [ ] **Paso 7: implementar el secreto**

```ts
// src/lib/notificaciones/secreto.ts
import { timingSafeEqual } from 'node:crypto'

/**
 * Las rutas que llama n8n no tienen sesión de usuario: se autentican con un
 * secreto compartido en la cabecera `Authorization`.
 *
 * La comparación es de tiempo constante para no filtrar el secreto por la
 * duración de la respuesta, y sin secreto configurado la ruta queda **cerrada**:
 * un despliegue al que le falte la variable no debe quedar abierto al mundo.
 */
export function secretoValido(cabecera: string | null, esperado: string | undefined): boolean {
  if (!esperado) return false
  const recibido = (cabecera ?? '').replace(/^Bearer\s+/i, '').trim()
  const a = Buffer.from(recibido, 'utf8')
  const b = Buffer.from(esperado, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
```

- [ ] **Paso 8: verla pasar y commit**

```bash
pnpm vitest run src/lib/notificaciones
git add src/lib/notificaciones
git commit -m "feat: detección de casos nuevos por marca temporal y secreto de las rutas"
```

---

### Tarea 3: Almacén de notificaciones

**Archivos:**
- Crear: `src/lib/notificaciones/tipos.ts`
- Crear: `src/lib/notificaciones/almacen.ts`
- Crear: `src/lib/notificaciones/almacen.test.ts`

**Interfaces:**
- Consume: `getDb`, `schema`, `claveDeCasoNuevo`, `claveDeCorreo`.
- Produce: `hojaActual()`, `guardarNotificaciones(nuevas)`, `noLeidasDe(correo)`, `marcarLeidas(correo, ids)`, `marcarLeidasDeFila(correo, fila)`, `leerMarca()`, `guardarMarca(iso)`, `clavesExistentes(claves)`.

- [ ] **Paso 1: los tipos**

```ts
// src/lib/notificaciones/tipos.ts
export type TipoNotificacion = 'caso_nuevo' | 'correo_recibido'

export type Notificacion = {
  id: number
  tipo: TipoNotificacion
  fila: number
  folio: string | null
  titulo: string
  detalle: string | null
  creadoEnIso: string
}

/** Lo que devuelve el sondeo del navegador. */
export type Sondeo = {
  /** El id más alto que existe para esta hoja, leído o no. Detecta lo que llegó. */
  maxId: number
  noLeidas: Notificacion[]
  /** Mensajes de correo sin leer por fila, para las insignias de la tabla. */
  correosPorFila: Record<number, number>
}

export type NotificacionNueva = {
  tipo: TipoNotificacion
  fila: number
  folio: string | null
  titulo: string
  detalle: string | null
  clave: string
}
```

- [ ] **Paso 2: la prueba del almacén**

La suite corre sin base de datos, así que aquí se prueba lo que es puro y se deja la parte de SQL a la verificación manual del Paso 5. Lo que **sí** hay que blindar con prueba es que ninguna consulta se olvide de la hoja:

```ts
// src/lib/notificaciones/almacen.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FUENTE = readFileSync(join(import.meta.dirname, 'almacen.ts'), 'utf8')

describe('almacén de notificaciones', () => {
  it('todas las consultas filtran por hoja', () => {
    // Una sola base sirve a la copia y a la hoja real. Cada `.from(...notificaciones)`
    // tiene que ir acompañado de su filtro de hoja: sin eso, un aviso de
    // desarrollo aparece en un caso de producción con el mismo número de fila.
    const lecturas = FUENTE.match(/\.from\(schema\.notificaciones\)/g) ?? []
    const filtros = FUENTE.match(/eq\(schema\.notificaciones\.sheetId, hoja(Actual\(\))?\)/g) ?? []
    expect(lecturas.length).toBeGreaterThan(0)
    expect(filtros.length).toBeGreaterThanOrEqual(lecturas.length)
  })

  it('inserta descartando los repetidos por clave', () => {
    expect(FUENTE).toContain('onConflictDoNothing')
  })

  it('marca lo leído por usuario, nunca para todos', () => {
    expect(FUENTE).toContain('correoUsuario')
    expect(FUENTE).not.toMatch(/update\(schema\.notificaciones\)/)
  })
})
```

- [ ] **Paso 3: correrla y verla fallar**

- [ ] **Paso 4: implementar el almacén**

```ts
// src/lib/notificaciones/almacen.ts
import { and, desc, eq, inArray, isNull, max } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import type { Notificacion, NotificacionNueva, Sondeo } from './tipos'

/** La hoja que este despliegue está atendiendo. */
export function hojaActual(): string {
  const id = process.env.SHEET_ID
  if (!id) throw new Error('Falta SHEET_ID para resolver las notificaciones de esta hoja.')
  return id
}

const CLAVE_MARCA = () => `ultima_marca_caso:${hojaActual()}`

export async function leerMarca(): Promise<string | null> {
  const [fila] = await getDb()
    .select()
    .from(schema.ajustesApp)
    .where(eq(schema.ajustesApp.clave, CLAVE_MARCA()))
    .limit(1)
  return fila?.valor ?? null
}

export async function guardarMarca(iso: string): Promise<void> {
  await getDb()
    .insert(schema.ajustesApp)
    .values({ clave: CLAVE_MARCA(), valor: iso })
    .onConflictDoUpdate({ target: schema.ajustesApp.clave, set: { valor: iso } })
}

/** Inserta descartando lo repetido. Devuelve solo lo que de verdad se creó. */
export async function guardarNotificaciones(nuevas: NotificacionNueva[]): Promise<number> {
  if (nuevas.length === 0) return 0
  const hoja = hojaActual()
  const creadas = await getDb()
    .insert(schema.notificaciones)
    .values(nuevas.map((n) => ({ ...n, sheetId: hoja })))
    .onConflictDoNothing({ target: schema.notificaciones.clave })
    .returning({ id: schema.notificaciones.id })
  return creadas.length
}

/** Las claves que ya existen, para no pedir a Gmail metadatos que no se usarán. */
export async function clavesExistentes(claves: string[]): Promise<Set<string>> {
  if (claves.length === 0) return new Set()
  const hoja = hojaActual()
  const filas = await getDb()
    .select({ clave: schema.notificaciones.clave })
    .from(schema.notificaciones)
    .where(and(eq(schema.notificaciones.sheetId, hoja), inArray(schema.notificaciones.clave, claves)))
  return new Set(filas.map((f) => f.clave))
}

const TOPE_PANEL = 100

export async function sondeoDe(correo: string): Promise<Sondeo> {
  const db = getDb()
  const hoja = hojaActual()

  const [{ tope } = { tope: null }] = await db
    .select({ tope: max(schema.notificaciones.id) })
    .from(schema.notificaciones)
    .where(eq(schema.notificaciones.sheetId, hoja))

  const filas = await db
    .select({
      id: schema.notificaciones.id,
      tipo: schema.notificaciones.tipo,
      fila: schema.notificaciones.fila,
      folio: schema.notificaciones.folio,
      titulo: schema.notificaciones.titulo,
      detalle: schema.notificaciones.detalle,
      creadoEn: schema.notificaciones.creadoEn,
    })
    .from(schema.notificaciones)
    .leftJoin(
      schema.notificacionesLeidas,
      and(
        eq(schema.notificacionesLeidas.notificacionId, schema.notificaciones.id),
        eq(schema.notificacionesLeidas.correoUsuario, correo),
      ),
    )
    .where(
      and(
        eq(schema.notificaciones.sheetId, hoja),
        isNull(schema.notificacionesLeidas.notificacionId),
      ),
    )
    .orderBy(desc(schema.notificaciones.id))
    .limit(TOPE_PANEL)

  const noLeidas: Notificacion[] = filas.map((f) => ({
    id: f.id,
    tipo: f.tipo,
    fila: f.fila,
    folio: f.folio,
    titulo: f.titulo,
    detalle: f.detalle,
    creadoEnIso: f.creadoEn.toISOString(),
  }))

  const correosPorFila: Record<number, number> = {}
  for (const n of noLeidas) {
    if (n.tipo !== 'correo_recibido') continue
    correosPorFila[n.fila] = (correosPorFila[n.fila] ?? 0) + 1
  }

  return { maxId: tope ?? 0, noLeidas, correosPorFila }
}

export async function marcarLeidas(correo: string, ids: number[]): Promise<void> {
  if (ids.length === 0) return
  await getDb()
    .insert(schema.notificacionesLeidas)
    .values(ids.map((notificacionId) => ({ notificacionId, correoUsuario: correo })))
    .onConflictDoNothing()
}

/** Marca leído todo lo de un caso: es lo que hace la vista al abrirlo. */
export async function marcarLeidasDeFila(correo: string, fila: number): Promise<void> {
  const hoja = hojaActual()
  const pendientes = await getDb()
    .select({ id: schema.notificaciones.id })
    .from(schema.notificaciones)
    .where(and(eq(schema.notificaciones.sheetId, hoja), eq(schema.notificaciones.fila, fila)))
  await marcarLeidas(
    correo,
    pendientes.map((p) => p.id),
  )
}
```

- [ ] **Paso 5: verificar contra la base de verdad**

Script temporal en la raíz del proyecto (los `import` con alias `@/` solo resuelven ahí, y los paquetes sueltos no resuelven desde el scratchpad):

```ts
// verificar-almacen.ts
import { guardarNotificaciones, marcarLeidas, sondeoDe } from './src/lib/notificaciones/almacen'

async function main() {
  const creadas = await guardarNotificaciones([
    { tipo: 'caso_nuevo', fila: 9999, folio: '9999', titulo: 'Prueba', detalle: null, clave: 'prueba:1' },
  ])
  const repetidas = await guardarNotificaciones([
    { tipo: 'caso_nuevo', fila: 9999, folio: '9999', titulo: 'Prueba', detalle: null, clave: 'prueba:1' },
  ])
  console.log({ creadas, repetidas }) // espera { creadas: 1, repetidas: 0 }

  const antes = await sondeoDe('keynor.rivas@gplusseguros.mx')
  const mia = antes.noLeidas.find((n) => n.fila === 9999)
  await marcarLeidas('keynor.rivas@gplusseguros.mx', mia ? [mia.id] : [])
  const despues = await sondeoDe('keynor.rivas@gplusseguros.mx')
  const otro = await sondeoDe('patricia.ramirez@gplusseguros.mx')
  console.log({
    veKeynor: despues.noLeidas.some((n) => n.fila === 9999), // espera false
    vePaty: otro.noLeidas.some((n) => n.fila === 9999),      // espera true
  })
}
main()
```

`pnpm tsx verificar-almacen.ts`, comprobar las tres expectativas, borrar la fila de prueba con `psql "$POSTGRES_URL_NON_POOLING" -c "delete from notificaciones where clave='prueba:1'"` y borrar el script.

- [ ] **Paso 6: commit**

```bash
git add src/lib/notificaciones
git commit -m "feat: almacén de notificaciones con lo leído por usuario"
```

---

### Tarea 4: Endpoint de casos nuevos, con generación de folios

**Archivos:**
- Crear: `src/app/api/notificaciones/casos-nuevos/route.ts`
- Crear: `src/app/api/notificaciones/casos-nuevos/route.test.ts`
- Modificar: `src/app/acciones-folios.ts` (extraer la parte reusable)

**Interfaces:**
- Consume: `leerCasos`, `depsDeGoogle`, `casosNuevos`, `marcaMasAlta`, `secretoValido`, almacén.
- Produce: `POST /api/notificaciones/casos-nuevos`; `generarFoliosPendientes()` exportada desde `acciones-folios.ts`.

- [ ] **Paso 1: extraer la generación de folios de la acción**

Hoy `generarFolios()` es una Server Action que lee, filtra, escribe y revalida. La ruta necesita lo mismo **sin** `requerirUsuario()`, porque quien llama es n8n. Separar en dos:

```ts
// src/app/acciones-folios.ts — agregar, sin quitar la acción existente
/**
 * Genera los folios faltantes sin sesión de usuario. La comparte la acción del
 * botón (que además exige usuario y registra en bitácora) con la ruta que
 * despierta n8n al detectar peticiones nuevas.
 *
 * Va antes de crear el aviso: cuando el navegador refresque la tabla, el folio ya
 * tiene que estar ahí. Es justo lo que la mesa hacía a mano arrastrando la serie.
 */
export async function generarFoliosPendientes(
  autor: string,
): Promise<{ generados: number; error?: string }> {
  // Mismo cuerpo que hoy tiene `generarFolios` después de `requerirUsuario()`,
  // registrando en bitácora con `autor` como `correoUsuario`.
}
```

`generarFolios()` queda como `const usuario = await requerirUsuario(); return generarFoliosPendientes(usuario.correo)`.

Para la ruta, `autor` es `'n8n:casos-nuevos'`: la bitácora tiene que distinguir el folio que puso una persona del que puso el automático.

- [ ] **Paso 2: la prueba de la ruta**

```ts
// src/app/api/notificaciones/casos-nuevos/route.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FUENTE = readFileSync(join(import.meta.dirname, 'route.ts'), 'utf8')

describe('ruta de casos nuevos', () => {
  it('exige el secreto antes de cualquier otra cosa', () => {
    const posSecreto = FUENTE.indexOf('secretoValido')
    const posLectura = FUENTE.indexOf('leerCasos')
    expect(posSecreto).toBeGreaterThan(-1)
    expect(posSecreto).toBeLessThan(posLectura)
  })

  it('responde 401 sin secreto válido', () => {
    expect(FUENTE).toContain('status: 401')
  })

  it('no usa la lectura cacheada: el aviso tiene que ver la hoja de ahora', () => {
    expect(FUENTE).toContain('leerCasos')
    expect(FUENTE).not.toContain('cargarCola')
  })

  it('genera los folios antes de crear los avisos', () => {
    expect(FUENTE.indexOf('generarFoliosPendientes')).toBeLessThan(
      FUENTE.indexOf('guardarNotificaciones'),
    )
  })

  it('siembra la marca en silencio en la primera corrida', () => {
    expect(FUENTE).toContain('arranque')
  })

  it('invalida la caché de la fila para que el refresco traiga los casos nuevos', () => {
    expect(FUENTE).toContain("revalidateTag('casos')")
  })
})
```

- [ ] **Paso 3: correrla y verla fallar**

- [ ] **Paso 4: implementar la ruta**

```ts
// src/app/api/notificaciones/casos-nuevos/route.ts
import { revalidateTag } from 'next/cache'
import { generarFoliosPendientes } from '@/app/acciones-folios'
import { depsDeGoogle } from '@/lib/casos/consulta'
import { leerCasos } from '@/lib/google/sheet-reader'
import { guardarMarca, guardarNotificaciones, hojaActual, leerMarca } from '@/lib/notificaciones/almacen'
import { claveDeCasoNuevo } from '@/lib/notificaciones/claves'
import { casosNuevos, marcaMasAlta } from '@/lib/notificaciones/deteccion'
import { secretoValido } from '@/lib/notificaciones/secreto'

/**
 * La despierta el flujo "Mesa de Control · Casos nuevos" de n8n cada minuto.
 *
 * Detecta aquí y no en n8n por tres razones que están medidas: el disparador de
 * hoja de n8n identifica filas nuevas por conteo y el formulario inserta la
 * respuesta arriba de las filas pre-arrastradas, así que avisaría de las celdas
 * vacías del final; la columna del folio está protegida con editores nombrados y
 * la cuenta de servicio de n8n no es uno; y la serie del folio es "máximo de toda
 * la columna más uno" con revalidación previa, lógica que ya vive aquí.
 */
export async function POST(request: Request) {
  if (!secretoValido(request.headers.get('authorization'), process.env.NOTIFICACIONES_SECRET)) {
    return Response.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  const { casos } = await leerCasos(await depsDeGoogle())
  const marca = await leerMarca()
  const tope = marcaMasAlta(casos)

  // Arranque: la primera corrida solo siembra la marca. Avisar del histórico
  // completo llenaría el panel con mil casos viejos.
  if (marca === null) {
    if (tope) await guardarMarca(tope)
    return Response.json({ ok: true, arranque: true, marca: tope, hoja: hojaActual() })
  }

  const nuevos = casosNuevos(casos, marca)
  if (nuevos.length === 0) {
    return Response.json({ ok: true, nuevos: 0, foliosGenerados: 0, avisos: 0 })
  }

  const folios = await generarFoliosPendientes('n8n:casos-nuevos')

  // Se relee la hoja para que el aviso lleve el folio recién escrito.
  const { casos: conFolio } = folios.generados > 0 ? await leerCasos(await depsDeGoogle()) : { casos }
  const folioDe = (fila: number) => conFolio.find((c) => c.fila === fila)?.folio ?? null

  const avisos = await guardarNotificaciones(
    nuevos.map((c) => ({
      tipo: 'caso_nuevo' as const,
      fila: c.fila,
      folio: folioDe(c.fila),
      titulo: `Petición nueva de ${c.nombreSolicitante ?? 'un solicitante'}`,
      detalle: [c.tipoTramite, c.agencia].filter(Boolean).join(' · ') || null,
      clave: claveDeCasoNuevo(hojaActual(), c.fila),
    })),
  )

  if (tope) await guardarMarca(tope)
  // Para que el refresco del navegador traiga la hoja de ahora y no la cacheada.
  revalidateTag('casos')

  return Response.json({
    ok: true,
    nuevos: nuevos.length,
    foliosGenerados: folios.generados,
    errorDeFolios: folios.error ?? null,
    avisos,
  })
}
```

- [ ] **Paso 5: el secreto en el entorno local**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Agregar el valor a `.env.local` como `NOTIFICACIONES_SECRET=…`. **No** se toca Vercel todavía: eso va en la traza de la Tarea 11.

- [ ] **Paso 6: probar de punta a punta contra la hoja de prueba**

Con `pnpm dev` corriendo:

```bash
# 1. Sin secreto: 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/notificaciones/casos-nuevos

# 2. Con secreto, primera vez: arranque, sin avisos
curl -s -X POST localhost:3000/api/notificaciones/casos-nuevos \
  -H "authorization: Bearer $NOTIFICACIONES_SECRET" | jq

# 3. Segunda vez, sin cambios en la hoja: nuevos 0
curl -s -X POST localhost:3000/api/notificaciones/casos-nuevos \
  -H "authorization: Bearer $NOTIFICACIONES_SECRET" | jq
```

Después, **en la hoja de prueba**, agregar a mano una fila con marca temporal de hoy y algunos datos (imitando una respuesta del formulario), dejando el folio vacío. Volver a llamar y comprobar en la respuesta `nuevos: 1`, `foliosGenerados: 1`, `avisos: 1`; en la hoja, que el folio quedó con el máximo de la columna más uno; y en la base, la fila de `notificaciones`. Llamar una tercera vez: `avisos: 0`, sin folios nuevos. Al terminar, dejar la hoja de prueba como estaba.

- [ ] **Paso 7: commit**

```bash
git add src/app/api/notificaciones src/app/acciones-folios.ts
git commit -m "feat: ruta de casos nuevos que genera folios y crea avisos"
```

---

### Tarea 5: Endpoint de correos recibidos

**Archivos:**
- Crear: `src/lib/google/gmail-buzon.ts`, `src/lib/google/gmail-buzon.test.ts`
- Crear: `src/app/api/notificaciones/correos/route.ts`, `src/app/api/notificaciones/correos/route.test.ts`

**Interfaces:**
- Consume: `DepsGmail`, `casos_hilo`, `leerCasos`.
- Produce: `mensajesRecientes(deps, dias)`, `metadatosDeMensaje(deps, id)`, `POST /api/notificaciones/correos`.

- [ ] **Paso 1: la prueba del buzón**

```ts
// src/lib/google/gmail-buzon.test.ts
import { describe, expect, it, vi } from 'vitest'
import { mensajesRecientes, metadatosDeMensaje } from './gmail-buzon'

const DEPS = {
  fetch: undefined as unknown as typeof globalThis.fetch,
  accessToken: 'ya29.token',
  correoMesa: 'mesadecontrol@gplusseguros.mx',
}

function respuesta(cuerpo: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(cuerpo), { status: 200 })) as unknown as typeof globalThis.fetch
}

describe('mensajesRecientes', () => {
  it('pide solo lo que entró y no lo que mandó la mesa', async () => {
    const fetchMock = respuesta({ messages: [{ id: 'm1', threadId: 't1' }] })
    await mensajesRecientes({ ...DEPS, fetch: fetchMock }, 2)
    const [url] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const q = decodeURIComponent(String(url))
    expect(q).toContain('in:inbox')
    expect(q).toContain('newer_than:2d')
    expect(q).toContain('-from:me')
  })

  it('devuelve el par mensaje-hilo, que es lo único que hace falta', async () => {
    // `messages.list` ya trae el threadId: no hace falta una llamada por mensaje
    // para saber a qué conversación pertenece.
    const fetchMock = respuesta({ messages: [{ id: 'm1', threadId: 't1' }, { id: 'm2', threadId: 't1' }] })
    expect(await mensajesRecientes({ ...DEPS, fetch: fetchMock })).toEqual([
      { id: 'm1', threadId: 't1' },
      { id: 'm2', threadId: 't1' },
    ])
  })

  it('un buzón sin nada nuevo devuelve lista vacía, no falla', async () => {
    expect(await mensajesRecientes({ ...DEPS, fetch: respuesta({}) })).toEqual([])
  })
})

describe('metadatosDeMensaje', () => {
  it('saca el autor sin descargar el cuerpo del mensaje', async () => {
    const fetchMock = respuesta({
      payload: { headers: [{ name: 'From', value: 'Ana Pérez <ana@agencia.mx>' }] },
    })
    const meta = await metadatosDeMensaje({ ...DEPS, fetch: fetchMock }, 'm1')
    expect(meta.autor).toBe('Ana Pérez')
    const [url] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toContain('format=metadata')
  })

  it('cuando el remitente solo trae correo, ese es el autor', async () => {
    const fetchMock = respuesta({ payload: { headers: [{ name: 'From', value: 'ana@agencia.mx' }] } })
    expect((await metadatosDeMensaje({ ...DEPS, fetch: fetchMock }, 'm1')).autor).toBe('ana@agencia.mx')
  })
})
```

- [ ] **Paso 2: correrla y verla fallar**

- [ ] **Paso 3: implementar el buzón**

```ts
// src/lib/google/gmail-buzon.ts
import type { DepsGmail } from './gmail-thread'

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

/** Tope por consulta. El buzón de la mesa recibe decenas de correos al día. */
const TOPE = 50

async function pedir(deps: DepsGmail, url: string): Promise<unknown> {
  const respuesta = await deps.fetch(url, {
    headers: { Authorization: `Bearer ${deps.accessToken}` },
  })
  if (!respuesta.ok) {
    throw new Error(`Gmail respondió ${respuesta.status} al revisar el buzón.`)
  }
  return respuesta.json()
}

/**
 * Los mensajes que entraron al buzón de la mesa en los últimos días.
 *
 * `messages.list` ya devuelve el `threadId` de cada mensaje, así que una sola
 * llamada basta para saber a qué conversación pertenece cada uno: no hay una
 * petición por mensaje. `-from:me` descarta lo que la mesa envió.
 */
export async function mensajesRecientes(
  deps: DepsGmail,
  dias = 2,
): Promise<{ id: string; threadId: string }[]> {
  const q = encodeURIComponent(`in:inbox newer_than:${dias}d -from:me`)
  const cuerpo = (await pedir(deps, `${BASE}/messages?q=${q}&maxResults=${TOPE}`)) as {
    messages?: { id: string; threadId: string }[]
  }
  return (cuerpo.messages ?? []).map((m) => ({ id: m.id, threadId: m.threadId }))
}

/** Solo las cabeceras: el aviso dice quién escribió, no qué escribió. */
export async function metadatosDeMensaje(
  deps: DepsGmail,
  id: string,
): Promise<{ autor: string }> {
  const cuerpo = (await pedir(
    deps,
    `${BASE}/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From`,
  )) as { payload?: { headers?: { name: string; value: string }[] } }

  const de = cuerpo.payload?.headers?.find((h) => h.name.toLowerCase() === 'from')?.value ?? ''
  const conNombre = de.match(/^\s*"?([^"<]+?)"?\s*</)
  return { autor: (conNombre?.[1] ?? de).trim() || 'un remitente' }
}
```

- [ ] **Paso 4: verla pasar**

- [ ] **Paso 5: la prueba de la ruta**

```ts
// src/app/api/notificaciones/correos/route.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FUENTE = readFileSync(join(import.meta.dirname, 'route.ts'), 'utf8')

describe('ruta de correos recibidos', () => {
  it('exige el secreto antes de hablar con Gmail', () => {
    expect(FUENTE.indexOf('secretoValido')).toBeLessThan(FUENTE.indexOf('mensajesRecientes'))
  })

  it('resuelve la fila por el folio del hilo, no por la fila guardada', () => {
    // `casos_hilo` no lleva la hoja: su fila 7181 puede ser de la copia o de la
    // real. El folio sí identifica el caso dentro de la hoja que se está sirviendo.
    expect(FUENTE).toContain('folioUsado')
    expect(FUENTE).toContain('filaPorFolio')
  })

  it('descarta las claves que ya existen antes de pedir metadatos', () => {
    expect(FUENTE.indexOf('clavesExistentes')).toBeLessThan(
      FUENTE.indexOf('metadatosDeMensaje'),
    )
  })

  it('revalida la vista del caso para que el chat traiga el mensaje nuevo', () => {
    expect(FUENTE).toContain('revalidatePath')
  })
})
```

- [ ] **Paso 6: correrla y verla fallar**

- [ ] **Paso 7: implementar la ruta**

```ts
// src/app/api/notificaciones/correos/route.ts
import { revalidatePath } from 'next/cache'
import { inArray } from 'drizzle-orm'
import { getDb, schema } from '@/db'
import { depsDeGoogle } from '@/lib/casos/consulta'
import { depsGmail } from '@/lib/casos/hilo'
import { leerCasos } from '@/lib/google/sheet-reader'
import { mensajesRecientes, metadatosDeMensaje } from '@/lib/google/gmail-buzon'
import { clavesExistentes, guardarNotificaciones, hojaActual } from '@/lib/notificaciones/almacen'
import { claveDeCorreo } from '@/lib/notificaciones/claves'
import { secretoValido } from '@/lib/notificaciones/secreto'

/** La fila que le toca a un folio en la hoja que este despliegue atiende. */
function filaPorFolio(casos: { fila: number; folio: string | null }[], folio: string) {
  return casos.find((c) => c.folio?.trim() === folio.trim())?.fila ?? null
}

/**
 * La despierta el flujo "Mesa de Control · Correos recibidos" de n8n cada minuto.
 *
 * El mapeo mensaje → caso va por el **folio** del hilo y no por la fila guardada
 * en `casos_hilo`: esa tabla no lleva la hoja, así que su fila 7181 puede ser de
 * la copia o de la productiva. El folio se busca en la hoja que este despliegue
 * está sirviendo, y si no está, el mensaje simplemente no genera aviso aquí.
 */
export async function POST(request: Request) {
  if (!secretoValido(request.headers.get('authorization'), process.env.NOTIFICACIONES_SECRET)) {
    return Response.json({ ok: false, error: 'No autorizado.' }, { status: 401 })
  }

  const hoja = hojaActual()
  const mensajes = await mensajesRecientes(await depsGmail())
  if (mensajes.length === 0) return Response.json({ ok: true, mensajes: 0, avisos: 0 })

  const hilos = [...new Set(mensajes.map((m) => m.threadId))]
  const vinculos = await getDb()
    .select()
    .from(schema.casosHilo)
    .where(inArray(schema.casosHilo.threadId, hilos))
  if (vinculos.length === 0) return Response.json({ ok: true, mensajes: mensajes.length, avisos: 0 })

  const folioDeHilo = new Map(vinculos.map((v) => [v.threadId, v.folioUsado]))
  const deCasos = mensajes.filter((m) => folioDeHilo.has(m.threadId))
  const yaEstan = await clavesExistentes(deCasos.map((m) => claveDeCorreo(hoja, m.id)))
  const pendientes = deCasos.filter((m) => !yaEstan.has(claveDeCorreo(hoja, m.id)))
  if (pendientes.length === 0) {
    return Response.json({ ok: true, mensajes: mensajes.length, avisos: 0 })
  }

  const { casos } = await leerCasos(await depsDeGoogle())
  const deps = await depsGmail()

  const nuevas = []
  const filasTocadas = new Set<number>()
  for (const m of pendientes) {
    const folio = folioDeHilo.get(m.threadId)!
    const fila = filaPorFolio(casos, folio)
    if (fila === null) continue // el folio no vive en esta hoja: no es nuestro caso
    const { autor } = await metadatosDeMensaje(deps, m.id)
    nuevas.push({
      tipo: 'correo_recibido' as const,
      fila,
      folio,
      titulo: `Respuesta de ${autor}`,
      detalle: `Caso ${folio}`,
      clave: claveDeCorreo(hoja, m.id),
    })
    filasTocadas.add(fila)
  }

  const avisos = await guardarNotificaciones(nuevas)
  for (const fila of filasTocadas) revalidatePath(`/caso/${fila}`)

  return Response.json({ ok: true, mensajes: mensajes.length, avisos })
}
```

- [ ] **Paso 8: probar de punta a punta contra la hoja de prueba**

Con `pnpm dev`:
1. Abrir un caso de la hoja de prueba y enviarle un correo desde la app a una cuenta propia, para que exista el hilo en `casos_hilo`.
2. Responder ese correo desde esa cuenta.
3. `curl -s -X POST localhost:3000/api/notificaciones/correos -H "authorization: Bearer $NOTIFICACIONES_SECRET" | jq` → `avisos: 1`.
4. Repetir el `curl` → `avisos: 0` (la clave ya existe).
5. Comprobar en la base que la fila del aviso es la del caso correcto y que `sheet_id` es el de la copia.

- [ ] **Paso 9: commit**

```bash
git add src/lib/google/gmail-buzon.ts src/lib/google/gmail-buzon.test.ts src/app/api/notificaciones/correos
git commit -m "feat: ruta de correos recibidos con avisos por caso"
```

---

### Tarea 6: Rutas del navegador y sondeo

**Archivos:**
- Crear: `src/app/api/notificaciones/route.ts`, `src/app/api/notificaciones/leidas/route.ts`
- Crear: `src/app/api/notificaciones/route.test.ts`
- Crear: `src/components/notificaciones/proveedor.tsx`

**Interfaces:**
- Consume: `requerirUsuario`, `sondeoDe`, `marcarLeidas`, `marcarLeidasDeFila`.
- Produce: `GET /api/notificaciones` → `Sondeo`; `POST /api/notificaciones/leidas` con `{ids}` o `{fila}`; `useNotificaciones()` y `<ProveedorNotificaciones>`.

- [ ] **Paso 1: la prueba de las rutas**

```ts
// src/app/api/notificaciones/route.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SONDEO = readFileSync(join(import.meta.dirname, 'route.ts'), 'utf8')
const LEIDAS = readFileSync(join(import.meta.dirname, 'leidas', 'route.ts'), 'utf8')

describe('rutas del navegador', () => {
  it('el sondeo exige sesión', () => {
    expect(SONDEO).toContain('requerirUsuario')
  })

  it('el sondeo nunca se cachea: su gracia es traer lo de ahora', () => {
    expect(SONDEO).toContain("export const dynamic = 'force-dynamic'")
  })

  it('marcar leídas exige sesión y usa el correo de la sesión, no uno del cuerpo', () => {
    expect(LEIDAS).toContain('requerirUsuario')
    expect(LEIDAS).toContain('usuario.correo')
    // Aceptar un correo del cuerpo dejaría marcar como leído en nombre de otro.
    expect(LEIDAS).not.toMatch(/datos\.correo|body\.correo/)
  })
})
```

- [ ] **Paso 2: correrla y verla fallar**

- [ ] **Paso 3: implementar el sondeo**

```ts
// src/app/api/notificaciones/route.ts
import { requerirUsuario } from '@/lib/auth/guard'
import { sondeoDe } from '@/lib/notificaciones/almacen'

/** El navegador la llama cada 30 segundos: cachearla la volvería inútil. */
export const dynamic = 'force-dynamic'

export async function GET() {
  const usuario = await requerirUsuario()
  return Response.json(await sondeoDe(usuario.correo))
}
```

```ts
// src/app/api/notificaciones/leidas/route.ts
import { requerirUsuario } from '@/lib/auth/guard'
import { marcarLeidas, marcarLeidasDeFila } from '@/lib/notificaciones/almacen'

/**
 * Marca avisos como leídos para **el usuario de la sesión**. El correo sale de la
 * sesión y nunca del cuerpo: si viniera del cuerpo, cualquiera podría marcar los
 * pendientes de otra persona.
 */
export async function POST(request: Request) {
  const usuario = await requerirUsuario()

  let cuerpo: { ids?: number[]; fila?: number }
  try {
    cuerpo = (await request.json()) as { ids?: number[]; fila?: number }
  } catch {
    return Response.json({ ok: false, error: 'Cuerpo inválido.' }, { status: 400 })
  }

  if (typeof cuerpo.fila === 'number') {
    await marcarLeidasDeFila(usuario.correo, cuerpo.fila)
  } else if (Array.isArray(cuerpo.ids)) {
    await marcarLeidas(usuario.correo, cuerpo.ids.filter((n) => Number.isInteger(n)))
  }

  return Response.json({ ok: true })
}
```

- [ ] **Paso 4: implementar el proveedor**

```tsx
// src/components/notificaciones/proveedor.tsx
'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Notificacion, Sondeo } from '@/lib/notificaciones/tipos'

/**
 * Un solo sondeo por página.
 *
 * Vive en contexto porque tres cosas distintas de la misma pantalla necesitan lo
 * mismo —la campanita, las insignias de la tabla y el aviso del chat— y no tiene
 * sentido que cada una interrogue al servidor por su cuenta.
 *
 * Se detiene con la pestaña oculta: el sondeo existe para quien está mirando, y
 * una pestaña olvidada toda la noche son 960 peticiones que nadie lee.
 */
const INTERVALO_MS = 30_000

const VACIO: Sondeo = { maxId: 0, noLeidas: [], correosPorFila: {} }

type Contexto = Sondeo & {
  marcarLeidas: (ids: number[]) => Promise<void>
  marcarLeidasDeFila: (fila: number) => Promise<void>
  recargar: () => Promise<void>
  /** Se suscribe a lo que llegue nuevo. Devuelve la baja. */
  alLlegar: (escucha: (nuevas: Notificacion[]) => void) => () => void
}

const ctx = createContext<Contexto | null>(null)

export function useNotificaciones(): Contexto {
  const valor = useContext(ctx)
  if (!valor) throw new Error('useNotificaciones necesita ProveedorNotificaciones arriba.')
  return valor
}

export function ProveedorNotificaciones({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Sondeo>(VACIO)
  const conocidas = useRef<Set<number>>(new Set())
  const escuchas = useRef<Set<(nuevas: Notificacion[]) => void>>(new Set())
  const primeraVez = useRef(true)
  const detenido = useRef(false)

  const recargar = useCallback(async () => {
    if (detenido.current) return
    let datos: Sondeo
    try {
      const r = await fetch('/api/notificaciones', { cache: 'no-store' })
      // 401: la sesión venció. Insistir cada 30 s no la recupera.
      if (r.status === 401) {
        detenido.current = true
        return
      }
      if (!r.ok) return
      datos = (await r.json()) as Sondeo
    } catch {
      return // un fallo de red no debe romper la pantalla; se reintenta al rato
    }

    const nuevas = datos.noLeidas.filter((n) => !conocidas.current.has(n.id))
    for (const n of datos.noLeidas) conocidas.current.add(n.id)
    setEstado(datos)

    // En la primera carga todo es "nuevo" y no se debe disparar nada: lo que ya
    // estaba pendiente no es un evento que acabe de ocurrir.
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    if (nuevas.length > 0) for (const e of escuchas.current) e(nuevas)
  }, [])

  useEffect(() => {
    void recargar()
    const reloj = setInterval(() => {
      if (!document.hidden) void recargar()
    }, INTERVALO_MS)
    const alVolver = () => {
      if (!document.hidden) void recargar()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(reloj)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [recargar])

  const marcar = useCallback(
    async (cuerpo: { ids?: number[]; fila?: number }) => {
      await fetch('/api/notificaciones/leidas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      await recargar()
    },
    [recargar],
  )

  return (
    <ctx.Provider
      value={{
        ...estado,
        recargar,
        marcarLeidas: (ids) => marcar({ ids }),
        marcarLeidasDeFila: (fila) => marcar({ fila }),
        alLlegar: (escucha) => {
          escuchas.current.add(escucha)
          return () => escuchas.current.delete(escucha)
        },
      }}
    >
      {children}
    </ctx.Provider>
  )
}
```

- [ ] **Paso 5: verificar a mano**

Con `pnpm dev` y sesión abierta, en la consola del navegador:

```js
await (await fetch('/api/notificaciones')).json()
```

Debe devolver `{maxId, noLeidas, correosPorFila}`. Sin sesión (ventana privada) debe redirigir o dar 401, no datos.

- [ ] **Paso 6: commit**

```bash
git add src/app/api/notificaciones src/components/notificaciones src/lib/notificaciones/tipos.ts
git commit -m "feat: sondeo de notificaciones y proveedor de contexto"
```

---

### Tarea 7: Campanita y panel lateral

**Archivos:**
- Crear: `src/components/notificaciones/campanita.tsx`, `src/components/notificaciones/panel.tsx`
- Crear: `src/components/notificaciones/campanita.test.ts`
- Modificar: `src/app/fila/page.tsx`, `src/app/caso/[fila]/page.tsx` (montar el proveedor y la campanita)

- [ ] **Paso 1: la prueba**

```ts
// src/components/notificaciones/campanita.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CAMPANITA = readFileSync(join(import.meta.dirname, 'campanita.tsx'), 'utf8')
const PANEL = readFileSync(join(import.meta.dirname, 'panel.tsx'), 'utf8')

describe('campanita', () => {
  it('el punto azul solo existe cuando hay algo sin leer', () => {
    expect(CAMPANITA).toMatch(/noLeidas\.length > 0 &&/)
  })

  it('el punto va en la esquina superior derecha del ícono', () => {
    expect(CAMPANITA).toContain('-top-0.5')
    expect(CAMPANITA).toContain('-right-0.5')
  })

  it('dice cuántas hay sin leer para quien usa lector de pantalla', () => {
    expect(CAMPANITA).toContain('aria-label')
  })
})

describe('panel', () => {
  it('es una barra lateral sobrepuesta, no un desplegable', () => {
    expect(PANEL).toContain('fixed')
    expect(PANEL).toContain('inset-y-0')
    expect(PANEL).toContain('right-0')
  })

  it('se cierra con Escape y con el fondo', () => {
    expect(PANEL).toContain("'Escape'")
    expect(PANEL).toMatch(/onClick=\{.*cerrar/s)
  })

  it('cada aviso lleva al caso y se marca leído al entrar', () => {
    expect(PANEL).toContain('/caso/')
    expect(PANEL).toContain('marcarLeidas')
  })
})
```

- [ ] **Paso 2: correrla y verla fallar**

- [ ] **Paso 3: implementar la campanita**

```tsx
// src/components/notificaciones/campanita.tsx
'use client'

import { Bell } from 'lucide-react'
import { useState } from 'react'
import { useNotificaciones } from './proveedor'
import { PanelNotificaciones } from './panel'

export function Campanita() {
  const { noLeidas } = useNotificaciones()
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={
          noLeidas.length > 0
            ? `Notificaciones: ${noLeidas.length} sin leer`
            : 'Notificaciones'
        }
        className="relative inline-flex size-11 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="size-5" />
        {noLeidas.length > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-blue-600 ring-2 ring-card"
          />
        )}
      </button>
      {abierto && <PanelNotificaciones cerrar={() => setAbierto(false)} />}
    </>
  )
}
```

- [ ] **Paso 4: implementar el panel**

Barra lateral fija a la derecha, ancho `w-96` en escritorio y completo en móvil, con fondo oscurecido detrás. Cada aviso: ícono según tipo (`Mail` azul para correo, `FilePlus` para caso nuevo), título, detalle, hora relativa, y es un `<Link href={'/caso/' + fila}>` que al hacer clic marca ese aviso leído y cierra el panel. Arriba, un botón "Marcar todas como leídas" que llama `marcarLeidas(noLeidas.map(n => n.id))`. Con la lista vacía, un texto tranquilo: "No hay notificaciones pendientes."

Cerrar con `Escape` y con clic en el fondo, con el mismo patrón de `useEffect` que ya usa `FiltroEstatus` en `src/app/fila/filtros.tsx`.

- [ ] **Paso 5: montar en las dos páginas**

En `src/app/fila/page.tsx`, envolver el `return` en `<ProveedorNotificaciones>` y poner `<Campanita />` inmediatamente antes de `<BotonActualizar accion={actualizar} />`, dentro del mismo `div` de la cabecera.

En `src/app/caso/[fila]/page.tsx`, envolver igual y colocar la campanita en su cabecera, junto al enlace de regreso a la fila.

- [ ] **Paso 6: verificar en el navegador**

Insertar dos avisos a mano en la base para la hoja de prueba, recargar, y comprobar: punto azul visible, panel que abre y cierra, "marcar todas" que apaga el punto, y que al recargar sigue apagado. Con la sesión de otro usuario, el punto debe seguir encendido.

- [ ] **Paso 7: commit**

```bash
git add src/components/notificaciones src/app/fila/page.tsx "src/app/caso/[fila]/page.tsx"
git commit -m "feat: campanita con punto azul y panel lateral de notificaciones"
```

---

### Tarea 8: La tabla se actualiza sola y marca los casos con correo

**Archivos:**
- Crear: `src/app/fila/acciones.ts`, `src/app/fila/auto-actualizar.tsx`
- Crear: `src/components/notificaciones/insignia-correo.tsx`
- Crear: `src/app/fila/auto-actualizar.test.ts`
- Modificar: `src/app/fila/page.tsx`

- [ ] **Paso 1: mover la acción de actualizar**

`actualizar()` está declarada dentro del componente de página. La necesitan también el refresco automático, así que se mueve:

```ts
// src/app/fila/acciones.ts
'use server'

import { updateTag } from 'next/cache'
import { requerirUsuario } from '@/lib/auth/guard'

/**
 * `updateTag` y no `revalidateTag`: quien la llama quiere los datos frescos ahora
 * —el botón Actualizar, o la llegada de una petición nueva—, no en la próxima
 * visita.
 */
export async function actualizar(): Promise<void> {
  await requerirUsuario()
  updateTag('casos')
}
```

La página la importa y se la pasa a `BotonActualizar`.

- [ ] **Paso 2: la prueba**

```ts
// src/app/fila/auto-actualizar.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const AUTO = readFileSync(join(import.meta.dirname, 'auto-actualizar.tsx'), 'utf8')
const INSIGNIA = readFileSync(
  join(import.meta.dirname, '..', '..', 'components', 'notificaciones', 'insignia-correo.tsx'),
  'utf8',
)

describe('auto-actualizar', () => {
  it('reacciona solo a las peticiones nuevas, no a los correos', () => {
    expect(AUTO).toContain("tipo === 'caso_nuevo'")
  })

  it('invalida la caché antes de refrescar, o la tabla vuelve igual', () => {
    // `router.refresh()` sin `updateTag` reconstruye la página con la lectura
    // cacheada de la hoja: el caso nuevo no aparecería.
    expect(AUTO.indexOf('actualizar()')).toBeLessThan(AUTO.indexOf('router.refresh()'))
  })

  it('avisa en pantalla que la tabla se movió sola', () => {
    expect(AUTO).toMatch(/petici[oó]n/i)
  })
})

describe('insignia de correo', () => {
  it('no dibuja nada cuando el caso no tiene mensajes sin leer', () => {
    expect(INSIGNIA).toMatch(/if \(!?\s*(cuantos|correos)/)
  })

  it('es azul y trae el número de mensajes', () => {
    expect(INSIGNIA).toContain('bg-blue-600')
    expect(INSIGNIA).toContain('{cuantos}')
  })
})
```

- [ ] **Paso 3: correrla y verla fallar**

- [ ] **Paso 4: implementar el refresco automático**

```tsx
// src/app/fila/auto-actualizar.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { useNotificaciones } from '@/components/notificaciones/proveedor'
import { actualizar } from './acciones'

/**
 * Trae a la tabla las peticiones que acaban de llegar, sin que nadie toque
 * Actualizar. Los folios ya vienen escritos: la ruta que crea el aviso los genera
 * antes de insertarlo.
 *
 * El aviso en pantalla no es decorativo: la tabla cambia sola y quien está
 * leyendo un renglón tiene derecho a saber por qué se movió.
 */
export function AutoActualizarFila() {
  const { alLlegar } = useNotificaciones()
  const router = useRouter()
  const [, iniciar] = useTransition()
  const [cuantas, setCuantas] = useState(0)

  useEffect(
    () =>
      alLlegar((nuevas) => {
        const casos = nuevas.filter((n) => n.tipo === 'caso_nuevo')
        if (casos.length === 0) return
        setCuantas((n) => n + casos.length)
        iniciar(async () => {
          await actualizar()
          router.refresh()
        })
      }),
    [alLlegar, router],
  )

  if (cuantas === 0) return null

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-base dark:border-blue-900 dark:bg-blue-950">
      <p className="font-medium text-blue-700 dark:text-blue-300">
        {cuantas === 1 ? 'Llegó una petición nueva' : `Llegaron ${cuantas} peticiones nuevas`} y la
        tabla ya se actualizó.
      </p>
      <button
        type="button"
        onClick={() => setCuantas(0)}
        className="text-blue-700 underline underline-offset-4 dark:text-blue-300"
      >
        Entendido
      </button>
    </div>
  )
}
```

- [ ] **Paso 5: implementar la insignia**

```tsx
// src/components/notificaciones/insignia-correo.tsx
'use client'

import { Mail } from 'lucide-react'
import { useNotificaciones } from './proveedor'

/**
 * Cuelga del borde izquierdo del renglón, pegada al filo y con el lado derecho
 * redondeado.
 *
 * No sale por fuera del borde con un desplazamiento negativo porque la tabla vive
 * dentro de un contenedor con `overflow-x-auto`, que recortaría cualquier cosa
 * fuera de su área. Queda dentro de la primera celda, que se ensancha para darle
 * lugar.
 */
export function InsigniaCorreo({ fila }: { fila: number }) {
  const { correosPorFila } = useNotificaciones()
  const cuantos = correosPorFila[fila] ?? 0
  if (cuantos === 0) return null

  return (
    <span
      title={`${cuantos} ${cuantos === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} en este caso`}
      className="absolute top-1/2 left-0 inline-flex -translate-y-1/2 items-center gap-1 rounded-r-full bg-blue-600 py-1 pr-2.5 pl-2 text-sm font-medium text-white shadow-sm"
    >
      <Mail className="size-3.5" />
      {cuantos}
    </span>
  )
}
```

En `src/app/fila/page.tsx`: la primera columna pasa de `w-10` a `w-20`, su celda recibe `className="relative"`, y dentro va `<InsigniaCorreo fila={caso.fila} />` junto al `<PuntoSemaforo>`, que se desplaza a la derecha con `pl-10` para dejarle el lugar. Poner `<AutoActualizarFila />` arriba de `<GenerarFolios …>`.

- [ ] **Paso 6: verificar en el navegador**

1. Con la fila abierta, insertar a mano un aviso `caso_nuevo` en la base para la hoja de prueba y esperar el sondeo: debe aparecer el aviso azul.
2. Agregar de verdad una fila a la hoja de prueba y llamar la ruta de casos nuevos con `curl`; en menos de 30 segundos la tabla debe mostrar el renglón nuevo **con folio**, sin tocar Actualizar.
3. Insertar un aviso `correo_recibido` para una fila visible: debe salir la pastilla azul colgada a la izquierda de ese renglón, con el número.
4. Comprobar que la pastilla no se recorta al desplazar la tabla en horizontal ni en una ventana angosta.

- [ ] **Paso 7: commit**

```bash
git add src/app/fila src/components/notificaciones/insignia-correo.tsx
git commit -m "feat: la fila se actualiza sola y marca los casos con correo nuevo"
```

---

### Tarea 9: Aviso de mensajes nuevos en el chat del caso

**Archivos:**
- Crear: `src/app/caso/[fila]/aviso-mensajes.tsx`, `src/app/caso/[fila]/aviso-mensajes.test.ts`
- Modificar: `src/app/caso/[fila]/page.tsx` (título "Conversación")

- [ ] **Paso 1: la prueba**

```ts
// src/app/caso/[fila]/aviso-mensajes.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FUENTE = readFileSync(join(import.meta.dirname, 'aviso-mensajes.tsx'), 'utf8')

describe('aviso de mensajes nuevos', () => {
  it('solo mira los correos de este caso', () => {
    expect(FUENTE).toContain("tipo === 'correo_recibido'")
    expect(FUENTE).toContain('n.fila === fila')
  })

  it('refresca el chat al llegar el mensaje, sin esperar al usuario', () => {
    expect(FUENTE).toContain('refrescarConversacion')
    expect(FUENTE).toContain('router.refresh()')
  })

  it('se marca leído a los segundos, con la pestaña visible', () => {
    // Lo pidió el área: abrir el caso y verlo cuenta como leerlo. Con la pestaña
    // oculta no cuenta, o se marcaría leído lo que nadie vio.
    expect(FUENTE).toContain('setTimeout')
    expect(FUENTE).toContain('document.hidden')
    expect(FUENTE).toContain('marcarLeidasDeFila')
  })

  it('el aviso es azul y dice cuántos son', () => {
    expect(FUENTE).toContain('text-blue-600')
    expect(FUENTE).toMatch(/mensajes? nuevos?/)
  })
})
```

- [ ] **Paso 2: correrla y verla fallar**

- [ ] **Paso 3: implementar el aviso**

```tsx
// src/app/caso/[fila]/aviso-mensajes.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useNotificaciones } from '@/components/notificaciones/proveedor'
import { refrescarConversacion } from './acciones-correo'

/** Segundos con el caso abierto que cuentan como haber leído los mensajes. */
const ESPERA_LECTURA_MS = 3_000

export function AvisoMensajesNuevos({ fila }: { fila: number }) {
  const { correosPorFila, alLlegar, marcarLeidasDeFila } = useNotificaciones()
  const router = useRouter()
  const cuantos = correosPorFila[fila] ?? 0

  // Llega un correo mientras el caso está abierto: el chat se actualiza solo.
  useEffect(
    () =>
      alLlegar((nuevas) => {
        if (!nuevas.some((n) => n.tipo === 'correo_recibido' && n.fila === fila)) return
        void refrescarConversacion(fila).then(() => router.refresh())
      }),
    [alLlegar, fila, router],
  )

  // Estar aquí es leerlos. Con la pestaña oculta no cuenta.
  useEffect(() => {
    if (cuantos === 0) return
    const reloj = setTimeout(() => {
      if (!document.hidden) void marcarLeidasDeFila(fila)
    }, ESPERA_LECTURA_MS)
    return () => clearTimeout(reloj)
  }, [cuantos, fila, marcarLeidasDeFila])

  if (cuantos === 0) return null

  return (
    <span className="text-base font-medium text-blue-600 dark:text-blue-400">
      {cuantos} {cuantos === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}
    </span>
  )
}
```

- [ ] **Paso 4: colocarlo junto al título**

En `src/app/caso/[fila]/page.tsx`, el encabezado del panel de conversación pasa a ser un contenedor en línea con el título y el aviso:

```tsx
<div className="flex items-center gap-3">
  <h2 className="…">Conversación</h2>
  <AvisoMensajesNuevos fila={fila} />
</div>
```

- [ ] **Paso 5: verificar en el navegador**

1. Abrir un caso de la hoja de prueba que tenga hilo.
2. Responder el correo desde otra cuenta y llamar la ruta de correos con `curl`.
3. En menos de 30 segundos, con el caso abierto: aparece "1 mensaje nuevo" en azul junto a Conversación y el mensaje se agrega al chat sin recargar.
4. A los 3 segundos el aviso desaparece; recargar y confirmar que no vuelve.
5. Repetir con la pestaña en segundo plano: al volver a ella, el aviso debe estar visible antes de desaparecer.

- [ ] **Paso 6: commit**

```bash
git add "src/app/caso/[fila]"
git commit -m "feat: aviso y refresco automático de mensajes nuevos en el caso"
```

---

### Tarea 10: Flujos de n8n

**Archivos:**
- Crear: `docs/n8n-notificaciones.md` (qué quedó armado y cómo se prueba)

Todo se hace por la API REST de n8n con `N8N_API_KEY` (ver `../n8n/CLAUDE.md`). Las pruebas de esta tarea van contra un despliegue **Preview**, que usa la hoja de prueba, no contra producción.

- [ ] **Paso 1: la credencial del secreto**

`POST /api/v1/credentials` con tipo `httpHeaderAuth`, nombre `Mesa de Control · Secreto de notificaciones`, `name: authorization` y `value: Bearer <NOTIFICACIONES_SECRET>`. Queda como credencial y no escrito en el nodo, para que el secreto no se lea en el editor.

- [ ] **Paso 2: comprobar que Preview es alcanzable**

```bash
vercel deploy --yes            # despliegue Preview, usa la hoja de prueba
curl -s -o /dev/null -w '%{http_code}\n' -X POST <url-preview>/api/notificaciones/casos-nuevos
```

Se espera **401** (llega y rechaza por falta de secreto). Si responde 401 con HTML de Vercel o un 403, la protección de despliegues está activa y hay que desactivarla para Preview o usar un token de omisión; anotar cuál se eligió.

- [ ] **Paso 3: el flujo de casos nuevos**

`POST /api/v1/workflows`, nombre `Mesa de Control · Casos nuevos`:
- **Schedule Trigger**: cada minuto.
- **HTTP Request**: `POST <url>/api/notificaciones/casos-nuevos`, autenticación con la credencial del Paso 1, `Never Error` apagado (queremos que un 500 marque la ejecución como fallida), tiempo de espera 60 s.
- Sin nodos posteriores: la respuesta queda en la ejecución y eso es el registro.

Dejarlo **desactivado** hasta el Paso 5.

- [ ] **Paso 4: el flujo de correos recibidos**

Idéntico, nombre `Mesa de Control · Correos recibidos`, apuntando a `/api/notificaciones/correos`.

- [ ] **Paso 5: activarlos y ver tres ejecuciones**

`PATCH /api/v1/workflows/{id}` con `active: true` en los dos. Esperar tres minutos y revisar:

```bash
curl -sS -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "https://n8n.srv1195230.hstgr.cloud/api/v1/executions?workflowId=<id>&limit=5" | jq '.data[] | {status, startedAt}'
```

Las tres deben ser `success`. Con `includeData=true`, la respuesta del primer ciclo debe decir `arranque: true` y las siguientes `nuevos: 0`.

- [ ] **Paso 6: prueba de punta a punta sin tocar nada a mano**

Agregar una fila a la **hoja de prueba** y esperar. En menos de un minuto: la ejecución de n8n reporta `nuevos: 1` y `foliosGenerados: 1`, la hoja tiene el folio, y un navegador con la fila abierta (apuntado al Preview) muestra el renglón nuevo y la campanita con punto azul, sin intervención.

- [ ] **Paso 7: alerta de fallo**

Configurar en los dos flujos el *Error Workflow* apuntando al flujo existente `alertas-omar-discord` (`YAuedomaZlpRluTM`), para que un endpoint caído se avise en lugar de quedar en silencio. Verificar apagando el Preview y esperando una ejecución fallida.

- [ ] **Paso 8: documentar y commit**

`docs/n8n-notificaciones.md` con: ids de los dos flujos, nombre de la credencial, URL a la que apuntan hoy, cómo desactivarlos, y el resultado esperado de una ejecución sana.

```bash
git add docs/n8n-notificaciones.md
git commit -m "docs: flujos de n8n de notificaciones"
```

---

### Tarea 11: Traza de salida a producción

**Archivos:**
- Crear: `docs/PASO-A-PRODUCCION-NOTIFICACIONES.md`
- Modificar: `docs/AVANCE.md`

- [ ] **Paso 1: escribir la traza**

Documento corto y accionable, en este orden exacto:

1. **Variable de entorno.** `vercel env add NOTIFICACIONES_SECRET production` con el mismo valor que usa la credencial de n8n. Sin ella las rutas responden 401 a todo, así que agregarla **antes** de desplegar.
2. **Esquema.** Las tablas ya existen: la base es la misma para los tres entornos y se crearon en la Tarea 1. No hay migración pendiente. Comprobarlo con `\d notificaciones` antes de seguir.
3. **Despliegue.** `vercel deploy --prod --yes` y verificar que `/api/notificaciones/casos-nuevos` responde 401 sin secreto y 200 con él.
4. **Arranque silencioso.** La primera llamada en producción **no** debe avisar nada: siembra la marca de agua. Confirmar en la respuesta `arranque: true` y que `notificaciones` no creció. Si por error se avisara del histórico, la reparación es `delete from notificaciones where sheet_id = '<hoja productiva>'` y volver a llamar.
5. **Apuntar n8n a producción.** `PATCH` a los dos flujos cambiando la URL del nodo HTTP a `https://frontend-mesa-control.vercel.app`. Dejar anotada la URL anterior para poder volver.
6. **Vigilancia del primer día.** Revisar las ejecuciones de n8n cada tanto y `select tipo, count(*) from notificaciones where sheet_id='<productiva>' group by tipo`. Un salto raro de `caso_nuevo` significa que la marca de agua se perdió.
7. **Vuelta atrás.** Desactivar los dos flujos (`active: false`). La aplicación sigue funcionando: sin flujos no hay avisos nuevos, la campanita se queda vacía y el botón Actualizar sigue igual. Nada del resto de la app depende de las notificaciones.
8. **Lo que cuesta.** Dos llamadas por minuto de n8n (~86,000 al mes) más el sondeo de los navegadores abiertos (~5 usuarios × 120 por hora × 8 horas ≈ 105,000 al mes). Anotar el número real observado en la primera semana.
9. **Riesgo asumido con la generación automática de folios.** La ruta escribe en `JY` de la hoja **productiva** sin que nadie apriete un botón. Está acotada por el tope de 50 por tanda, solo toca celdas vacías y aborta el lote si la fila cambió; la bitácora la registra con `n8n:casos-nuevos` para distinguirla de lo que hizo una persona. Si el área prefiere que no se escriba sola, se apaga quitando la llamada a `generarFoliosPendientes` de la ruta: los avisos siguen llegando y el folio se genera con el botón.

- [ ] **Paso 2: actualizar `AVANCE.md`**

Fila nueva en la tabla de etapas ("Notificaciones en vivo"), conteo de la suite, y en Decisiones vigentes: por qué la detección vive en la app y no en los disparadores de n8n (los tres hechos medidos), el sondeo de 30 segundos con pausa en pestaña oculta, lo leído por usuario, y el arranque silencioso de la marca de agua.

- [ ] **Paso 3: commit**

```bash
git add docs
git commit -m "docs: traza de salida a producción de las notificaciones"
```
