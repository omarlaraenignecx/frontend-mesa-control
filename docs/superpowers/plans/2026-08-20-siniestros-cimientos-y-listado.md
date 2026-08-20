# Siniestros: cimientos y listado — Plan de implementación

> **Para quien ejecute:** se implementa tarea por tarea, cada una con su ciclo de prueba y su commit.

**Objetivo:** reconocer los casos de siniestros en la hoja y darles su propio listado en
`/siniestros`, sin cambiar en nada la Mesa de Control.

**Arquitectura:** el campo lógico `area` del formulario distingue los casos; una
configuración de módulo parametriza título, rutas y clasificación; la pantalla del listado
se extrae a un componente que sirve a los dos módulos.

**Etapas cubiertas:** 1 (cimientos) y 2 (listado) de
`docs/superpowers/specs/2026-08-20-modulo-siniestros-design.md`.

## Restricciones globales

- **No se escribe en la hoja.** Todo esto es lectura y nombres. Las columnas del formulario
  siguen protegidas.
- **La Mesa de Control no cambia de comportamiento.** Ni una URL, ni una columna, ni un
  texto suyo.
- Comparaciones de texto de la hoja: siempre normalizando acentos y mayúsculas, como el
  resto del código.
- `Caso` es plano y serializable a JSON: nada de `Date` ni de clases (la cola se cachea).
- Pruebas: `pnpm test`. Verificación completa antes de cerrar: `pnpm typecheck`,
  `pnpm lint`, `pnpm build`.
- Los componentes de cliente se prueban leyendo su código con el ayudante `soloCodigo()`,
  como ya hace el resto de la suite.

---

### Task 1: El área en el mapeador y en el caso

**Archivos:**
- Modificar: `src/lib/google/sheet-schema.ts`
- Modificar: `src/lib/casos/caso.ts`
- Modificar: `src/lib/google/sheet-reader.ts`
- Prueba: `src/lib/google/sheet-schema.test.ts`, `src/lib/google/sheet-reader.test.ts`

**Interfaces:**
- Produce: `CampoLogico` gana `'area' | 'tipoSiniestro' | 'tipoAtencion' | 'numeroSiniestro'`;
  `Caso` gana `area`, `tipoSiniestro`, `tipoAtencion`, `numeroSiniestro`, todos
  `string | null`.

- [ ] **Paso 1: prueba que falla en el mapeador**

Con los encabezados reales de la fixture `encabezados-307.json`, el mapa debe resolver el
área en sus cinco columnas, con los dos encabezados distintos que usa la hoja:

```ts
it('resuelve el área del formulario en sus dos encabezados', () => {
  const mapa = construirMapa(encabezados)
  // BE y CU dicen "Áreas de GPLUS SEGUROS:"; CK, FC y HL dicen "Gplus Seguros"
  expect(mapa.columnasPorCampo.area).toEqual([57, 89, 98, 99, 159, 160, 220, 221])
})

it('el área no se mete a la franja de seguimiento', () => {
  const mapa = construirMapa(encabezados)
  const frontera = mapa.columnasPorCampo.folio[0]
  expect(mapa.columnasPorCampo.area.every((c) => c < frontera)).toBe(true)
})

it('los campos del ramo dejan de quedar sin clasificar', () => {
  const mapa = construirMapa(encabezados)
  expect(mapa.columnasPorCampo.tipoSiniestro).toContain(3)
  expect(mapa.columnasPorCampo.numeroSiniestro).toContain(58)
  expect(mapa.columnasPorCampo.tipoAtencion).toContain(65)
  for (const c of [3, 58, 65]) expect(mapa.indicesSinResolver).not.toContain(c)
})
```

Los números exactos de columna se confirman al correr la prueba: la fixture es la fila 1
real de la hoja. Si el conjunto difiere, se corrige la expectativa con lo que la fixture
diga, **no** los alias — la hoja es la verdad.

- [ ] **Paso 2: correr y verificar que falla**

`pnpm test src/lib/google/sheet-schema.test.ts` → falla: `area` no existe en `ALIAS`.

- [ ] **Paso 3: agregar los alias**

En `ALIAS` de `sheet-schema.ts`, con comentario que explique de dónde salen:

