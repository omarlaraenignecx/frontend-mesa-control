# Etapa 1 — Lectura del Sheet y cola de casos · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la mesa vea sus casos reales de 2026 en una cola de trabajo FIFO, con búsqueda y filtros, sin abrir la hoja de cálculo. Ninguna escritura: esta etapa solo lee.

**Architecture:** Tres módulos con una responsabilidad cada uno. El **mapeador** convierte los 307 encabezados en un mapa `campo lógico → columnas`, agrupando automáticamente por encabezado normalizado y unificando encabezados distintos con una tabla de alias. El **lector** hace una sola llamada a Sheets por carga y construye los casos resolviendo cada campo como el primer valor no vacío de su grupo. La **cola** ordena y filtra en memoria. La UI es un Server Component que se revalida con un botón Actualizar.

**Tech Stack:** lo ya instalado en la Etapa 0 (Next.js 16, TypeScript, Tailwind, Vitest) más `shadcn/ui` para la tabla y los controles.

## Global Constraints

Aplican todas las de la Etapa 0, y además:

- Hoja de **desarrollo**: `1rimFXIxaM4HrBHC9YQfwYfkh0l-RBJdbe7SLM0CGxEQ`, variable `SHEET_ID`. La productiva no se toca hasta la Etapa 4.
- Pestaña: `Respuestas de formulario 1` (`SHEET_PESTANA`). Encabezados en fila 1, datos desde fila 2.
- **Esta etapa no escribe nada.** Ninguna función de esta etapa llama a `values.update`, `values.append` ni `batchUpdate`. La única credencial que se usa es `accessTokenDeLaMesa()`.
- Toda lectura por **nombre de encabezado**, nunca por posición de columna (RNF-11).
- **Una sola petición a Sheets por carga de la cola**, no una por caso (RNF-08).
- La identidad de un caso es su **número de fila**. El folio es dato de negocio y puede faltar.
- Se descartan las filas sin marca temporal: son las pre-arrastradas con folio pero sin petición.
- Alcance temporal: peticiones de **2026 en adelante**.
- Caso **vivo** = su Estatus Final (`KA`) no es `Concluida` ni `Improcedente`. La cola muestra los vivos.
- Orden de la cola: **FIFO**, el vivo más antiguo primero.
- Semáforo por días naturales desde la marca temporal: verde ≤ 2, ámbar 3 a 5, rojo ≥ 6. Umbrales en un solo lugar del código.
- Fixture de encabezados reales ya disponible en `src/lib/google/__fixtures__/encabezados-307.json` (307 encabezados, de los cuales 297 con texto y 92 únicos al normalizar).

---

## File Structure

| Archivo | Responsabilidad |
| --- | --- |
| `src/lib/google/sheet-schema.ts` | Normalizar encabezados, agruparlos y resolver campos lógicos vía alias |
| `src/lib/google/sheet-reader.ts` | Una llamada a Sheets; convierte filas en casos |
| `src/lib/google/drive-links.ts` | Detectar y normalizar URLs de Drive a enlaces navegables |
| `src/lib/casos/caso.ts` | Tipo `Caso` y estado derivado (vivo, sin folio) |
| `src/lib/casos/semaforo.ts` | Días de espera → indicador |
| `src/lib/casos/cola.ts` | Orden FIFO, filtrado y búsqueda |
| `src/app/cola/page.tsx` | Cola de casos (Server Component) |
| `src/app/cola/filtros.tsx` | Controles de búsqueda y filtros (Client Component) |
| `src/app/cola/actualizar.tsx` | Botón Actualizar con Server Action de revalidación |

Cada módulo se prueba solo. Los tres primeros son funciones puras salvo la llamada a Sheets, que se inyecta.

---

## Task 1: Mapeador de esquema

**Files:**
- Create: `src/lib/google/sheet-schema.ts`
- Test: `src/lib/google/sheet-schema.test.ts`

**Interfaces:**
- Consumes: el fixture `src/lib/google/__fixtures__/encabezados-307.json`.
- Produces:
  - `normalizarEncabezado(texto: string): string` — minúsculas, sin acentos, sin espacios repetidos, sin `:` `?` `¿` en los extremos.
  - `type CampoLogico = 'marcaTemporal' | 'tipoTramite' | 'tipoNegocio' | 'nombreSolicitante' | 'correoSolicitante' | 'agencia' | 'agenciaExterna' | 'motivo' | 'aseguradoraDeclarada' | 'nombreCliente' | 'causaNoRealizo' | 'comentariosAdicionales' | 'folio' | 'estatusInicial' | 'estatusFinal' | 'quienAtendio' | 'folioInterno' | 'aseguradoraSeguimiento' | 'teniaPermisos' | 'causaSeguimiento' | 'observaciones' | 'fechaRespuestaCorreo' | 'fechaAtencionFinal'`
  - `type MapaEsquema = { columnasPorCampo: Record<CampoLogico, number[]>; columnasAdjuntos: { columna: number; etiqueta: string }[]; indicesSinResolver: number[] }` — los índices son 1-based, como las columnas de Sheets.
  - `construirMapa(encabezados: string[]): MapaEsquema`
  - `rangoDeLectura(mapa: MapaEsquema): string` — devuelve `'A'` y la última columna necesaria en notación A1, p. ej. `A2:KJ`.
  - `letraColumna(indice: number): string`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/google/sheet-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/encabezados-307.json'
import { construirMapa, letraColumna, normalizarEncabezado, rangoDeLectura } from './sheet-schema'

const ENCABEZADOS: string[] = fixture.encabezados

describe('normalizarEncabezado', () => {
  it('quita acentos, mayúsculas y signos de los extremos', () => {
    expect(normalizarEncabezado('¿Tipo de trámite?')).toBe('tipo de tramite')
    expect(normalizarEncabezado('Agencia:')).toBe('agencia')
  })

  it('colapsa espacios repetidos y saltos de línea, que la hoja tiene de sobra', () => {
    expect(normalizarEncabezado('Nombre del solicitante:\n\n')).toBe('nombre del solicitante')
    expect(normalizarEncabezado('Correo  del ejecutivo comercial de la zona')).toBe(
      'correo del ejecutivo comercial de la zona',
    )
  })
})

describe('letraColumna', () => {
  it('traduce índices 1-based a notación de columna de Sheets', () => {
    expect(letraColumna(1)).toBe('A')
    expect(letraColumna(26)).toBe('Z')
    expect(letraColumna(27)).toBe('AA')
    expect(letraColumna(285)).toBe('JY')
    expect(letraColumna(296)).toBe('KJ')
    expect(letraColumna(307)).toBe('KU')
  })
})