```ts
  /**
   * A qué área de Gplus va dirigida la petición: `Mesa de control`, `Siniestros` o
   * `Ingresos y Egresos`. Es lo que separa los dos módulos de la aplicación.
   *
   * Dos encabezados para lo mismo: el formulario pregunta "Áreas de GPLUS SEGUROS:"
   * en unos bloques y "Gplus Seguros" en otros. Medido el 20/8/2026 sobre la hoja:
   * 268 filas dicen Siniestros y ninguna fila trae la rama de preguntas del ramo sin
   * decirlo, así que esta columna es la regla completa.
   */
  area: ['areas de gplus seguros', 'gplus seguros'],
  /** Daño parcial · Pérdida total · Asistencia vial · Asistencia legal. */
  tipoSiniestro: ['tipo de siniestro'],
  /** Seguimiento a siniestro · Queja a la atención de la aseguradora. */
  tipoAtencion: ['tipo de atencion'],
  numeroSiniestro: ['numero de siniestro'],
```

No se agregan a `CAMPOS_COLUMNA_UNICA`: son del formulario, replicados por bloque, y el
lector ya toma el primer valor no vacío del grupo.

- [ ] **Paso 4: correr y verificar que pasa**

- [ ] **Paso 5: prueba que falla en el lector**

```ts
it('lee el área y los campos del ramo de la fila', () => {
  const casos = construirCasos([filaDeSiniestro], mapa, encabezados, 2026)
  expect(casos[0].area).toBe('Siniestros')
  expect(casos[0].tipoSiniestro).toBe('Daño parcial')
  expect(casos[0].numeroSiniestro).toBe('07-AUIN-205/2026')
})
```

- [ ] **Paso 6: agregar los campos a `Caso` y a `construirCasos`**

En `caso.ts`, junto a los demás campos del formulario y con un comentario en `area`:

```ts
  /** A qué área de Gplus va dirigida la petición. Separa la mesa de siniestros. */
  area: string | null
  tipoSiniestro: string | null
  tipoAtencion: string | null
  numeroSiniestro: string | null
```

En `construirCasos`, cuatro líneas `campo(fila, '…')`.

- [ ] **Paso 7: correr toda la suite**

`pnpm test` — aquí es donde aparecen las pruebas que construyen un `Caso` a mano y ahora
les falta un campo. Se completan con `null`. Si son muchas, se revisa si hay un ayudante
de fixture al que agregarle los campos una sola vez.

- [ ] **Paso 8: commit**

```bash
git add -A && git commit -m "feat: el área del formulario y los campos del ramo en el mapeador"
```

---

### Task 2: `esSiniestro` y la configuración de módulos

**Archivos:**
- Crear: `src/lib/casos/area.ts`
- Crear: `src/lib/modulos/modulo.ts`
- Prueba: `src/lib/casos/area.test.ts`, `src/lib/modulos/modulo.test.ts`

**Interfaces:**
- Consume: `Caso.area`, `Caso.tipoSiniestro` de la Task 1.
- Produce:
  ```ts
  // area.ts
  export const AREA_SINIESTROS = 'Siniestros'
  export function esSiniestro(caso: Pick<Caso, 'area'>): boolean

  // modulo.ts
  export type Modulo = 'mesa' | 'siniestros'
  export type Clasificacion = {
    campo: 'tipoTramite' | 'tipoSiniestro'
    param: string            // 'tramite' | 'tipo'
    columna: string          // encabezado en la tabla
    filtro: string           // etiqueta accesible del selector
    todos: string            // texto de la opción vacía
  }
  export type ConfigModulo = {
    clave: Modulo
    titulo: string
    rutaLista: string
    rutaCaso: (fila: number) => string
    incluye: (caso: Caso) => boolean
    clasificacion: Clasificacion
  }
  export const MESA: ConfigModulo
  export const SINIESTROS: ConfigModulo
  export function moduloDelCaso(caso: Caso): ConfigModulo
  ```

- [ ] **Paso 1: prueba que falla**

```ts
describe('esSiniestro', () => {
  it('reconoce el área tal como la escribe la hoja', () => {
    expect(esSiniestro({ area: 'Siniestros' })).toBe(true)
  })
  it('no se rompe por acentos, espacios ni mayúsculas', () => {
    expect(esSiniestro({ area: ' SINIESTROS ' })).toBe(true)
  })
  it('lo demás es de la mesa', () => {
    expect(esSiniestro({ area: 'Mesa de control' })).toBe(false)
    expect(esSiniestro({ area: 'Ingresos y Egresos' })).toBe(false)
    expect(esSiniestro({ area: null })).toBe(false)
  })
})

describe('moduloDelCaso', () => {
  it('un caso de siniestros pertenece a su módulo', () => {
    expect(moduloDelCaso(caso({ area: 'Siniestros' })).clave).toBe('siniestros')
  })
  it('la mesa incluye todo, siniestros solo lo suyo', () => {
    const deSiniestro = caso({ area: 'Siniestros' })
    expect(MESA.incluye(deSiniestro)).toBe(true)
    expect(SINIESTROS.incluye(caso({ area: 'Mesa de control' }))).toBe(false)
  })
  it('las rutas del caso apuntan a su módulo', () => {
    expect(MESA.rutaCaso(7250)).toBe('/caso/7250')
    expect(SINIESTROS.rutaCaso(7250)).toBe('/siniestros/caso/7250')
  })
})
```

- [ ] **Paso 2: correr y verificar que falla**

- [ ] **Paso 3: implementar**

`area.ts` compara normalizando. Si `cola.ts` ya tiene un `normalizar` privado, se extrae a
un módulo compartido en lugar de escribir un tercero; si extraerlo mueve mucho, `area.ts`
usa el suyo con un comentario que lo diga.

`modulo.ts`: `MESA.incluye = () => true` con comentario de por qué —el área pidió que la
mesa siga viendo los siniestros—; `SINIESTROS.incluye = esSiniestro`.

- [ ] **Paso 4: correr y verificar que pasa**

- [ ] **Paso 5: commit**

```bash
git add -A && git commit -m "feat: identificación del área y configuración de los módulos"
```

---

### Task 3: Clasificación configurable en los filtros

**Archivos:**
- Modificar: `src/lib/casos/cola.ts`
- Modificar: `src/lib/casos/cola.test.ts`
- Modificar: `src/app/fila/page.tsx` (solo el nombre del campo que le pasa)

**Interfaces:**
- Consume: `Clasificacion` de la Task 2.
- Produce: `Filtros.tipoTramite` se renombra a `Filtros.clasificacion` y aparece
  `Filtros.campoClasificacion?: 'tipoTramite' | 'tipoSiniestro'` con omisión
  `'tipoTramite'`; `opcionesDeFiltro(casos, campo)` devuelve `clases` en lugar de
  `tiposTramite`.

- [ ] **Paso 1: prueba que falla**

```ts
it('clasifica por tipo de siniestro cuando se le pide', () => {
  const casos = [
    caso({ fila: 2, tipoSiniestro: 'Daño parcial' }),
    caso({ fila: 3, tipoSiniestro: 'Pérdida total' }),
  ]
  const r = filtrar(casos, { clasificacion: 'Daño parcial', campoClasificacion: 'tipoSiniestro' })
  expect(r.map((c) => c.fila)).toEqual([2])
})

it('sin decir el campo sigue clasificando por trámite', () => {
  const casos = [caso({ fila: 2, tipoTramite: 'Endoso' }), caso({ fila: 3, tipoTramite: 'Emisión' })]
  expect(filtrar(casos, { clasificacion: 'Endoso' }).map((c) => c.fila)).toEqual([2])
})

it('la búsqueda por texto alcanza el número de siniestro', () => {
  const casos = [caso({ fila: 2, numeroSiniestro: '07-AUIN-205/2026' })]
  expect(filtrar(casos, { texto: 'auin-205' })).toHaveLength(1)
})

it('las opciones de clasificación salen del campo pedido', () => {
  const casos = [caso({ tipoSiniestro: 'Pérdida total' }), caso({ tipoSiniestro: 'Daño parcial' })]
  expect(opcionesDeFiltro(casos, 'tipoSiniestro').clases).toEqual(['Daño parcial', 'Pérdida total'])
})
```

- [ ] **Paso 2: correr y verificar que falla**

- [ ] **Paso 3: implementar**

En `Filtros`, renombrar y documentar por qué el nombre dejó de ser `tipoTramite`:

```ts
  /**
   * Valor del campo con el que cada módulo clasifica sus casos: tipo de trámite en la
   * mesa, tipo de siniestro en siniestros. No se llama `tipoTramite` porque ninguna
   * petición de siniestros trae ese dato —medido: 0 de 268— y ese selector saldría
   * siempre vacío.
   */
  clasificacion?: string
  campoClasificacion?: CampoClasificacion
```