describe('construirMapa con los 307 encabezados reales', () => {
  const mapa = construirMapa(ENCABEZADOS)

  it('resuelve la marca temporal en la columna A', () => {
    expect(mapa.columnasPorCampo.marcaTemporal).toEqual([1])
  })

  it('agrupa las cinco columnas equivalentes de tipo de trámite', () => {
    // N, BQ, CY, FH, HQ comparten el encabezado "Tipo de trámite:"
    expect(mapa.columnasPorCampo.tipoTramite).toEqual(
      expect.arrayContaining([14, 69, 103, 164, 225]),
    )
  })

  it('reúne en un solo campo las 41 columnas del motivo de la petición', () => {
    expect(mapa.columnasPorCampo.motivo.length).toBeGreaterThanOrEqual(41)
  })

  it('resuelve el correo del solicitante incluyendo el del ejecutivo comercial', () => {
    // AD "Dirección de correo electrónico", JM "Correo del ejecutivo comercial de la zona"
    expect(mapa.columnasPorCampo.correoSolicitante).toEqual(expect.arrayContaining([30, 273]))
  })

  it('resuelve la agencia y la agencia externa como campos distintos', () => {
    expect(mapa.columnasPorCampo.agencia).toEqual(expect.arrayContaining([29]))
    expect(mapa.columnasPorCampo.agenciaExterna).toEqual(expect.arrayContaining([55]))
  })

  it('mapea las columnas de seguimiento de la mesa a su columna única', () => {
    expect(mapa.columnasPorCampo.folio).toEqual([285]) // JY
    expect(mapa.columnasPorCampo.estatusInicial).toEqual([286]) // JZ
    expect(mapa.columnasPorCampo.estatusFinal).toEqual([287]) // KA
    expect(mapa.columnasPorCampo.fechaRespuestaCorreo).toEqual([288]) // KB
    expect(mapa.columnasPorCampo.fechaAtencionFinal).toEqual([290]) // KD
    expect(mapa.columnasPorCampo.quienAtendio).toEqual([291]) // KE
    expect(mapa.columnasPorCampo.folioInterno).toEqual([292]) // KF
    expect(mapa.columnasPorCampo.aseguradoraSeguimiento).toEqual([293]) // KG
    expect(mapa.columnasPorCampo.teniaPermisos).toEqual([294]) // KH
    expect(mapa.columnasPorCampo.causaSeguimiento).toEqual([295]) // KI
    expect(mapa.columnasPorCampo.observaciones).toEqual([296]) // KJ
  })

  it('no confunde la aseguradora que declara el solicitante con la que registra la mesa', () => {
    // "Aseguradora" es el encabezado de BI (61), del formulario, y de KG (293),
    // del seguimiento. Son campos distintos y no deben mezclarse.
    expect(mapa.columnasPorCampo.aseguradoraSeguimiento).toEqual([293])
    expect(mapa.columnasPorCampo.aseguradoraDeclarada).toContain(61)
    expect(mapa.columnasPorCampo.aseguradoraDeclarada).not.toContain(293)
  })

  it('ningún campo del formulario toma columnas de la zona de seguimiento, y al revés', () => {
    const DE_SEGUIMIENTO = [
      'folio',
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
    ]
    for (const [campo, columnas] of Object.entries(mapa.columnasPorCampo)) {
      for (const c of columnas) {
        if (DE_SEGUIMIENTO.includes(campo)) expect(c).toBeGreaterThanOrEqual(285)
        else expect(c).toBeLessThan(285)
      }
    }
  })

  it('no confunde los duplicados residuales KL-KN con los estatus reales', () => {
    expect(mapa.columnasPorCampo.estatusInicial).not.toContain(298)
    expect(mapa.columnasPorCampo.estatusFinal).not.toContain(299)
  })

  it('detecta las columnas de adjuntos con una etiqueta legible', () => {
    // 14 grupos de adjuntos, 49 columnas en total
    expect(mapa.columnasAdjuntos.length).toBeGreaterThanOrEqual(49)
    const q = mapa.columnasAdjuntos.find((a) => a.columna === 17) // Q, adjunto de emisión
    expect(q).toBeDefined()
    expect(q!.etiqueta.length).toBeGreaterThan(0)
    expect(q!.etiqueta.length).toBeLessThanOrEqual(60)
  })

  it('no incluye columnas calculadas ni de fórmula en ningún campo', () => {
    const prohibidas = [289, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307]
    const usadas = Object.values(mapa.columnasPorCampo).flat()
    for (const p of prohibidas) expect(usadas).not.toContain(p)
  })

  it('reporta los encabezados que no supo clasificar en lugar de tragárselos', () => {
    // No es un error: sirve para revisarlos en Ajustes. Pero deben ser una minoría.
    expect(mapa.indicesSinResolver.length).toBeLessThan(ENCABEZADOS.length / 2)
  })

  it('tolera que el formulario agregue una pregunta al final', () => {
    const conNueva = [...ENCABEZADOS, '¿Requiere factura adicional?']
    const nuevo = construirMapa(conNueva)
    expect(nuevo.columnasPorCampo.tipoTramite).toEqual(mapa.columnasPorCampo.tipoTramite)
    expect(nuevo.columnasPorCampo.folio).toEqual(mapa.columnasPorCampo.folio)
  })

  it('sigue resolviendo si una columna del formulario cambia de lugar', () => {
    // Se mueve "Tipo de trámite:" de la posición 14 al final.
    const movido = [...ENCABEZADOS]
    const [tipo] = movido.splice(13, 1)
    movido.push(tipo)
    const nuevo = construirMapa(movido)
    expect(nuevo.columnasPorCampo.tipoTramite).toContain(movido.length)
  })
})