En `filtrar`, la línea del filtro pasa a leer el campo configurado; en `busquedaExplicita`,
`filtros.clasificacion`. En `coincideTexto`, agregar `caso.tipoSiniestro` y
`caso.numeroSiniestro` al arreglo de campos: son nulos en la mesa, así que no la afectan.

`opcionesDeFiltro(casos, campo: CampoClasificacion = 'tipoTramite')` devuelve `clases`.

- [ ] **Paso 4: correr y verificar que pasa**

- [ ] **Paso 5: ajustar `/fila` y correr la suite completa**

`page.tsx` pasa `clasificacion: params.tramite` y `opciones.clases`; `filtros.tsx` lee
`opciones.clases`. La mesa se comporta igual: mismo parámetro `tramite` en la URL, mismo
texto en la pantalla.

- [ ] **Paso 6: commit**

```bash
git add -A && git commit -m "refactor: la clasificación del listado se configura por módulo"
```

---

### Task 4: La pantalla del listado, compartida

**Archivos:**
- Crear: `src/components/casos/pantalla-de-casos.tsx` (con el cuerpo que hoy vive en `src/app/fila/page.tsx`)
- Crear: `src/components/casos/filtros.tsx` (movido desde `src/app/fila/filtros.tsx`)
- Modificar: `src/app/fila/page.tsx` (queda como envoltura)
- Modificar: `src/app/fila/auto-actualizar.tsx`, `src/app/fila/invitacion-escritorio.tsx` (aceptan la ruta del módulo si la necesitan)
- Prueba: `src/components/casos/pantalla-de-casos.test.ts`

**Interfaces:**
- Consume: `ConfigModulo` de la Task 2, `opcionesDeFiltro` de la Task 3.
- Produce:
  ```ts
  export type ParamsListado = {
    q?: string; responsable?: string; estatus?: string; vista?: string
  } & Record<string, string | undefined>
  export async function PantallaDeCasos({
    modulo, params,
  }: { modulo: ConfigModulo; params: ParamsListado }): Promise<React.ReactElement>
  ```

- [ ] **Paso 1: prueba que falla**

Verificando el código fuente, que es como este repositorio prueba lo que no tiene DOM:

```ts
const fuente = soloCodigo(leer('src/components/casos/pantalla-de-casos.tsx'))

it('el título y las rutas salen del módulo, no están escritos', () => {
  expect(fuente).toContain('modulo.titulo')
  expect(fuente).toContain('modulo.rutaCaso(')
  expect(fuente).not.toContain('Mesa de Control')
  expect(fuente).not.toContain("'/fila'")
})

it('filtra por el módulo antes de contar las vistas', () => {
  expect(fuente).toContain('modulo.incluye')
})

it('el aviso de folios faltantes cuenta sobre toda la hoja', () => {
  // El arrastre llena la columna entera, no la vista que se esté mirando.
  expect(fuente).toContain('resultado.casos.filter(sinFolio)')
})
```

- [ ] **Paso 2: correr y verificar que falla**

- [ ] **Paso 3: mover la pantalla**

Se mueve el cuerpo de `PaginaDeLaFila` a `PantallaDeCasos`, cambiando **solo** lo que
depende del módulo:

| Antes | Después |
|---|---|
| `<h1>Mesa de Control</h1>` | `{modulo.titulo}` |
| `href={/caso/${caso.fila}}` | `modulo.rutaCaso(caso.fila)` |
| `href={/fila?vista=…}` | `${modulo.rutaLista}?vista=…` |
| `<Link href="/ajustes">` | enlace de ajustes propio del módulo |
| `filtrar(resultado.casos, …)` | `filtrar(delModulo, …)` con `delModulo = resultado.casos.filter(modulo.incluye)` |
| `<TableHead>Trámite</TableHead>` | `{modulo.clasificacion.columna}` |
| `{caso.tipoTramite ?? '—'}` | el campo configurado |
| `<GenerarFolios/>` siempre | solo cuando `modulo.clave === 'mesa'` |

Se agrega la columna "Número de siniestro" solo cuando el módulo la pide
(`modulo.clave === 'siniestros'`), para no meter una columna vacía en la mesa.

`ProveedorNotificaciones` recibe el módulo desde ya, aunque hasta la etapa 5 lo ignore:
así la etapa 5 no vuelve a tocar esta pantalla.

`filtros.tsx` se mueve a `components/casos/` y recibe `rutaLista` y `clasificacion`; las dos
apariciones de `/fila` escritas a mano —en `aplicar` y en "Limpiar"— pasan a usar
`rutaLista`, y el selector de trámite toma su etiqueta y su parámetro de `clasificacion`.

- [ ] **Paso 4: `/fila` queda como envoltura**

```tsx
export default async function PaginaDeLaFila({ searchParams }: { searchParams: Promise<ParamsListado> }) {
  return <PantallaDeCasos modulo={MESA} params={await searchParams} />
}
```

- [ ] **Paso 5: correr la suite y comprobar la mesa a ojo**

`pnpm test`, y después `pnpm dev` con `/fila`: las tres vistas, los conteos, un filtro, la
búsqueda, abrir un caso. Es un movimiento de código y ninguna de esas cosas debe cambiar.

- [ ] **Paso 6: commit**

```bash
git add -A && git commit -m "refactor: la pantalla del listado se comparte entre módulos"
```

---

### Task 5: La vista `/siniestros`

**Archivos:**
- Crear: `src/app/siniestros/page.tsx`
- Crear: `src/app/siniestros/loading.tsx`
- Crear: `src/app/siniestros/acciones.ts`
- Prueba: `src/app/siniestros/page.test.ts`

**Interfaces:**
- Consume: `PantallaDeCasos`, `SINIESTROS`.

- [ ] **Paso 1: prueba que falla**

```ts
it('la página de siniestros usa la pantalla compartida con su módulo', () => {
  const fuente = soloCodigo(leer('src/app/siniestros/page.tsx'))
  expect(fuente).toContain('PantallaDeCasos')
  expect(fuente).toContain('SINIESTROS')
})
```

- [ ] **Paso 2: correr y verificar que falla**

- [ ] **Paso 3: implementar**

La página, igual de delgada que la de la mesa. `loading.tsx` copia el esqueleto de
`src/app/fila/loading.tsx`. `acciones.ts` expone la acción de servidor de actualizar,
igual que la de la mesa —invalida la etiqueta `casos`—; si la de la mesa ya es genérica se
reusa en lugar de duplicarla.

- [ ] **Paso 4: correr y verificar que pasa**

- [ ] **Paso 5: comprobar a ojo con la hoja de copia**

`pnpm dev`, entrar a `/siniestros`. Se esperan los 8 casos de 2026 en "Todos los
pendientes", casi todos ya concluidos, así que "Fila de trabajo" puede salir vacía: eso es
correcto, no un error. El selector debe ofrecer tipos de siniestro y no de trámite.

- [ ] **Paso 6: commit**

```bash
git add -A && git commit -m "feat: listado de Atención a Siniestros"
```

---

### Task 6: Redirección desde la vista del caso de la mesa

**Archivos:**
- Modificar: `src/app/caso/[fila]/page.tsx`
- Prueba: `src/app/caso/[fila]/page.test.ts`

- [ ] **Paso 1: prueba que falla**

```ts
it('un caso de siniestros se atiende en su módulo', () => {
  const fuente = soloCodigo(leer('src/app/caso/[fila]/page.tsx'))
  expect(fuente).toContain('esSiniestro(caso)')
  expect(fuente).toContain('redirect(SINIESTROS.rutaCaso(')
})
```

- [ ] **Paso 2: correr y verificar que falla**

- [ ] **Paso 3: implementar**

Después de cargar el caso y antes de renderizar:

```tsx
  // La fila de la mesa sigue listando los siniestros, pero atenderlos aquí haría que
  // la respuesta saliera de mesadecontrol@ en lugar del buzón de siniestros. Se ve
  // desde la mesa, se atiende en su módulo.
  if (esSiniestro(caso)) redirect(SINIESTROS.rutaCaso(fila))
```

- [ ] **Paso 4: correr y verificar que pasa**

Hasta que exista `/siniestros/caso/[fila]` (etapa 4), la redirección lleva a un 404. Es
deliberado y se anota como pendiente de la etapa 4: es preferible un 404 visible a un
correo saliendo de la cuenta equivocada.

- [ ] **Paso 5: verificación completa y commit**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
git add -A && git commit -m "feat: los casos de siniestros se atienden en su módulo"
```

## Al terminar

Se actualiza `docs/AVANCE.md` con el conteo de pruebas, las decisiones nuevas y el
pendiente de la etapa 4 (la vista del caso a la que apunta la redirección). Después se
escribe el plan de la etapa 3.