describe('rangoDeLectura', () => {
  it('cubre desde la columna A hasta la última columna que algún campo necesita', () => {
    const mapa = construirMapa(ENCABEZADOS)
    expect(rangoDeLectura(mapa)).toBe('A2:KJ')
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/google/sheet-schema.test.ts`
Expected: FAIL — no existe `./sheet-schema`.

- [ ] **Step 3: Implementar el mapeador**

Crear `src/lib/google/sheet-schema.ts`. La estrategia es en dos capas: agrupar por encabezado normalizado (que ya reduce 297 columnas a 92 grupos) y unificar grupos distintos que significan lo mismo con la tabla `ALIAS`.

```ts
export type CampoLogico =
  | 'marcaTemporal'
  | 'tipoTramite'
  | 'tipoNegocio'
  | 'nombreSolicitante'
  | 'correoSolicitante'
  | 'agencia'
  | 'agenciaExterna'
  | 'motivo'
  | 'aseguradoraDeclarada'
  | 'nombreCliente'
  | 'causaNoRealizo'
  | 'comentariosAdicionales'
  | 'folio'
  | 'estatusInicial'
  | 'estatusFinal'
  | 'quienAtendio'
  | 'folioInterno'
  | 'aseguradoraSeguimiento'
  | 'teniaPermisos'
  | 'causaSeguimiento'
  | 'observaciones'
  | 'fechaRespuestaCorreo'
  | 'fechaAtencionFinal'

export type MapaEsquema = {
  columnasPorCampo: Record<CampoLogico, number[]>
  columnasAdjuntos: { columna: number; etiqueta: string }[]
  indicesSinResolver: number[]
}

/**
 * Encabezados normalizados que corresponden a cada campo lógico. El formulario
 * está replicado en bloques, así que un mismo encabezado aparece en varias
 * columnas; además hay encabezados distintos que significan lo mismo.
 */
const ALIAS: Record<CampoLogico, string[]> = {
  marcaTemporal: ['marca temporal'],
  tipoTramite: [
    'tipo de tramite',
    'tramite',
    'indicar tipo de tramite solicitado',
    'indicar el tipo de solicitud',
  ],
  tipoNegocio: ['tipo de negocio', 'favor de indicar tipo de negocio'],
  nombreSolicitante: [
    'nombre del solicitante',
    'favor de indicar nombre completo del colaborador que solicita el tramite',
  ],
  correoSolicitante: [
    'direccion de correo electronico',
    'correo del solicitante',
    'correo del ejecutivo comercial de la zona',
  ],
  agencia: ['agencia'],
  agenciaExterna: ['indicar la agencia externa'],
  motivo: [
    'senalar el motivo por el cual se solicita el tramite a mesa de control',
    'motivo por el cual se solicita el tramite a mesa de control',
    'senalar el motivo por el cual el cliente solicita la atencion (seguimiento, queja, duda)',
  ],
  aseguradoraDeclarada: ['que aseguradora es', 'seleccionar la aseguradora', 'aseguradora'],
  nombreCliente: ['nombre del cliente', 'proporcionar el nombre y contacto del cliente'],
  causaNoRealizo: ['causa por la que no pudo realizar el tramite el ejecutivo y el comercial'],
  comentariosAdicionales: ['comentarios adicionales'],

  // Zona de seguimiento de la mesa: una sola columna cada uno.
  folio: ['folio de atencion'],
  estatusInicial: ['estatus inicial'],
  estatusFinal: ['estatus final'],
  fechaRespuestaCorreo: ['fecha y hora de respuesta por correo'],
  fechaAtencionFinal: ['fecha y hora de atencion final'],
  quienAtendio: ['quien atendio'],
  folioInterno: ['folio interno'],
  aseguradoraSeguimiento: ['aseguradora'],
  teniaPermisos: ['el ejecutivo contaba con permisos para realizar la actividad'],
  causaSeguimiento: ['causa por la que no pudo realizar la actividad'],
  observaciones: ['observaciones'],
}

/**
 * Columnas que la aplicación no debe leer como campo ni escribir jamás: son
 * fórmulas de la hoja (KC, KO-KU) o duplicados residuales de estatus (KL-KN).
 */
const COLUMNAS_EXCLUIDAS = new Set([289, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307])

/**
 * Frontera entre las dos zonas de la hoja: de A a JX son respuestas del
 * formulario, de JY en adelante es el seguimiento que captura la mesa.
 *
 * La frontera es indispensable, no cosmética: hay encabezados idénticos a los
 * dos lados. "Aseguradora" existe en BI (61), donde la declara el solicitante,
 * y en KG (293), donde la registra la mesa. Sin esta separación el mapeador
 * leería el seguimiento desde una columna del formulario.
 */
const PRIMERA_COLUMNA_SEGUIMIENTO = 285

/** Los campos de seguimiento viven una sola vez, en la zona de la mesa. */
const CAMPOS_COLUMNA_UNICA: CampoLogico[] = [
  'folio',
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
]

const PATRONES_ADJUNTO = [
  'adjuntar',
  'subir evidencia',
  'favor de enviar los documentos',
  'favor de enviar el formato',
  'favor de anexar',
]

export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[¿?:.\s]+|[¿?:.\s]+$/g, '')
    .trim()
}

export function letraColumna(indice: number): string {
  let n = indice
  let s = ''
  while (n > 0) {
    const resto = (n - 1) % 26
    s = String.fromCharCode(65 + resto) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function construirMapa(encabezados: string[]): MapaEsquema {
  const porNormalizado = new Map<string, number[]>()
  encabezados.forEach((texto, i) => {
    const indice = i + 1
    if (!texto?.trim() || COLUMNAS_EXCLUIDAS.has(indice)) return
    const clave = normalizarEncabezado(texto)
    if (!clave) return
    const lista = porNormalizado.get(clave) ?? []
    lista.push(indice)
    porNormalizado.set(clave, lista)
  })

  const columnasPorCampo = Object.fromEntries(
    (Object.keys(ALIAS) as CampoLogico[]).map((campo) => [campo, [] as number[]]),
  ) as Record<CampoLogico, number[]>

  const usadas = new Set<number>()

  for (const campo of Object.keys(ALIAS) as CampoLogico[]) {
    const esDeSeguimiento = CAMPOS_COLUMNA_UNICA.includes(campo)
    for (const alias of ALIAS[campo]) {
      for (const columna of porNormalizado.get(alias) ?? []) {
        // Cada campo solo admite columnas de su propia zona.
        const enZonaSeguimiento = columna >= PRIMERA_COLUMNA_SEGUIMIENTO
        if (esDeSeguimiento !== enZonaSeguimiento) continue
        columnasPorCampo[campo].push(columna)
        usadas.add(columna)
      }
    }
    columnasPorCampo[campo].sort((a, b) => a - b)
    // En la zona de la mesa cada campo tiene una sola columna buena; si el
    // encabezado se repitiera, la válida es la primera.
    if (esDeSeguimiento && columnasPorCampo[campo].length > 1) {
      columnasPorCampo[campo] = [columnasPorCampo[campo][0]]
    }
  }

  const columnasAdjuntos: { columna: number; etiqueta: string }[] = []
  encabezados.forEach((texto, i) => {
    const indice = i + 1
    if (!texto?.trim() || COLUMNAS_EXCLUIDAS.has(indice)) return
    const clave = normalizarEncabezado(texto)
    if (PATRONES_ADJUNTO.some((p) => clave.startsWith(p) || clave.includes(p))) {
      columnasAdjuntos.push({ columna: indice, etiqueta: etiquetaAdjunto(texto) })
    }
  })

  const indicesSinResolver = encabezados
    .map((texto, i) => ({ texto, indice: i + 1 }))
    .filter(
      ({ texto, indice }) =>
        texto?.trim() &&
        !usadas.has(indice) &&
        !COLUMNAS_EXCLUIDAS.has(indice) &&
        !columnasAdjuntos.some((a) => a.columna === indice),
    )
    .map(({ indice }) => indice)

  return { columnasPorCampo, columnasAdjuntos, indicesSinResolver }
}

/** Los encabezados de adjuntos son frases largas; se acortan para la interfaz. */
function etiquetaAdjunto(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim().replace(/^(Favor de |Adjuntar |Subir )/i, '')
  const corto = limpio.length > 60 ? `${limpio.slice(0, 57)}…` : limpio
  return corto.charAt(0).toUpperCase() + corto.slice(1)
}

export function rangoDeLectura(mapa: MapaEsquema): string {
  const usadas = [
    ...Object.values(mapa.columnasPorCampo).flat(),
    ...mapa.columnasAdjuntos.map((a) => a.columna),
  ]
  const ultima = Math.max(...usadas)
  return `A2:${letraColumna(ultima)}`
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm test src/lib/google/sheet-schema.test.ts`
Expected: PASS. Si alguna prueba de agrupación falla, la corrección va en la tabla `ALIAS`, nunca en la prueba: los índices esperados provienen de la hoja real.

> **Corrección aplicada durante la implementación.** El código de arriba fija la frontera en la columna 285 y excluye columnas por índice. Eso resultó frágil: si el formulario agrega una pregunta, `JY` se corre a 286 y todo el mapeo del seguimiento se rompe, justo lo que RNF-11 prohíbe. La versión final —la que está en `src/lib/google/sheet-schema.ts`— localiza la frontera **por encabezado** (`'folio de atencion'`) e ignora las columnas calculadas **por su encabezado** (`SLA`, `Total Dias`, `Estatus Real`, `Dias Espera AI/AF`, `Dia`, `Año/Mes Recibe`, `Tiempo entre solictud…`), además de descartar como residual toda repetición de un encabezado dentro de la zona de seguimiento (los `KL`–`KN`). Dos pruebas adicionales cubren el caso: insertar una pregunta nueva desplaza el folio a 286 y las observaciones a 297 sin perder ningún campo.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: mapeador de esquema por nombre de encabezado con alias de campos"
```

---

## Task 2: Normalización de enlaces de Drive

**Files:**
- Create: `src/lib/google/drive-links.ts`
- Test: `src/lib/google/drive-links.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type Adjunto = { etiqueta: string; url: string; fileId: string | null }`
  - `extraerAdjuntos(etiqueta: string, celda: string): Adjunto[]` — una celda puede traer varias URLs separadas por coma, espacio o salto de línea.
  - `esUrlDrive(texto: string): boolean`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/google/drive-links.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { esUrlDrive, extraerAdjuntos } from './drive-links'

describe('esUrlDrive', () => {
  it('reconoce el formato que produce el formulario', () => {
    expect(esUrlDrive('https://drive.google.com/open?id=11eqHaUTW-S99z7eWxBY5gasO')).toBe(true)
  })

  it('reconoce los otros formatos de Drive', () => {
    expect(esUrlDrive('https://drive.google.com/file/d/1abcDEF/view?usp=sharing')).toBe(true)
    expect(esUrlDrive('https://docs.google.com/spreadsheets/d/1abcDEF/edit')).toBe(true)
  })

  it('no confunde texto suelto con un enlace', () => {
    expect(esUrlDrive('pendiente de enviar')).toBe(false)
    expect(esUrlDrive('')).toBe(false)
  })
})

describe('extraerAdjuntos', () => {
  it('convierte la celda en un adjunto con etiqueta y fileId', () => {
    const r = extraerAdjuntos(
      'Datos completos para emisión',
      'https://drive.google.com/open?id=11eqHaUTW-S99z7eWxBY5gasO',
    )
    expect(r).toEqual([
      {
        etiqueta: 'Datos completos para emisión',
        url: 'https://drive.google.com/open?id=11eqHaUTW-S99z7eWxBY5gasO',
        fileId: '11eqHaUTW-S99z7eWxBY5gasO',
      },
    ])
  })

  it('separa varias URLs en la misma celda, que es lo que pasa cuando suben varios archivos', () => {
    const celda =
      'https://drive.google.com/open?id=AAA, https://drive.google.com/open?id=BBB\nhttps://drive.google.com/open?id=CCC'
    const r = extraerAdjuntos('Requisitos', celda)
    expect(r.map((a) => a.fileId)).toEqual(['AAA', 'BBB', 'CCC'])
    expect(r.every((a) => a.etiqueta === 'Requisitos')).toBe(true)
  })

  it('extrae el fileId del formato /file/d/', () => {
    const r = extraerAdjuntos('Factura', 'https://drive.google.com/file/d/1XyZ/view?usp=sharing')
    expect(r[0].fileId).toBe('1XyZ')
  })

  it('devuelve lista vacía si la celda no trae enlaces', () => {
    expect(extraerAdjuntos('Factura', 'lo envía por WhatsApp')).toEqual([])
    expect(extraerAdjuntos('Factura', '')).toEqual([])
  })

  it('conserva el enlace aunque no pueda deducir el fileId, para no ocultar información', () => {
    const r = extraerAdjuntos('Otro', 'https://drive.google.com/drive/folders/xyz?usp=sharing')
    expect(r).toHaveLength(1)
    expect(r[0].url).toContain('drive.google.com')
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/google/drive-links.test.ts`
Expected: FAIL — no existe `./drive-links`.

- [ ] **Step 3: Implementar**

Crear `src/lib/google/drive-links.ts`:

```ts
export type Adjunto = { etiqueta: string; url: string; fileId: string | null }

const DOMINIOS = ['drive.google.com', 'docs.google.com']

export function esUrlDrive(texto: string): boolean {
  if (!texto) return false
  return DOMINIOS.some((d) => texto.includes(d)) && /^https?:\/\//.test(texto.trim())
}

function fileIdDe(url: string): string | null {
  const porQuery = url.match(/[?&]id=([^&\s]+)/)
  if (porQuery) return porQuery[1]
  const porRuta = url.match(/\/d\/([^/?\s]+)/)
  if (porRuta) return porRuta[1]
  return null
}

/**
 * Una celda de adjuntos puede traer varias URLs cuando el solicitante sube
 * más de un archivo. El formulario las separa con coma y espacio.
 */
export function extraerAdjuntos(etiqueta: string, celda: string): Adjunto[] {
  if (!celda?.trim()) return []
  return celda
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => esUrlDrive(t))
    .map((url) => ({ etiqueta, url, fileId: fileIdDe(url) }))
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm test src/lib/google/drive-links.test.ts`
Expected: PASS, 9 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: normalización de adjuntos de Drive a enlaces navegables"
```

---

## Task 3: Modelo de caso y semáforo

**Files:**
- Create: `src/lib/casos/caso.ts`, `src/lib/casos/semaforo.ts`
- Test: `src/lib/casos/caso.test.ts`, `src/lib/casos/semaforo.test.ts`

**Interfaces:**
- Consumes: `Adjunto` de `src/lib/google/drive-links.ts`.
- Produces:
  - ```ts
    type Caso = {
      fila: number
      folio: string | null
      marcaTemporal: Date | null
      marcaTemporalTexto: string
      tipoTramite: string | null
      tipoNegocio: string | null
      nombreSolicitante: string | null
      correoSolicitante: string | null
      agencia: string | null
      motivo: string | null
      aseguradoraDeclarada: string | null
      nombreCliente: string | null
      estatusInicial: string | null
      estatusFinal: string | null
      quienAtendio: string | null
      folioInterno: string | null
      aseguradoraSeguimiento: string | null
      teniaPermisos: string | null
      causaSeguimiento: string | null
      observaciones: string | null
      fechaRespuestaCorreo: string | null
      fechaAtencionFinal: string | null
      adjuntos: Adjunto[]
      camposExtra: { etiqueta: string; valor: string }[]
    }
    ```
  - `ESTATUS_TERMINALES: readonly string[]` — `['Concluida', 'Improcedente']`
  - `estaVivo(caso: Caso): boolean`
  - `sinFolio(caso: Caso): boolean`
  - `parsearFechaHoja(texto: string): Date | null` — interpreta `D/M/YYYY H:mm:ss`, el formato de la columna A.
  - `type NivelSemaforo = 'verde' | 'ambar' | 'rojo'`
  - `UMBRALES_SEMAFORO: { ambar: number; rojo: number }` — `{ ambar: 3, rojo: 6 }`
  - `diasDeEspera(caso: Caso, hoy: Date): number | null`
  - `semaforoDe(caso: Caso, hoy: Date): NivelSemaforo | null`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `src/lib/casos/caso.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { estaVivo, parsearFechaHoja, sinFolio, type Caso } from './caso'

function caso(parcial: Partial<Caso> = {}): Caso {
  return {
    fila: 7176,
    folio: '7000',
    marcaTemporal: new Date(2026, 7, 5, 15, 14, 58),
    marcaTemporalTexto: '5/8/2026 15:14:58',
    tipoTramite: 'Emisión',
    tipoNegocio: 'EXTERNA',
    nombreSolicitante: 'Ricardo Hernandez',
    correoSolicitante: 'comercial28@garantiplus.mx',
    agencia: 'CHEVROLET CAMPESTRE',
    motivo: 'aplicar el pago a la póliza',
    aseguradoraDeclarada: null,
    nombreCliente: null,
    estatusInicial: 'Atendida/en trámite',
    estatusFinal: 'Tramite',
    quienAtendio: 'Keynor',
    folioInterno: null,
    aseguradoraSeguimiento: 'LA LATINO',
    teniaPermisos: 'No',
    causaSeguimiento: 'Función de GPLUS',
    observaciones: 'SE ENVIAN DATOS DE APLICACION DE PAGO',
    fechaRespuestaCorreo: null,
    fechaAtencionFinal: null,
    adjuntos: [],
    camposExtra: [],
    ...parcial,
  }
}

describe('parsearFechaHoja', () => {
  it('interpreta el formato D/M/YYYY H:mm:ss de la columna A', () => {
    const d = parsearFechaHoja('5/8/2026 15:14:58')
    expect(d).not.toBeNull()
    expect([d!.getFullYear(), d!.getMonth() + 1, d!.getDate()]).toEqual([2026, 8, 5])
    expect([d!.getHours(), d!.getMinutes(), d!.getSeconds()]).toEqual([15, 14, 58])
  })

  it('interpreta día y mes de un dígito', () => {
    const d = parsearFechaHoja('9/1/2026 9:05:03')
    expect([d!.getDate(), d!.getMonth() + 1, d!.getHours()]).toEqual([9, 1, 9])
  })

  it('acepta una fecha sin hora', () => {
    const d = parsearFechaHoja('20/2/2023')
    expect([d!.getDate(), d!.getMonth() + 1, d!.getFullYear()]).toEqual([20, 2, 2023])
  })

  it('devuelve null ante basura, sin lanzar', () => {
    expect(parsearFechaHoja('')).toBeNull()
    expect(parsearFechaHoja('#REF!')).toBeNull()
    expect(parsearFechaHoja('no es fecha')).toBeNull()
  })
})

describe('estaVivo', () => {
  it('un caso en trámite está vivo', () => {
    expect(estaVivo(caso({ estatusFinal: 'Tramite' }))).toBe(true)
  })

  it('un caso sin estatus final está vivo, porque nadie lo ha cerrado', () => {
    expect(estaVivo(caso({ estatusFinal: null }))).toBe(true)
    expect(estaVivo(caso({ estatusFinal: '' }))).toBe(true)
  })

  it('concluida e improcedente son terminales', () => {
    expect(estaVivo(caso({ estatusFinal: 'Concluida' }))).toBe(false)
    expect(estaVivo(caso({ estatusFinal: 'Improcedente' }))).toBe(false)
  })

  it('ignora espacios y mayúsculas del texto de la hoja', () => {
    expect(estaVivo(caso({ estatusFinal: ' concluida ' }))).toBe(false)
  })
})

describe('sinFolio', () => {
  it('detecta el caso que llegó sin folio, como la fila 7178', () => {
    expect(sinFolio(caso({ folio: null }))).toBe(true)
    expect(sinFolio(caso({ folio: '   ' }))).toBe(true)
    expect(sinFolio(caso({ folio: '7000' }))).toBe(false)
  })
})
```

Crear `src/lib/casos/semaforo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { UMBRALES_SEMAFORO, diasDeEspera, semaforoDe } from './semaforo'
import type { Caso } from './caso'

const HOY = new Date(2026, 7, 10, 12, 0, 0) // 10 de agosto de 2026

function conFecha(fecha: Date | null): Caso {
  return { marcaTemporal: fecha } as Caso
}

describe('diasDeEspera', () => {
  it('cuenta los días naturales desde la marca temporal', () => {
    expect(diasDeEspera(conFecha(new Date(2026, 7, 10, 9, 0)), HOY)).toBe(0)
    expect(diasDeEspera(conFecha(new Date(2026, 7, 8, 9, 0)), HOY)).toBe(2)
    expect(diasDeEspera(conFecha(new Date(2026, 6, 31, 9, 0)), HOY)).toBe(10)
  })

  it('devuelve null si el caso no tiene fecha legible', () => {
    expect(diasDeEspera(conFecha(null), HOY)).toBeNull()
  })
})

describe('semaforoDe', () => {
  it('verde hasta 2 días', () => {
    expect(semaforoDe(conFecha(new Date(2026, 7, 10)), HOY)).toBe('verde')
    expect(semaforoDe(conFecha(new Date(2026, 7, 8)), HOY)).toBe('verde')
  })

  it('ámbar de 3 a 5 días', () => {
    expect(semaforoDe(conFecha(new Date(2026, 7, 7)), HOY)).toBe('ambar')
    expect(semaforoDe(conFecha(new Date(2026, 7, 5)), HOY)).toBe('ambar')
  })

  it('rojo a partir de 6 días', () => {
    expect(semaforoDe(conFecha(new Date(2026, 7, 4)), HOY)).toBe('rojo')
    expect(semaforoDe(conFecha(new Date(2026, 6, 1)), HOY)).toBe('rojo')
  })

  it('los umbrales están en un solo lugar y son los acordados', () => {
    expect(UMBRALES_SEMAFORO).toEqual({ ambar: 3, rojo: 6 })
  })

  it('sin fecha no hay semáforo', () => {
    expect(semaforoDe(conFecha(null), HOY)).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `pnpm test src/lib/casos`
Expected: FAIL — no existen los módulos.

- [ ] **Step 3: Implementar el modelo**

Crear `src/lib/casos/caso.ts`:

```ts
import type { Adjunto } from '@/lib/google/drive-links'

export type Caso = {
  fila: number
  folio: string | null
  marcaTemporal: Date | null
  marcaTemporalTexto: string
  tipoTramite: string | null
  tipoNegocio: string | null
  nombreSolicitante: string | null
  correoSolicitante: string | null
  agencia: string | null
  motivo: string | null
  aseguradoraDeclarada: string | null
  nombreCliente: string | null
  estatusInicial: string | null
  estatusFinal: string | null
  quienAtendio: string | null
  folioInterno: string | null
  aseguradoraSeguimiento: string | null
  teniaPermisos: string | null
  causaSeguimiento: string | null
  observaciones: string | null
  fechaRespuestaCorreo: string | null
  fechaAtencionFinal: string | null
  adjuntos: Adjunto[]
  /** Campos con dato que el mapeador no clasificó; se muestran igual (RF-03). */
  camposExtra: { etiqueta: string; valor: string }[]
}

export const ESTATUS_TERMINALES = ['concluida', 'improcedente'] as const

/** La columna A guarda las fechas como D/M/YYYY H:mm:ss, no en ISO. */
export function parsearFechaHoja(texto: string): Date | null {
  if (!texto?.trim()) return null
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!m) return null
  const [, d, mes, a, h = '0', min = '0', s = '0'] = m
  const fecha = new Date(Number(a), Number(mes) - 1, Number(d), Number(h), Number(min), Number(s))
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

export function estaVivo(caso: Caso): boolean {
  const estatus = (caso.estatusFinal ?? '').trim().toLowerCase()
  if (!estatus) return true
  return !ESTATUS_TERMINALES.includes(estatus as (typeof ESTATUS_TERMINALES)[number])
}

export function sinFolio(caso: Caso): boolean {
  return !caso.folio?.trim()
}
```

Crear `src/lib/casos/semaforo.ts`:

```ts
import type { Caso } from './caso'

export type NivelSemaforo = 'verde' | 'ambar' | 'rojo'

/**
 * Días de espera a partir de los cuales cambia el indicador. Sujetos a
 * validación con Keynor y Norma, que conocen el SLA real del área.
 */
export const UMBRALES_SEMAFORO = { ambar: 3, rojo: 6 }

const MS_POR_DIA = 24 * 60 * 60 * 1000

export function diasDeEspera(caso: Pick<Caso, 'marcaTemporal'>, hoy: Date): number | null {
  if (!caso.marcaTemporal) return null
  const desde = new Date(
    caso.marcaTemporal.getFullYear(),
    caso.marcaTemporal.getMonth(),
    caso.marcaTemporal.getDate(),
  )
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.max(0, Math.round((hasta.getTime() - desde.getTime()) / MS_POR_DIA))
}

export function semaforoDe(caso: Pick<Caso, 'marcaTemporal'>, hoy: Date): NivelSemaforo | null {
  const dias = diasDeEspera(caso, hoy)
  if (dias === null) return null
  if (dias >= UMBRALES_SEMAFORO.rojo) return 'rojo'
  if (dias >= UMBRALES_SEMAFORO.ambar) return 'ambar'
  return 'verde'
}
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `pnpm test src/lib/casos`
Expected: PASS, 19 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: modelo de caso, parseo de fechas de la hoja y semáforo por días de espera"
```

---

## Task 4: Lector de casos

**Files:**
- Create: `src/lib/google/sheet-reader.ts`
- Test: `src/lib/google/sheet-reader.test.ts`

**Interfaces:**
- Consumes: `construirMapa`, `rangoDeLectura`, `letraColumna`, `MapaEsquema` de `sheet-schema.ts`; `extraerAdjuntos` de `drive-links.ts`; `Caso`, `parsearFechaHoja` de `@/lib/casos/caso`.
- Produces:
  - `type DepsLectura = { fetch: typeof globalThis.fetch; accessToken: string; sheetId: string; pestana: string }`
  - `leerEncabezados(deps: DepsLectura): Promise<string[]>`
  - `leerFilas(deps: DepsLectura, rango: string): Promise<string[][]>`
  - `construirCasos(filas: string[][], mapa: MapaEsquema, encabezados: string[], anioMinimo: number): Caso[]`
  - `leerCasos(deps: DepsLectura, anioMinimo?: number): Promise<{ casos: Caso[]; mapa: MapaEsquema; encabezados: string[] }>` — hace **dos** peticiones: una para encabezados y una para el rango de datos.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/google/sheet-reader.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import fixture from './__fixtures__/encabezados-307.json'
import { construirCasos, leerCasos } from './sheet-reader'
import { construirMapa } from './sheet-schema'

const ENCABEZADOS: string[] = fixture.encabezados
const MAPA = construirMapa(ENCABEZADOS)

/** Construye una fila de 307 celdas con valores en columnas concretas (1-based). */
function fila(valores: Record<number, string>): string[] {
  const f = new Array(307).fill('')
  for (const [col, v] of Object.entries(valores)) f[Number(col) - 1] = v
  return f
}

// Reproduce la fila 7176 real (folio 7000).
const FILA_7176 = fila({
  1: '5/8/2026 15:14:58',
  14: 'Emisión',
  17: 'https://drive.google.com/open?id=11eqHaUTW-S99z7eWxBY5gasO',
  28: 'Ricardo Hernandez',
  30: 'comercial28@garantiplus.mx',
  36: 'CHEVROLET CAMPESTRE solicita aplicar el pago a la poliza',
  55: 'CHEVROLET CAMPESTRE',
  56: 'EXTERNA',
  273: 'comercial28@garantiplus.mx',
  285: '7000',
  286: 'Atendida/en trámite',
  287: 'Tramite',
  291: 'Keynor',
  293: 'LA LATINO',
  294: 'No',
  295: 'Función de GPLUS',
  296: 'SE ENVIAN DATOS DE APLICACION DE PAGO Y FACTURA A PATY.',
})

describe('construirCasos', () => {
  it('arma el caso con los campos resueltos y la fila como identidad', () => {
    const [caso] = construirCasos([FILA_7176], MAPA, ENCABEZADOS, 2026)
    expect(caso.fila).toBe(2) // primera fila de datos
    expect(caso.folio).toBe('7000')
    expect(caso.tipoTramite).toBe('Emisión')
    expect(caso.nombreSolicitante).toBe('Ricardo Hernandez')
    expect(caso.correoSolicitante).toBe('comercial28@garantiplus.mx')
    expect(caso.estatusFinal).toBe('Tramite')
    expect(caso.quienAtendio).toBe('Keynor')
    expect(caso.aseguradoraSeguimiento).toBe('LA LATINO')
    expect(caso.marcaTemporal?.getFullYear()).toBe(2026)
  })

  it('resuelve el adjunto de la columna del trámite como enlace navegable', () => {
    const [caso] = construirCasos([FILA_7176], MAPA, ENCABEZADOS, 2026)
    expect(caso.adjuntos).toHaveLength(1)
    expect(caso.adjuntos[0].fileId).toBe('11eqHaUTW-S99z7eWxBY5gasO')
    expect(caso.adjuntos[0].etiqueta.length).toBeGreaterThan(0)
  })

  it('toma el primer valor no vacío cuando el campo vive en varias columnas', () => {
    // Tipo de trámite vacío en N (14) pero presente en CJ (88), que es "Trámite:"
    const f = fila({ 1: '5/8/2026 17:33:44', 88: 'Cotización', 285: '7002' })
    const [caso] = construirCasos([f], MAPA, ENCABEZADOS, 2026)
    expect(caso.tipoTramite).toBe('Cotización')
  })

  it('descarta las filas sin marca temporal, que son los folios pre-arrastrados', () => {
    const arrastrada = fila({ 285: '6404' })
    const casos = construirCasos([FILA_7176, arrastrada], MAPA, ENCABEZADOS, 2026)
    expect(casos).toHaveLength(1)
    expect(casos[0].folio).toBe('7000')
  })

  it('descarta las peticiones anteriores al año mínimo', () => {
    const vieja = fila({ 1: '20/2/2023 14:25:38', 285: '100' })
    const casos = construirCasos([vieja, FILA_7176], MAPA, ENCABEZADOS, 2026)
    expect(casos.map((c) => c.folio)).toEqual(['7000'])
  })

  it('acepta el caso sin folio y lo conserva en la lista', () => {
    const f = fila({ 1: '5/8/2026 17:33:44', 28: 'JACQUELINE HURTADO' })
    const [caso] = construirCasos([f], MAPA, ENCABEZADOS, 2026)
    expect(caso.folio).toBeNull()
    expect(caso.nombreSolicitante).toBe('JACQUELINE HURTADO')
  })

  it('nunca lee las columnas de fórmula ni los duplicados residuales', () => {
    const f = fila({
      1: '5/8/2026 15:00:00',
      285: '7003',
      289: '#REF!', // KC, fórmula
      298: 'valor residual', // KL
      305: '#REF!', // KS, fórmula
    })
    const [caso] = construirCasos([f], MAPA, ENCABEZADOS, 2026)
    const serializado = JSON.stringify(caso)
    expect(serializado).not.toContain('#REF!')
    expect(serializado).not.toContain('valor residual')
  })

  it('recoge en camposExtra los datos que el mapeador no clasificó, para no perderlos', () => {
    const columnaSinResolver = MAPA.indicesSinResolver[0]
    const f = fila({ 1: '5/8/2026 15:00:00', 285: '7004', [columnaSinResolver]: 'dato relevante' })
    const [caso] = construirCasos([f], MAPA, ENCABEZADOS, 2026)
    expect(caso.camposExtra.some((c) => c.valor === 'dato relevante')).toBe(true)
  })

  it('tolera filas más cortas que el total de columnas, como las devuelve Sheets', () => {
    const corta = ['5/8/2026 15:00:00', '', '', 'Emisión']
    expect(() => construirCasos([corta], MAPA, ENCABEZADOS, 2026)).not.toThrow()
  })
})

describe('leerCasos', () => {
  function fetchSecuencia(respuestas: unknown[]) {
    let i = 0
    return vi.fn(async () => {
      const cuerpo = respuestas[Math.min(i++, respuestas.length - 1)]
      return new Response(JSON.stringify(cuerpo), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch
  }

  const DEPS_BASE = {
    accessToken: 'ya29.token',
    sheetId: 'sheet-dev',
    pestana: 'Respuestas de formulario 1',
  }

  it('lee encabezados y datos con dos peticiones, no una por caso', async () => {
    const fetchMock = fetchSecuencia([
      { values: [ENCABEZADOS] },
      { values: [FILA_7176] },
    ])
    const { casos } = await leerCasos({ ...DEPS_BASE, fetch: fetchMock })
    expect(casos).toHaveLength(1)
    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2)
  })

  it('codifica el nombre de la pestaña, que trae espacios', async () => {
    const fetchMock = fetchSecuencia([{ values: [ENCABEZADOS] }, { values: [] }])
    await leerCasos({ ...DEPS_BASE, fetch: fetchMock })
    const [url] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toContain('Respuestas%20de%20formulario%201')
  })

  it('propaga el error de permiso con lenguaje claro', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: { code: 403 } }), { status: 403 }),
    ) as unknown as typeof globalThis.fetch
    await expect(leerCasos({ ...DEPS_BASE, fetch: fetchMock })).rejects.toThrow(/permiso/)
  })

  it('devuelve lista vacía sin fallar cuando la hoja no tiene datos', async () => {
    const fetchMock = fetchSecuencia([{ values: [ENCABEZADOS] }, {}])
    const { casos } = await leerCasos({ ...DEPS_BASE, fetch: fetchMock })
    expect(casos).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/google/sheet-reader.test.ts`
Expected: FAIL — no existe `./sheet-reader`.

- [ ] **Step 3: Implementar el lector**

Crear `src/lib/google/sheet-reader.ts`:

```ts
import { parsearFechaHoja, type Caso } from '@/lib/casos/caso'
import { extraerAdjuntos, type Adjunto } from './drive-links'
import { construirMapa, letraColumna, rangoDeLectura, type CampoLogico, type MapaEsquema } from './sheet-schema'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

export type DepsLectura = {
  fetch: typeof globalThis.fetch
  accessToken: string
  sheetId: string
  pestana: string
}

async function pedirValores(deps: DepsLectura, rango: string): Promise<string[][]> {
  const url = `${BASE}/${deps.sheetId}/values/${encodeURIComponent(`${deps.pestana}!${rango}`)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`
  const respuesta = await deps.fetch(url, {
    headers: { Authorization: `Bearer ${deps.accessToken}` },
  })

  if (respuesta.status === 403) {
    throw new Error('La cuenta de la mesa no tiene permiso para leer esta hoja de cálculo.')
  }
  if (respuesta.status === 404) {
    throw new Error('La hoja de cálculo o la pestaña indicada no existe.')
  }
  if (respuesta.status === 429) {
    throw new Error('Google limitó las consultas por exceso de peticiones. Intenta de nuevo en un momento.')
  }
  if (!respuesta.ok) {
    throw new Error(`Sheets respondió ${respuesta.status} al leer los casos.`)
  }

  const cuerpo = (await respuesta.json()) as { values?: string[][] }
  return cuerpo.values ?? []
}

export async function leerEncabezados(deps: DepsLectura): Promise<string[]> {
  const [encabezados] = await pedirValores(deps, '1:1')
  if (!encabezados?.length) throw new Error('La hoja no tiene encabezados en la primera fila.')
  return encabezados
}

export async function leerFilas(deps: DepsLectura, rango: string): Promise<string[][]> {
  return pedirValores(deps, rango)
}

function valorDe(fila: string[], columnas: number[]): string | null {
  for (const c of columnas) {
    const v = fila[c - 1]
    if (v && v.trim()) return v.trim()
  }
  return null
}

export function construirCasos(
  filas: string[][],
  mapa: MapaEsquema,
  encabezados: string[],
  anioMinimo: number,
): Caso[] {
  const campo = (fila: string[], c: CampoLogico) => valorDe(fila, mapa.columnasPorCampo[c])
  const casos: Caso[] = []

  filas.forEach((fila, i) => {
    const marcaTemporalTexto = campo(fila, 'marcaTemporal')
    if (!marcaTemporalTexto) return // fila pre-arrastrada, sin petición real

    const marcaTemporal = parsearFechaHoja(marcaTemporalTexto)
    if (!marcaTemporal || marcaTemporal.getFullYear() < anioMinimo) return

    const adjuntos: Adjunto[] = mapa.columnasAdjuntos.flatMap(({ columna, etiqueta }) =>
      extraerAdjuntos(etiqueta, fila[columna - 1] ?? ''),
    )

    const camposExtra = mapa.indicesSinResolver
      .map((c) => ({ etiqueta: (encabezados[c - 1] ?? '').replace(/\s+/g, ' ').trim(), valor: (fila[c - 1] ?? '').trim() }))
      .filter((c) => c.valor && c.etiqueta)

    const agencia = campo(fila, 'agenciaExterna') ?? campo(fila, 'agencia')

    casos.push({
      fila: i + 2, // los datos empiezan en la fila 2
      folio: campo(fila, 'folio'),
      marcaTemporal,
      marcaTemporalTexto,
      tipoTramite: campo(fila, 'tipoTramite'),
      tipoNegocio: campo(fila, 'tipoNegocio'),
      nombreSolicitante: campo(fila, 'nombreSolicitante'),
      correoSolicitante: campo(fila, 'correoSolicitante'),
      agencia,
      motivo: campo(fila, 'motivo'),
      aseguradoraDeclarada: campo(fila, 'aseguradoraDeclarada'),
      nombreCliente: campo(fila, 'nombreCliente'),
      estatusInicial: campo(fila, 'estatusInicial'),
      estatusFinal: campo(fila, 'estatusFinal'),
      quienAtendio: campo(fila, 'quienAtendio'),
      folioInterno: campo(fila, 'folioInterno'),
      aseguradoraSeguimiento: campo(fila, 'aseguradoraSeguimiento'),
      teniaPermisos: campo(fila, 'teniaPermisos'),
      causaSeguimiento: campo(fila, 'causaSeguimiento'),
      observaciones: campo(fila, 'observaciones'),
      fechaRespuestaCorreo: campo(fila, 'fechaRespuestaCorreo'),
      fechaAtencionFinal: campo(fila, 'fechaAtencionFinal'),
      adjuntos,
      camposExtra,
    })
  })

  return casos
}

export async function leerCasos(deps: DepsLectura, anioMinimo = 2026) {
  const encabezados = await leerEncabezados(deps)
  const mapa = construirMapa(encabezados)
  const filas = await leerFilas(deps, rangoDeLectura(mapa))
  return { casos: construirCasos(filas, mapa, encabezados, anioMinimo), mapa, encabezados }
}

export { letraColumna }
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm test src/lib/google/sheet-reader.test.ts`
Expected: PASS, 13 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: lector de casos con resolución de campos por grupo de columnas"
```

---

## Task 5: Orden y filtrado de la cola

**Files:**
- Create: `src/lib/casos/cola.ts`
- Test: `src/lib/casos/cola.test.ts`

**Interfaces:**
- Consumes: `Caso`, `estaVivo` de `./caso`.
- Produces:
  - `type Filtros = { texto?: string; tipoTramite?: string; estatus?: string; responsable?: string; agencia?: string; incluirCerrados?: boolean }`
  - `ordenarFifo(casos: Caso[]): Caso[]` — el más antiguo primero; los sin fecha al final.
  - `filtrar(casos: Caso[], filtros: Filtros): Caso[]`
  - `opcionesDeFiltro(casos: Caso[]): { tiposTramite: string[]; estatus: string[]; responsables: string[]; agencias: string[] }`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/casos/cola.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Caso } from './caso'
import { filtrar, opcionesDeFiltro, ordenarFifo } from './cola'

function c(parcial: Partial<Caso> & { fila: number }): Caso {
  return {
    folio: String(7000 + parcial.fila),
    marcaTemporal: new Date(2026, 7, 1),
    marcaTemporalTexto: '',
    tipoTramite: 'Emisión',
    tipoNegocio: null,
    nombreSolicitante: 'Solicitante',
    correoSolicitante: 'a@b.mx',
    agencia: 'AGENCIA UNO',
    motivo: null,
    aseguradoraDeclarada: null,
    nombreCliente: null,
    estatusInicial: null,
    estatusFinal: null,
    quienAtendio: 'Keynor',
    folioInterno: null,
    aseguradoraSeguimiento: null,
    teniaPermisos: null,
    causaSeguimiento: null,
    observaciones: null,
    fechaRespuestaCorreo: null,
    fechaAtencionFinal: null,
    adjuntos: [],
    camposExtra: [],
    ...parcial,
  } as Caso
}

describe('ordenarFifo', () => {
  it('pone el caso más antiguo primero, para que ninguno se añeje', () => {
    const casos = [
      c({ fila: 3, marcaTemporal: new Date(2026, 7, 5) }),
      c({ fila: 1, marcaTemporal: new Date(2026, 6, 20) }),
      c({ fila: 2, marcaTemporal: new Date(2026, 7, 1) }),
    ]
    expect(ordenarFifo(casos).map((x) => x.fila)).toEqual([1, 2, 3])
  })

  it('deja al final los casos sin fecha legible', () => {
    const casos = [c({ fila: 1, marcaTemporal: null }), c({ fila: 2, marcaTemporal: new Date(2026, 7, 1) })]
    expect(ordenarFifo(casos).map((x) => x.fila)).toEqual([2, 1])
  })

  it('no muta el arreglo recibido', () => {
    const casos = [c({ fila: 2, marcaTemporal: new Date(2026, 7, 5) }), c({ fila: 1, marcaTemporal: new Date(2026, 6, 1) })]
    const copia = [...casos]
    ordenarFifo(casos)
    expect(casos).toEqual(copia)
  })
})

describe('filtrar', () => {
  const casos = [
    c({ fila: 1, folio: '7001', estatusFinal: null, quienAtendio: 'Keynor', tipoTramite: 'Emisión' }),
    c({ fila: 2, folio: '7002', estatusFinal: 'Concluida', quienAtendio: 'Paty', tipoTramite: 'Cotización' }),
    c({ fila: 3, folio: '7003', estatusFinal: 'Tramite', quienAtendio: 'Paty', tipoTramite: 'Cotización' }),
    c({ fila: 4, folio: '7004', estatusFinal: 'Improcedente', quienAtendio: 'Keynor', tipoTramite: 'Endoso' }),
  ]

  it('por omisión muestra solo los casos vivos', () => {
    expect(filtrar(casos, {}).map((x) => x.folio)).toEqual(['7001', '7003'])
  })

  it('incluye los cerrados cuando se pide explícitamente', () => {
    expect(filtrar(casos, { incluirCerrados: true })).toHaveLength(4)
  })

  it('busca por folio', () => {
    expect(filtrar(casos, { texto: '7003', incluirCerrados: true }).map((x) => x.folio)).toEqual(['7003'])
  })

  it('busca por nombre de solicitante sin distinguir acentos ni mayúsculas', () => {
    const conAcento = [c({ fila: 9, nombreSolicitante: 'Ricardo Hernández' })]
    expect(filtrar(conAcento, { texto: 'hernandez' })).toHaveLength(1)
    expect(filtrar(conAcento, { texto: 'HERNÁNDEZ' })).toHaveLength(1)
  })

  it('busca por correo y por agencia', () => {
    const otros = [c({ fila: 9, correoSolicitante: 'elsa.torres@clikautofinance.com', agencia: 'PRO QRO' })]
    expect(filtrar(otros, { texto: 'clikauto' })).toHaveLength(1)
    expect(filtrar(otros, { texto: 'pro qro' })).toHaveLength(1)
  })

  it('filtra por tipo de trámite, estatus y responsable', () => {
    expect(filtrar(casos, { tipoTramite: 'Cotización' }).map((x) => x.folio)).toEqual(['7003'])
    expect(filtrar(casos, { responsable: 'Keynor' }).map((x) => x.folio)).toEqual(['7001'])
    expect(
      filtrar(casos, { estatus: 'Concluida', incluirCerrados: true }).map((x) => x.folio),
    ).toEqual(['7002'])
  })

  it('combina filtros con la búsqueda de texto', () => {
    expect(filtrar(casos, { responsable: 'Paty', texto: '7003' }).map((x) => x.folio)).toEqual(['7003'])
  })

  it('un caso sin folio se encuentra buscando por su solicitante', () => {
    const sinFolio = [c({ fila: 9, folio: null, nombreSolicitante: 'Jacqueline Hurtado' })]
    expect(filtrar(sinFolio, { texto: 'jacqueline' })).toHaveLength(1)
  })
})

describe('opcionesDeFiltro', () => {
  it('lista los valores presentes, ordenados y sin repetir', () => {
    const casos = [
      c({ fila: 1, tipoTramite: 'Emisión', quienAtendio: 'Paty', agencia: 'B' }),
      c({ fila: 2, tipoTramite: 'Cotización', quienAtendio: 'Keynor', agencia: 'A' }),
      c({ fila: 3, tipoTramite: 'Emisión', quienAtendio: 'Paty', agencia: 'A' }),
    ]
    const o = opcionesDeFiltro(casos)
    expect(o.tiposTramite).toEqual(['Cotización', 'Emisión'])
    expect(o.responsables).toEqual(['Keynor', 'Paty'])
    expect(o.agencias).toEqual(['A', 'B'])
  })

  it('omite los valores nulos', () => {
    const o = opcionesDeFiltro([c({ fila: 1, tipoTramite: null, quienAtendio: null })])
    expect(o.tiposTramite).toEqual([])
    expect(o.responsables).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/casos/cola.test.ts`
Expected: FAIL — no existe `./cola`.

- [ ] **Step 3: Implementar**

Crear `src/lib/casos/cola.ts`:

```ts
import { estaVivo, type Caso } from './caso'

export type Filtros = {
  texto?: string
  tipoTramite?: string
  estatus?: string
  responsable?: string
  agencia?: string
  incluirCerrados?: boolean
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** El más antiguo primero: la cola es de trabajo, no un historial. */
export function ordenarFifo(casos: Caso[]): Caso[] {
  return [...casos].sort((a, b) => {
    const ta = a.marcaTemporal?.getTime()
    const tb = b.marcaTemporal?.getTime()
    if (ta === undefined || ta === null) return 1
    if (tb === undefined || tb === null) return -1
    return ta - tb
  })
}

function coincideTexto(caso: Caso, aguja: string): boolean {
  const campos = [
    caso.folio,
    caso.nombreSolicitante,
    caso.correoSolicitante,
    caso.agencia,
    caso.nombreCliente,
    caso.folioInterno,
    caso.tipoTramite,
  ]
  return campos.some((c) => c && normalizar(c).includes(aguja))
}

export function filtrar(casos: Caso[], filtros: Filtros): Caso[] {
  const aguja = filtros.texto ? normalizar(filtros.texto) : ''
  return casos.filter((caso) => {
    if (!filtros.incluirCerrados && !estaVivo(caso)) return false
    if (filtros.tipoTramite && caso.tipoTramite !== filtros.tipoTramite) return false
    if (filtros.estatus && caso.estatusFinal !== filtros.estatus) return false
    if (filtros.responsable && caso.quienAtendio !== filtros.responsable) return false
    if (filtros.agencia && caso.agencia !== filtros.agencia) return false
    if (aguja && !coincideTexto(caso, aguja)) return false
    return true
  })
}

export function opcionesDeFiltro(casos: Caso[]) {
  const unicos = (valores: (string | null)[]) =>
    [...new Set(valores.filter((v): v is string => Boolean(v?.trim())))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    )

  return {
    tiposTramite: unicos(casos.map((c) => c.tipoTramite)),
    estatus: unicos(casos.map((c) => c.estatusFinal)),
    responsables: unicos(casos.map((c) => c.quienAtendio)),
    agencias: unicos(casos.map((c) => c.agencia)),
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm test src/lib/casos/cola.test.ts`
Expected: PASS, 13 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: orden FIFO, búsqueda y filtros de la cola"
```

---

## Task 6: Interfaz de la cola

**Files:**
- Create: `src/app/cola/filtros.tsx`, `src/app/cola/actualizar.tsx`, `src/lib/casos/consulta.ts`
- Modify: `src/app/cola/page.tsx`

**Interfaces:**
- Consumes: `leerCasos` de `sheet-reader.ts`; `accessTokenDeLaMesa`, `SinCredencialMesaError`, `CredencialMesaRevocadaError` de `auth-mesa.ts`; `requerirUsuario` de `guard.ts`; `ordenarFifo`, `filtrar`, `opcionesDeFiltro` de `cola.ts`; `semaforoDe`, `diasDeEspera` de `semaforo.ts`.
- Produces: `cargarCola(): Promise<{ casos: Caso[]; sinResolver: number }>` en `src/lib/casos/consulta.ts`, con `revalidateTag('casos')` como mecanismo de refresco.

- [ ] **Step 1: Instalar los componentes de interfaz**

```bash
pnpm dlx shadcn@latest init --yes --base-color neutral
pnpm dlx shadcn@latest add table input select badge button --yes
```

Si `shadcn init` pide sobrescribir `globals.css`, aceptar: el proyecto todavía no tiene estilos propios.

- [ ] **Step 2: Capa de consulta con caché etiquetada**

Crear `src/lib/casos/consulta.ts`:

```ts
import { unstable_cache } from 'next/cache'
import { accessTokenDeLaMesa } from '@/lib/google/auth-mesa'
import { leerCasos } from '@/lib/google/sheet-reader'
import type { Caso } from './caso'

export type ResultadoCola = {
  casos: Caso[]
  sinResolver: number
}

/**
 * La lectura de la hoja se cachea con la etiqueta 'casos' y solo se invalida
 * cuando la persona pulsa Actualizar. No hay polling ni refresco automático:
 * así el consumo de cuota de la API queda acotado a las cargas reales.
 */
async function leerDeLaHoja(): Promise<ResultadoCola> {
  const accessToken = await accessTokenDeLaMesa()
  const { casos, mapa } = await leerCasos({
    fetch: globalThis.fetch,
    accessToken,
    sheetId: process.env.SHEET_ID!,
    pestana: process.env.SHEET_PESTANA ?? 'Respuestas de formulario 1',
  })
  return { casos, sinResolver: mapa.indicesSinResolver.length }
}

export const cargarCola = unstable_cache(leerDeLaHoja, ['cola-casos'], {
  tags: ['casos'],
  revalidate: 300,
})
```

- [ ] **Step 3: Botón Actualizar**

Crear `src/app/cola/actualizar.tsx`:

```tsx
'use client'

import { useTransition } from 'react'

export function BotonActualizar({ accion }: { accion: () => Promise<void> }) {
  const [pendiente, iniciar] = useTransition()

  return (
    <button
      type="button"
      onClick={() => iniciar(() => accion())}
      disabled={pendiente}
      className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
    >
      {pendiente ? 'Actualizando…' : 'Actualizar'}
    </button>
  )
}
```

- [ ] **Step 4: Controles de búsqueda y filtros**

Crear `src/app/cola/filtros.tsx`:

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

type Opciones = {
  tiposTramite: string[]
  responsables: string[]
  estatus: string[]
}

export function Filtros({ opciones }: { opciones: Opciones }) {
  const router = useRouter()
  const params = useSearchParams()
  const [texto, setTexto] = useState(params.get('q') ?? '')

  function aplicar(cambios: Record<string, string>) {
    const nuevos = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(cambios)) {
      if (v) nuevos.set(k, v)
      else nuevos.delete(k)
    }
    router.push(`/cola?${nuevos.toString()}`)
  }

  const selectClase = 'rounded-md border bg-transparent px-2 py-1.5 text-sm'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          aplicar({ q: texto })
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Folio, solicitante, agencia…"
          className="w-64 rounded-md border bg-transparent px-3 py-1.5 text-sm"
        />
      </form>

      <select
        className={selectClase}
        value={params.get('tramite') ?? ''}
        onChange={(e) => aplicar({ tramite: e.target.value })}
      >
        <option value="">Todos los trámites</option>
        {opciones.tiposTramite.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <select
        className={selectClase}
        value={params.get('responsable') ?? ''}
        onChange={(e) => aplicar({ responsable: e.target.value })}
      >
        <option value="">Cualquier responsable</option>
        {opciones.responsables.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm text-neutral-500">
        <input
          type="checkbox"
          checked={params.get('cerrados') === '1'}
          onChange={(e) => aplicar({ cerrados: e.target.checked ? '1' : '' })}
        />
        Incluir cerrados
      </label>
    </div>
  )
}
```

- [ ] **Step 5: Página de la cola**

Reemplazar `src/app/cola/page.tsx`:

```tsx
import { revalidateTag } from 'next/cache'
import { requerirUsuario } from '@/lib/auth/guard'
import { sinFolio } from '@/lib/casos/caso'
import { filtrar, opcionesDeFiltro, ordenarFifo } from '@/lib/casos/cola'
import { cargarCola } from '@/lib/casos/consulta'
import { diasDeEspera, semaforoDe } from '@/lib/casos/semaforo'
import { CredencialMesaRevocadaError, SinCredencialMesaError } from '@/lib/google/auth-mesa'
import { BotonActualizar } from './actualizar'
import { Filtros } from './filtros'

const COLOR_SEMAFORO = {
  verde: 'bg-emerald-500',
  ambar: 'bg-amber-500',
  rojo: 'bg-red-500',
} as const

export default async function Cola({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tramite?: string; responsable?: string; cerrados?: string }>
}) {
  const usuario = await requerirUsuario()
  const params = await searchParams

  async function actualizar() {
    'use server'
    revalidateTag('casos')
  }

  let resultado: Awaited<ReturnType<typeof cargarCola>>
  try {
    resultado = await cargarCola()
  } catch (e) {
    const necesitaAutorizar =
      e instanceof SinCredencialMesaError || e instanceof CredencialMesaRevocadaError
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <h1 className="text-xl font-semibold">Cola de casos</h1>
        <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-6 text-sm dark:border-red-900 dark:bg-red-950">
          <p className="font-medium text-red-700 dark:text-red-300">
            No se pudieron leer los casos de la hoja
          </p>
          <p className="text-neutral-600 dark:text-neutral-400">
            {e instanceof Error ? e.message : 'Error desconocido'}
          </p>
          {necesitaAutorizar && usuario.rol === 'admin' && (
            <a href="/ajustes" className="inline-block underline">
              Ir a Ajustes para autorizar el acceso a Google
            </a>
          )}
          {necesitaAutorizar && usuario.rol !== 'admin' && (
            <p className="text-neutral-600 dark:text-neutral-400">
              Avisa al administrador de la Mesa de Control para que reautorice el acceso.
            </p>
          )}
        </div>
      </main>
    )
  }

  const hoy = new Date()
  const filtrados = ordenarFifo(
    filtrar(resultado.casos, {
      texto: params.q,
      tipoTramite: params.tramite,
      responsable: params.responsable,
      incluirCerrados: params.cerrados === '1',
    }),
  )
  const opciones = opcionesDeFiltro(resultado.casos)

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Cola de casos</h1>
          <p className="text-sm text-neutral-500">
            {filtrados.length} de {resultado.casos.length} casos · del más antiguo al más reciente
          </p>
        </div>
        <div className="flex items-center gap-2">
          {usuario.rol === 'admin' && (
            <a href="/ajustes" className="text-sm underline">
              Ajustes
            </a>
          )}
          <BotonActualizar accion={actualizar} />
        </div>
      </div>

      <Filtros opciones={opciones} />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="w-10 px-3 py-2"></th>
              <th className="px-3 py-2">Folio</th>
              <th className="px-3 py-2">Recibido</th>
              <th className="px-3 py-2">Trámite</th>
              <th className="px-3 py-2">Solicitante</th>
              <th className="px-3 py-2">Agencia</th>
              <th className="px-3 py-2">Estatus</th>
              <th className="px-3 py-2">Atiende</th>
              <th className="px-3 py-2">Espera</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((caso) => {
              const nivel = semaforoDe(caso, hoy)
              const dias = diasDeEspera(caso, hoy)
              return (
                <tr key={caso.fila} className="border-t hover:bg-neutral-50 dark:hover:bg-neutral-900">
                  <td className="px-3 py-2">
                    {nivel && (
                      <span
                        className={`inline-block size-2.5 rounded-full ${COLOR_SEMAFORO[nivel]}`}
                        title={`${dias} días de espera`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {caso.folio ?? (
                      <span className="text-amber-600" title="Esta petición llegó sin folio">
                        sin folio
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">{caso.marcaTemporalTexto}</td>
                  <td className="px-3 py-2">{caso.tipoTramite ?? '—'}</td>
                  <td className="px-3 py-2">{caso.nombreSolicitante ?? '—'}</td>
                  <td className="px-3 py-2">{caso.agencia ?? '—'}</td>
                  <td className="px-3 py-2">{caso.estatusInicial ?? '— sin tomar —'}</td>
                  <td className="px-3 py-2">{caso.quienAtendio ?? '—'}</td>
                  <td className="px-3 py-2 text-neutral-500">{dias === null ? '—' : `${dias} d`}</td>
                </tr>
              )
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-neutral-500">
                  Ningún caso coincide con lo que buscas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {resultado.sinResolver > 0 && (
        <p className="text-xs text-neutral-500">
          {resultado.sinResolver} columnas del formulario no están clasificadas; sus datos se
          mostrarán en la vista del caso como campos adicionales.
        </p>
      )}
    </main>
  )
}
```

- [ ] **Step 6: Verificar la suite y el build**

Run: `pnpm test && pnpm build`
Expected: todas las pruebas pasan y el build compila.

- [ ] **Step 7: Verificación manual contra la hoja de desarrollo**

```bash
pnpm dev
```

Entrar con `mesadecontrol@gplusseguros.mx` a `http://localhost:3000/cola` y comprobar, uno por uno:

1. La cola lista casos reales y el contador dice cuántos son de cuántos.
2. El primero de la lista es el más antiguo sin cerrar, y las fechas suben al bajar por la tabla.
3. Buscar `7000` encuentra el caso de Ricardo Hernandez con trámite Emisión y agencia CHEVROLET CAMPESTRE.
4. El caso de la fila 7178 aparece marcado **sin folio**.
5. Filtrar por trámite Cotización y por responsable Keynor reduce la lista de forma coherente.
6. Marcar **Incluir cerrados** aumenta el total.
7. El semáforo muestra rojo en los casos con más de 6 días.
8. Pulsar **Actualizar** recarga; si se agrega una fila de prueba en la hoja, aparece tras pulsarlo.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: interfaz de la cola de casos con búsqueda, filtros y actualización manual"
```

---

## Task 7: Cierre de etapa

**Files:**
- Modify: `docs/superpowers/plans/2026-08-06-etapa-1-lectura-y-cola.md`

- [ ] **Step 1: Suite completa y build**

Run: `pnpm test && pnpm build`
Expected: verde.

- [ ] **Step 2: Confirmar que la etapa no escribió nada**

```bash
grep -rnE "values/.*:(append|batchUpdate)|values\.update|method: 'PUT'|method: \"PUT\"" src/ || echo "sin escrituras: correcto"
```

Expected: `sin escrituras: correcto`.

- [ ] **Step 3: Desplegar y verificar en producción**

```bash
vercel --prod --yes
```

Verificar en `https://frontend-mesa-control.vercel.app/cola` los mismos ocho puntos del Step 7 de la Task 6.

- [ ] **Step 4: Publicar**

```bash
git push
```

---

## Criterio de cierre de la Etapa 1

La etapa está terminada cuando, en producción, la cola muestra los casos vivos reales de 2026 ordenados del más antiguo al más nuevo; la búsqueda encuentra un caso por folio, solicitante o agencia; los filtros de trámite y responsable funcionan; los casos sin folio se ven marcados; el semáforo refleja los días de espera; el botón Actualizar trae las filas nuevas; y la suite pasa completa. Ninguna escritura se ha ejecutado sobre ninguna hoja.

Al cerrar, se escribe el plan de la Etapa 2 (vista de caso individual y escritura del seguimiento).
