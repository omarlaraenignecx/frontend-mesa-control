# Etapa 3 — Conversación por correo · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la mesa abra la conversación con el solicitante desde el propio caso, la lea como un chat en texto plano, responda sin salir de la herramienta y mande o reciba archivos — con los correos saliendo en HTML profesional desde el buzón de la mesa.

**Architecture:** Cuatro piezas aisladas. `gmail-thread.ts` localiza y lee el hilo (por `threadId` guardado, con respaldo de búsqueda por asunto exacto). `html-a-texto.ts` convierte el HTML de Gmail en el texto plano que se ve en el chat, descartando citas y firmas. `render-correo.ts` compone el HTML que sale, a partir de la plantilla del tipo de trámite. `gmail-send.ts` arma el MIME multipart con adjuntos y lo envía. Los adjuntos entrantes se descargan por una ruta propia que valida la sesión; nada se almacena.

**Tech Stack:** lo ya instalado. Sin librerías nuevas de correo: el MIME se compone a mano para no arrastrar dependencias por algo que son cuatro cabeceras y un `base64url`.

## Global Constraints

Aplican todas las de las etapas anteriores, y además:

- **Asunto normalizado**: `Seguimiento de Caso | Gplus Seguros | <folio>`. La app fija asunto y destinatario; el usuario no los teclea (RF-08).
- **Sin folio no se abre conversación**: se pide capturarlo primero (ya implementado en la Etapa 2).
- **Destinatarios**: `To` = correo del solicitante, fijo y no editable. `CC` = correo del ejecutivo comercial **solo si difiere** del solicitante. El usuario puede **agregar** copias, nunca cambiar el destinatario principal. Cada copia agregada se registra en la bitácora.
- **Remitente**: `Mesa de Control | Gplus Seguros <mesadecontrol@gplusseguros.mx>`.
- **Firma**: `Mesa de Control — Gplus Seguros`, debajo `Atiende: <nombre completo>` y el correo del buzón. Nada de teléfonos ni direcciones inventadas.
- **Los correos salen en HTML** con su alternativa en texto plano en el mismo MIME. **En el chat se leen como texto plano**, sin HTML, sin citas del mensaje anterior y sin firmas.
- **Caso cerrado**: si llega respuesta a un caso con estatus terminal, el mensaje se muestra con un aviso y se puede contestar. La app **no** reabre el caso ni toca su estatus.
- **`KB`** (fecha y hora de respuesta por correo) se sella al enviar el **primer** correo del caso, si estaba vacía.
- **Sin polling**: el hilo se lee al abrir el caso y con un botón de actualizar propio del panel.
- Límite de Gmail: **25 MB** por correo, validado antes de intentar el envío, contando la sobrecarga de base64 (un archivo de 20 MB pesa ~27 MB codificado).
- Los adjuntos **no se almacenan**: entran del navegador al MIME, y los recibidos se sirven en streaming desde Gmail.
- Todo lo que cruza el caché sigue siendo serializable: **nada de `Date`** en los modelos.

---

## File Structure

| Archivo | Responsabilidad |
| --- | --- |
| `src/lib/correo/asunto.ts` | Componer y reconocer el asunto normalizado |
| `src/lib/correo/html-a-texto.ts` | HTML de Gmail → texto plano sin citas ni firmas |
| `src/lib/correo/mime.ts` | Armar el MIME multipart y codificarlo en base64url |
| `src/lib/correo/render-correo.ts` | Plantilla → HTML profesional + alternativa de texto |
| `src/lib/correo/plantillas.ts` | Leer, sembrar y guardar las plantillas de la base |
| `src/lib/correo/destinatarios.ts` | Resolver To y CC a partir del caso |
| `src/lib/google/gmail-thread.ts` | Localizar y leer el hilo; normalizar a mensajes de chat |
| `src/lib/google/gmail-send.ts` | Enviar y responder dentro del hilo |
| `src/app/caso/[fila]/conversacion.tsx` | Panel de chat |
| `src/app/caso/[fila]/acciones-correo.ts` | Server Actions de envío y refresco |
| `src/app/api/adjunto/[...ruta]/route.ts` | Descarga de adjuntos entrantes |
| `src/app/ajustes/plantillas.tsx` | Administrador de plantillas (admin) |

---

## Task 1: Asunto normalizado

**Files:**
- Create: `src/lib/correo/asunto.ts`
- Test: `src/lib/correo/asunto.test.ts`

**Interfaces:**
- Produces:
  - `PREFIJO_ASUNTO = 'Seguimiento de Caso | Gplus Seguros'`
  - `componerAsunto(folio: string): string`
  - `consultaDeBusqueda(folio: string): string` — la query de Gmail para reencontrar el hilo.
  - `esDelCaso(asunto: string, folio: string): boolean` — tolera los prefijos `Re:`, `RE:`, `Fwd:` que agregan los clientes de correo.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/correo/asunto.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { componerAsunto, consultaDeBusqueda, esDelCaso, PREFIJO_ASUNTO } from './asunto'

describe('componerAsunto', () => {
  it('usa el formato acordado con el folio al final', () => {
    expect(componerAsunto('7000')).toBe('Seguimiento de Caso | Gplus Seguros | 7000')
  })

  it('el prefijo está en un solo lugar', () => {
    expect(componerAsunto('7000').startsWith(PREFIJO_ASUNTO)).toBe(true)
  })

  it('recorta espacios del folio', () => {
    expect(componerAsunto('  7000 ')).toBe('Seguimiento de Caso | Gplus Seguros | 7000')
  })
})

describe('esDelCaso', () => {
  it('reconoce el asunto exacto', () => {
    expect(esDelCaso('Seguimiento de Caso | Gplus Seguros | 7000', '7000')).toBe(true)
  })

  it('reconoce las respuestas con Re: que agrega el cliente de correo', () => {
    expect(esDelCaso('Re: Seguimiento de Caso | Gplus Seguros | 7000', '7000')).toBe(true)
    expect(esDelCaso('RE: RE: Seguimiento de Caso | Gplus Seguros | 7000', '7000')).toBe(true)
    expect(esDelCaso('Fwd: Seguimiento de Caso | Gplus Seguros | 7000', '7000')).toBe(true)
  })

  it('no confunde el folio 700 con el 7000', () => {
    expect(esDelCaso('Seguimiento de Caso | Gplus Seguros | 7000', '700')).toBe(false)
    expect(esDelCaso('Seguimiento de Caso | Gplus Seguros | 700', '7000')).toBe(false)
  })

  it('rechaza un asunto ajeno aunque mencione el folio', () => {
    expect(esDelCaso('Consulta sobre el caso 7000', '7000')).toBe(false)
  })

  it('tolera diferencias de espacios alrededor de las barras', () => {
    expect(esDelCaso('Seguimiento de Caso|Gplus Seguros|7000', '7000')).toBe(true)
  })
})

describe('consultaDeBusqueda', () => {
  it('busca el asunto exacto entre comillas, para no traer hilos ajenos', () => {
    const q = consultaDeBusqueda('7000')
    expect(q).toContain('subject:')
    expect(q).toContain('"Seguimiento de Caso | Gplus Seguros | 7000"')
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/correo/asunto.test.ts`
Expected: FAIL — no existe el módulo.

- [ ] **Step 3: Implementar**

Crear `src/lib/correo/asunto.ts`:

```ts
export const PREFIJO_ASUNTO = 'Seguimiento de Caso | Gplus Seguros'

export function componerAsunto(folio: string): string {
  return `${PREFIJO_ASUNTO} | ${folio.trim()}`
}

/** Los clientes de correo agregan Re:, RE:, Fwd: al responder. */
const PREFIJOS_RESPUESTA = /^((re|rv|fwd|fw)\s*:\s*)+/i

function normalizarAsunto(asunto: string): string {
  return asunto
    .replace(PREFIJOS_RESPUESTA, '')
    .replace(/\s*\|\s*/g, '|')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function esDelCaso(asunto: string, folio: string): boolean {
  if (!asunto || !folio.trim()) return false
  return normalizarAsunto(asunto) === normalizarAsunto(componerAsunto(folio))
}

export function consultaDeBusqueda(folio: string): string {
  return `subject:"${componerAsunto(folio)}"`
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm test src/lib/correo/asunto.test.ts`
Expected: PASS, 10 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: asunto normalizado del caso y reconocimiento de respuestas"
```

---

## Task 2: HTML de Gmail a texto plano

**Files:**
- Create: `src/lib/correo/html-a-texto.ts`
- Test: `src/lib/correo/html-a-texto.test.ts`

**Interfaces:**
- Produces:
  - `htmlATexto(html: string): string`
  - `quitarCitas(texto: string): string` — descarta el bloque citado y la firma.
  - `limpiarCuerpo(contenido: { html?: string; texto?: string }): string`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/correo/html-a-texto.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { htmlATexto, limpiarCuerpo, quitarCitas } from './html-a-texto'

describe('htmlATexto', () => {
  it('convierte párrafos y saltos en texto legible', () => {
    expect(htmlATexto('<p>Buen día</p><p>Adjunto la factura</p>')).toBe(
      'Buen día\n\nAdjunto la factura',
    )
  })

  it('respeta los saltos de línea explícitos', () => {
    expect(htmlATexto('Línea uno<br>Línea dos')).toBe('Línea uno\nLínea dos')
  })

  it('descarta estilos y scripts en lugar de volcar su contenido', () => {
    const html = '<style>.x{color:red}</style><script>var a=1</script><p>Hola</p>'
    expect(htmlATexto(html)).toBe('Hola')
  })

  it('decodifica las entidades HTML', () => {
    expect(htmlATexto('<p>Cotizaci&oacute;n &amp; emisi&#243;n</p>')).toBe('Cotización & emisión')
  })

  it('convierte los elementos de lista en guiones', () => {
    expect(htmlATexto('<ul><li>Factura</li><li>Checklist</li></ul>')).toContain('- Factura')
  })

  it('colapsa los saltos excesivos que dejan las tablas de Gmail', () => {
    const html = '<table><tr><td>Uno</td></tr></table><br><br><br><br><p>Dos</p>'
    expect(htmlATexto(html)).not.toMatch(/\n{3,}/)
  })

  it('no deja etiquetas sueltas ni con atributos raros', () => {
    const html = '<div class="gmail_default" style="font-size:small">Texto</div>'
    expect(htmlATexto(html)).toBe('Texto')
  })

  it('devuelve cadena vacía ante entrada vacía', () => {
    expect(htmlATexto('')).toBe('')
  })
})

describe('quitarCitas', () => {
  it('descarta el bloque citado que empieza con "El ... escribió:"', () => {
    const texto = 'Ya lo revisé, gracias.\n\nEl mar, 5 ago 2026 a las 15:14, Mesa de Control escribió:\n> Buen día\n> Adjunto'
    expect(quitarCitas(texto)).toBe('Ya lo revisé, gracias.')
  })

  it('descarta el formato "On ... wrote:" de los clientes en inglés', () => {
    const texto = 'Thanks.\n\nOn Tue, Aug 5, 2026 at 3:14 PM Mesa de Control wrote:\n> Hello'
    expect(quitarCitas(texto)).toBe('Thanks.')
  })

  it('descarta las líneas que empiezan con >', () => {
    expect(quitarCitas('Mi respuesta\n> lo anterior\n> más citado')).toBe('Mi respuesta')
  })

  it('descarta la firma que empieza con -- ', () => {
    expect(quitarCitas('Saludos\n\n-- \nJuan Pérez\nAgencia X')).toBe('Saludos')
  })

  it('descarta el bloque de mensaje reenviado', () => {
    const texto = 'Te reenvío esto\n\n---------- Mensaje reenviado ----------\nDe: alguien'
    expect(quitarCitas(texto)).toBe('Te reenvío esto')
  })

  it('conserva el texto cuando no hay nada que cortar', () => {
    expect(quitarCitas('Solo mi mensaje')).toBe('Solo mi mensaje')
  })

  it('no se queda con la cadena vacía si el mensaje es solo una cita', () => {
    // Un correo que solo cita no tiene texto propio; devolver vacío es correcto
    // y la interfaz lo muestra como "(sin texto)".
    expect(quitarCitas('> solo cita')).toBe('')
  })
})

describe('limpiarCuerpo', () => {
  it('prefiere el texto plano cuando viene en el correo', () => {
    expect(limpiarCuerpo({ texto: 'Texto plano', html: '<p>HTML</p>' })).toBe('Texto plano')
  })

  it('cae al HTML convertido cuando no hay texto plano', () => {
    expect(limpiarCuerpo({ html: '<p>Solo HTML</p>' })).toBe('Solo HTML')
  })

  it('aplica el descarte de citas al resultado', () => {
    expect(limpiarCuerpo({ texto: 'Respuesta\n> citado' })).toBe('Respuesta')
  })

  it('devuelve vacío si no hay contenido de ningún tipo', () => {
    expect(limpiarCuerpo({})).toBe('')
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/correo/html-a-texto.test.ts`

- [ ] **Step 3: Implementar**

Crear `src/lib/correo/html-a-texto.ts`:

```ts
const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (todo, nombre) => ENTIDADES[nombre.toLowerCase()] ?? todo)
}

/**
 * El chat muestra texto plano: lo que la persona escribió, sin el HTML con el
 * que viajó. No se sanea para insertarlo como HTML en ningún momento, se
 * renderiza como texto.
 */
export function htmlATexto(html: string): string {
  if (!html) return ''
  return decodificarEntidades(
    html
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\/td>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const CORTES = [
  /^\s*El .+escribió:\s*$/im,
  /^\s*On .+wrote:\s*$/im,
  /^-{2,}\s*Mensaje reenviado\s*-{2,}/im,
  /^-{2,}\s*Forwarded message\s*-{2,}/im,
  /^\s*--\s*$/m,
  /^\s*De:\s.+$/im,
]

/** Deja solo lo que escribió la persona en este mensaje. */
export function quitarCitas(texto: string): string {
  let resultado = texto

  for (const corte of CORTES) {
    const m = resultado.match(corte)
    if (m?.index !== undefined) resultado = resultado.slice(0, m.index)
  }

  return resultado
    .split('\n')
    .filter((linea) => !linea.trimStart().startsWith('>'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function limpiarCuerpo(contenido: { html?: string; texto?: string }): string {
  const base = contenido.texto?.trim() ? contenido.texto : htmlATexto(contenido.html ?? '')
  return quitarCitas(base)
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm test src/lib/correo/html-a-texto.test.ts`
Expected: PASS, 19 pruebas.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: conversión del HTML de Gmail a texto plano sin citas"
```

---

## Task 3: Destinatarios y composición MIME

**Files:**
- Create: `src/lib/correo/destinatarios.ts`, `src/lib/correo/mime.ts`
- Test: `src/lib/correo/destinatarios.test.ts`, `src/lib/correo/mime.test.ts`

**Interfaces:**
- Produces:
  - `type Destinos = { para: string; cc: string[] }`
  - `resolverDestinos(caso: Pick<Caso, 'correoSolicitante' | 'camposExtra'>, correoEjecutivo: string | null, copiasExtra: string[]): Destinos`
  - `esCorreoValido(v: string): boolean`
  - `type Adjunto = { nombre: string; tipo: string; contenido: Uint8Array }`
  - `LIMITE_GMAIL_BYTES = 25 * 1024 * 1024`
  - `pesoCodificado(adjuntos: Adjunto[]): number`
  - `componerMime(mensaje: {...}): string` y `aBase64Url(mime: string): string`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `src/lib/correo/destinatarios.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { esCorreoValido, resolverDestinos } from './destinatarios'

const CASO = { correoSolicitante: 'comercial28@garantiplus.mx', camposExtra: [] }

describe('resolverDestinos', () => {
  it('el solicitante va en Para', () => {
    expect(resolverDestinos(CASO, null, []).para).toBe('comercial28@garantiplus.mx')
  })

  it('el ejecutivo comercial va en copia solo si difiere del solicitante', () => {
    expect(resolverDestinos(CASO, 'otro@garantiplus.mx', []).cc).toEqual(['otro@garantiplus.mx'])
    expect(resolverDestinos(CASO, 'comercial28@garantiplus.mx', []).cc).toEqual([])
  })

  it('ignora diferencias de mayúsculas y espacios al comparar', () => {
    expect(resolverDestinos(CASO, ' Comercial28@GarantiPlus.MX ', []).cc).toEqual([])
  })

  it('agrega las copias que pidió el usuario', () => {
    const d = resolverDestinos(CASO, null, ['keynor.rivas@gplusseguros.mx'])
    expect(d.cc).toEqual(['keynor.rivas@gplusseguros.mx'])
  })

  it('no repite una copia que ya estaba', () => {
    const d = resolverDestinos(CASO, 'otro@x.mx', ['otro@x.mx', 'otro@x.mx'])
    expect(d.cc).toEqual(['otro@x.mx'])
  })

  it('nunca pone al destinatario principal también en copia', () => {
    const d = resolverDestinos(CASO, null, ['comercial28@garantiplus.mx'])
    expect(d.cc).toEqual([])
  })

  it('descarta copias con formato inválido', () => {
    const d = resolverDestinos(CASO, null, ['no-es-correo', 'bien@x.mx'])
    expect(d.cc).toEqual(['bien@x.mx'])
  })

  it('lanza error si el caso no tiene correo de solicitante', () => {
    expect(() => resolverDestinos({ correoSolicitante: null, camposExtra: [] }, null, [])).toThrow(
      /no tiene correo/,
    )
  })
})

describe('esCorreoValido', () => {
  it('acepta correos normales', () => {
    expect(esCorreoValido('elsa.torres@clikautofinance.com')).toBe(true)
  })

  it('rechaza lo que no lo es', () => {
    expect(esCorreoValido('sin-arroba')).toBe(false)
    expect(esCorreoValido('doble@@x.mx')).toBe(false)
    expect(esCorreoValido('')).toBe(false)
    expect(esCorreoValido('con espacio@x.mx')).toBe(false)
  })
})
```

Crear `src/lib/correo/mime.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LIMITE_GMAIL_BYTES, aBase64Url, componerMime, pesoCodificado } from './mime'

const BASE = {
  de: 'Mesa de Control | Gplus Seguros <mesadecontrol@gplusseguros.mx>',
  para: 'comercial28@garantiplus.mx',
  cc: [] as string[],
  asunto: 'Seguimiento de Caso | Gplus Seguros | 7000',
  html: '<p>Buen día</p>',
  texto: 'Buen día',
  adjuntos: [],
}

describe('componerMime', () => {
  it('incluye las cabeceras básicas', () => {
    const mime = componerMime(BASE)
    expect(mime).toContain('From: Mesa de Control | Gplus Seguros <mesadecontrol@gplusseguros.mx>')
    expect(mime).toContain('To: comercial28@garantiplus.mx')
    expect(mime).toContain('MIME-Version: 1.0')
  })

  it('codifica el asunto en base64 para que los acentos no se rompan', () => {
    const mime = componerMime({ ...BASE, asunto: 'Cotización número 7000' })
    expect(mime).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/)
    expect(mime).not.toContain('Subject: Cotización')
  })

  it('omite la cabecera CC cuando no hay copias', () => {
    expect(componerMime(BASE)).not.toContain('Cc:')
  })

  it('junta las copias separadas por coma', () => {
    const mime = componerMime({ ...BASE, cc: ['a@x.mx', 'b@x.mx'] })
    expect(mime).toContain('Cc: a@x.mx, b@x.mx')
  })

  it('manda las dos alternativas, texto y HTML', () => {
    const mime = componerMime(BASE)
    expect(mime).toContain('multipart/alternative')
    expect(mime).toContain('Content-Type: text/plain; charset="UTF-8"')
    expect(mime).toContain('Content-Type: text/html; charset="UTF-8"')
  })

  it('usa multipart/mixed y codifica el adjunto en base64 cuando hay archivos', () => {
    const mime = componerMime({
      ...BASE,
      adjuntos: [
        { nombre: 'factura.pdf', tipo: 'application/pdf', contenido: new Uint8Array([1, 2, 3]) },
      ],
    })
    expect(mime).toContain('multipart/mixed')
    expect(mime).toContain('Content-Type: application/pdf; name="factura.pdf"')
    expect(mime).toContain('Content-Disposition: attachment; filename="factura.pdf"')
    expect(mime).toContain('Content-Transfer-Encoding: base64')
  })

  it('incluye In-Reply-To y References al responder, para que el cliente agrupe', () => {
    const mime = componerMime({ ...BASE, enRespuestaA: '<abc@mail.gmail.com>' })
    expect(mime).toContain('In-Reply-To: <abc@mail.gmail.com>')
    expect(mime).toContain('References: <abc@mail.gmail.com>')
  })

  it('escapa las comillas del nombre del archivo', () => {
    const mime = componerMime({
      ...BASE,
      adjuntos: [{ nombre: 'la "buena".pdf', tipo: 'application/pdf', contenido: new Uint8Array([1]) }],
    })
    expect(mime).not.toContain('filename="la "buena".pdf"')
  })
})

describe('pesoCodificado', () => {
  it('cuenta la sobrecarga de base64, que infla un tercio', () => {
    const peso = pesoCodificado([
      { nombre: 'a.bin', tipo: 'application/octet-stream', contenido: new Uint8Array(3 * 1024 * 1024) },
    ])
    expect(peso).toBeGreaterThan(3 * 1024 * 1024)
    expect(peso).toBeLessThan(5 * 1024 * 1024)
  })

  it('el límite declarado es el de Gmail', () => {
    expect(LIMITE_GMAIL_BYTES).toBe(25 * 1024 * 1024)
  })

  it('sin adjuntos el peso es cero', () => {
    expect(pesoCodificado([])).toBe(0)
  })
})

describe('aBase64Url', () => {
  it('produce base64url, sin +, / ni =', () => {
    const codificado = aBase64Url('cuerpo con acentós y símbolos +/=')
    expect(codificado).not.toMatch(/[+/=]/)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `pnpm test src/lib/correo/`

- [ ] **Step 3: Implementar destinatarios**

Crear `src/lib/correo/destinatarios.ts`:

```ts
import type { Caso } from '@/lib/casos/caso'

export type Destinos = { para: string; cc: string[] }

const FORMATO = /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/

export function esCorreoValido(v: string): boolean {
  return FORMATO.test(v.trim())
}

const normalizar = (v: string) => v.trim().toLowerCase()

/**
 * El destinatario principal es el solicitante y no se puede cambiar (RF-08). El
 * ejecutivo comercial entra en copia solo si es otra persona, para no mandarle
 * el mismo correo dos veces.
 */
export function resolverDestinos(
  caso: Pick<Caso, 'correoSolicitante'>,
  correoEjecutivo: string | null,
  copiasExtra: string[],
): Destinos {
  const para = caso.correoSolicitante?.trim()
  if (!para || !esCorreoValido(para)) {
    throw new Error('El caso no tiene correo de solicitante válido; no se puede escribir.')
  }

  const vistos = new Set([normalizar(para)])
  const cc: string[] = []

  for (const candidato of [correoEjecutivo, ...copiasExtra]) {
    const limpio = candidato?.trim()
    if (!limpio || !esCorreoValido(limpio)) continue
    if (vistos.has(normalizar(limpio))) continue
    vistos.add(normalizar(limpio))
    cc.push(limpio)
  }

  return { para: para.trim(), cc }
}
```

- [ ] **Step 4: Implementar el MIME**

Crear `src/lib/correo/mime.ts`:

```ts
export type AdjuntoSalida = { nombre: string; tipo: string; contenido: Uint8Array }

export const LIMITE_GMAIL_BYTES = 25 * 1024 * 1024

/** base64 infla los datos un tercio; el límite de Gmail aplica al correo codificado. */
export function pesoCodificado(adjuntos: AdjuntoSalida[]): number {
  return adjuntos.reduce((total, a) => total + Math.ceil(a.contenido.length / 3) * 4, 0)
}

/** Los acentos del asunto viajan codificados, o llegan como caracteres raros. */
function codificarAsunto(asunto: string): string {
  const necesita = /[^\x20-\x7E]/.test(asunto)
  if (!necesita) return asunto
  return `=?UTF-8?B?${Buffer.from(asunto, 'utf8').toString('base64')}?=`
}

const nombreSeguro = (nombre: string) => nombre.replace(/["\\\r\n]/g, '_')

function troncear(base64: string): string {
  return base64.replace(/(.{76})/g, '$1\r\n')
}

export function componerMime(mensaje: {
  de: string
  para: string
  cc: string[]
  asunto: string
  html: string
  texto: string
  adjuntos: AdjuntoSalida[]
  enRespuestaA?: string
}): string {
  const limiteAlt = `alt_${Math.abs(hashDe(mensaje.asunto)).toString(36)}`
  const limiteMix = `mix_${Math.abs(hashDe(mensaje.para)).toString(36)}`
  const hayAdjuntos = mensaje.adjuntos.length > 0

  const cabeceras = [
    `From: ${mensaje.de}`,
    `To: ${mensaje.para}`,
    ...(mensaje.cc.length ? [`Cc: ${mensaje.cc.join(', ')}`] : []),
    `Subject: ${codificarAsunto(mensaje.asunto)}`,
    'MIME-Version: 1.0',
    ...(mensaje.enRespuestaA
      ? [`In-Reply-To: ${mensaje.enRespuestaA}`, `References: ${mensaje.enRespuestaA}`]
      : []),
  ]

  const alternativa = [
    `Content-Type: multipart/alternative; boundary="${limiteAlt}"`,
    '',
    `--${limiteAlt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    mensaje.texto,
    '',
    `--${limiteAlt}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    mensaje.html,
    '',
    `--${limiteAlt}--`,
  ]

  if (!hayAdjuntos) return [...cabeceras, ...alternativa].join('\r\n')

  const partesAdjuntos = mensaje.adjuntos.flatMap((a) => [
    `--${limiteMix}`,
    `Content-Type: ${a.tipo}; name="${nombreSeguro(a.nombre)}"`,
    `Content-Disposition: attachment; filename="${nombreSeguro(a.nombre)}"`,
    'Content-Transfer-Encoding: base64',
    '',
    troncear(Buffer.from(a.contenido).toString('base64')),
    '',
  ])

  return [
    ...cabeceras,
    `Content-Type: multipart/mixed; boundary="${limiteMix}"`,
    '',
    `--${limiteMix}`,
    ...alternativa,
    '',
    ...partesAdjuntos,
    `--${limiteMix}--`,
  ].join('\r\n')
}

/** Hash estable para los boundaries; no necesita ser criptográfico. */
function hashDe(texto: string): number {
  let h = 0
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0
  return h
}

export function aBase64Url(mime: string): string {
  return Buffer.from(mime, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
```

- [ ] **Step 5: Ejecutar y verificar que pasan**

Run: `pnpm test src/lib/correo/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: resolución de destinatarios y composición MIME con adjuntos"
```

---

## Task 4: Plantillas y renderizado del correo

**Files:**
- Create: `src/lib/correo/render-correo.ts`, `src/lib/correo/plantillas.ts`
- Test: `src/lib/correo/render-correo.test.ts`

**Interfaces:**
- Produces:
  - `type Variables = { solicitante: string; folio: string; agencia: string; tramite: string; atiende: string }`
  - `sustituirVariables(plantilla: string, v: Variables): string`
  - `renderCorreo(cuerpoTexto: string, v: Variables): { html: string; texto: string }`
  - `leerPlantilla(tipoTramite: string | null)`, `guardarPlantilla(...)`, `sembrarPlantillas()`

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/correo/render-correo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { renderCorreo, sustituirVariables } from './render-correo'

const V = {
  solicitante: 'Ricardo Hernandez',
  folio: '7000',
  agencia: 'CHEVROLET CAMPESTRE',
  tramite: 'Emisión',
  atiende: 'Keynor Rivas',
}

describe('sustituirVariables', () => {
  it('reemplaza las variables de la plantilla', () => {
    expect(sustituirVariables('Buen día {{solicitante}}, caso {{folio}}', V)).toBe(
      'Buen día Ricardo Hernandez, caso 7000',
    )
  })

  it('reemplaza todas las apariciones de la misma variable', () => {
    expect(sustituirVariables('{{folio}} y {{folio}}', V)).toBe('7000 y 7000')
  })

  it('tolera espacios dentro de las llaves', () => {
    expect(sustituirVariables('Hola {{ solicitante }}', V)).toBe('Hola Ricardo Hernandez')
  })

  it('deja intacta una variable que no conoce, para que se note en la revisión', () => {
    expect(sustituirVariables('{{inexistente}}', V)).toBe('{{inexistente}}')
  })
})

describe('renderCorreo', () => {
  const cuerpo = 'Recibimos tu solicitud.\n\nNos falta la factura de la unidad.'

  it('el HTML incluye el encabezado del área', () => {
    const { html } = renderCorreo(cuerpo, V)
    expect(html).toContain('Mesa de Control')
    expect(html).toContain('Gplus Seguros')
  })

  it('el HTML firma con quien atiende y el buzón de la mesa', () => {
    const { html } = renderCorreo(cuerpo, V)
    expect(html).toContain('Keynor Rivas')
    expect(html).toContain('mesadecontrol@gplusseguros.mx')
  })

  it('convierte los párrafos del cuerpo en <p>', () => {
    const { html } = renderCorreo(cuerpo, V)
    expect(html).toContain('<p')
    expect(html).toContain('Recibimos tu solicitud.')
    expect(html).toContain('Nos falta la factura de la unidad.')
  })

  it('escapa el HTML que escriba el usuario, para no romper el correo', () => {
    const { html } = renderCorreo('Ojo con <script>alert(1)</script> esto', V)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('la alternativa de texto conserva el cuerpo y la firma sin etiquetas', () => {
    const { texto } = renderCorreo(cuerpo, V)
    expect(texto).toContain('Recibimos tu solicitud.')
    expect(texto).toContain('Atiende: Keynor Rivas')
    expect(texto).not.toContain('<')
  })

  it('usa estilos en línea, que es lo único que respetan los clientes de correo', () => {
    const { html } = renderCorreo(cuerpo, V)
    expect(html).toContain('style=')
    expect(html).not.toContain('<style>')
  })

  it('menciona el folio para que la agencia identifique el caso', () => {
    expect(renderCorreo(cuerpo, V).html).toContain('7000')
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm test src/lib/correo/render-correo.test.ts`

- [ ] **Step 3: Implementar el renderizado**

Crear `src/lib/correo/render-correo.ts`:

```ts
export type Variables = {
  solicitante: string
  folio: string
  agencia: string
  tramite: string
  atiende: string
}

export const CORREO_MESA = 'mesadecontrol@gplusseguros.mx'

export function sustituirVariables(plantilla: string, v: Variables): string {
  return plantilla.replace(/\{\{\s*(\w+)\s*\}\}/g, (todo, nombre: string) => {
    const valor = (v as Record<string, string>)[nombre]
    return valor === undefined ? todo : valor
  })
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Los clientes de correo ignoran las hojas de estilo, así que todo va en
 * línea. El diseño es deliberadamente sobrio: encabezado, cuerpo y firma.
 */
export function renderCorreo(cuerpoTexto: string, v: Variables): { html: string; texto: string } {
  const parrafos = cuerpoTexto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${escapar(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n      ')

  const html = `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f5f7f9">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7f9;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #e3e8ee;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
        <tr>
          <td style="background:#005ba9;padding:18px 24px;color:#ffffff">
            <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">Gplus Seguros</div>
            <div style="font-size:19px;font-weight:bold;margin-top:2px">Mesa de Control</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;font-size:16px">
      ${parrafos}
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #e3e8ee;padding:18px 24px;font-size:14px;color:#5a6572">
            <div style="font-weight:bold;color:#1f2933">Mesa de Control — Gplus Seguros</div>
            <div style="margin-top:4px">Atiende: ${escapar(v.atiende)}</div>
            <div style="margin-top:2px"><a href="mailto:${CORREO_MESA}" style="color:#005ba9;text-decoration:none">${CORREO_MESA}</a></div>
            <div style="margin-top:10px;font-size:12px;color:#8a94a1">Caso ${escapar(v.folio)}${v.tramite ? ` · ${escapar(v.tramite)}` : ''}</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const texto = [
    cuerpoTexto.trim(),
    '',
    '---',
    'Mesa de Control — Gplus Seguros',
    `Atiende: ${v.atiende}`,
    CORREO_MESA,
    `Caso ${v.folio}${v.tramite ? ` · ${v.tramite}` : ''}`,
  ].join('\n')

  return { html, texto }
}
```

- [ ] **Step 4: Implementar el acceso a plantillas**

Crear `src/lib/correo/plantillas.ts` con `leerPlantilla(tipoTramite)`, `listarPlantillas()`, `guardarPlantilla(tipoTramite, asunto, cuerpo, correoUsuario)` y `sembrarPlantillas()` sobre la tabla `plantillas_correo`. La siembra crea un borrador **general** y uno por cada tipo de trámite observado en la hoja (Cotización, Emisión, Endoso, Cancelaciones, Renovaciones, Reexpedición, Alta de versión, Alta de usuarios, Descarga de documentos, Homologación, Validación de versión, Devolución de primas no devengadas), todos con este texto base que Keynor corregirá:

```
Buen día {{solicitante}},

Recibimos tu solicitud de {{tramite}} con folio {{folio}} para {{agencia}}.

[Escribe aquí lo que necesitas o el estado del trámite]

Quedamos pendientes de tu respuesta para continuar.
```

- [ ] **Step 5: Ejecutar la suite y commit**

Run: `pnpm test && pnpm build`

```bash
git add -A && git commit -m "feat: plantillas de correo y renderizado HTML profesional"
```

---

## Task 5: Lectura del hilo de Gmail

**Files:**
- Create: `src/lib/google/gmail-thread.ts`
- Test: `src/lib/google/gmail-thread.test.ts`

**Interfaces:**
- Produces:
  - `type MensajeChat = { id: string; messageId: string | null; deLaMesa: boolean; autor: string; correoAutor: string; fechaIso: string; texto: string; adjuntos: { id: string; nombre: string; tipo: string; bytes: number }[] }`
  - `type Hilo = { threadId: string; mensajes: MensajeChat[] }`
  - `buscarHilo(deps, folio): Promise<string | null>` — por asunto exacto.
  - `leerHilo(deps, threadId): Promise<Hilo>`
  - `normalizarMensaje(mensajeGmail, correoMesa): MensajeChat` — función pura, es la que se prueba a fondo.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/lib/google/gmail-thread.test.ts` con un fixture de la estructura real que devuelve `users.messages.get` (payload con `mimeType: multipart/mixed`, partes anidadas `text/plain` y `text/html`, y una parte con `filename` y `body.attachmentId`), y las pruebas:

```ts
import { describe, expect, it, vi } from 'vitest'
import { buscarHilo, leerHilo, normalizarMensaje } from './gmail-thread'

const CORREO_MESA = 'mesadecontrol@gplusseguros.mx'

function b64(texto: string) {
  return Buffer.from(texto, 'utf8').toString('base64url')
}

const MENSAJE_DE_LA_MESA = {
  id: 'm1',
  internalDate: '1754425000000',
  payload: {
    mimeType: 'multipart/alternative',
    headers: [
      { name: 'From', value: 'Mesa de Control | Gplus Seguros <mesadecontrol@gplusseguros.mx>' },
      { name: 'Subject', value: 'Seguimiento de Caso | Gplus Seguros | 7000' },
      { name: 'Message-ID', value: '<abc@mail.gmail.com>' },
    ],
    parts: [
      { mimeType: 'text/plain', body: { data: b64('Buen día Ricardo') } },
      { mimeType: 'text/html', body: { data: b64('<p>Buen día Ricardo</p>') } },
    ],
  },
}

const RESPUESTA_CON_ADJUNTO = {
  id: 'm2',
  internalDate: '1754430000000',
  payload: {
    mimeType: 'multipart/mixed',
    headers: [
      { name: 'From', value: 'Ricardo Hernandez <comercial28@garantiplus.mx>' },
      { name: 'Subject', value: 'Re: Seguimiento de Caso | Gplus Seguros | 7000' },
    ],
    parts: [
      {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: b64('Adjunto la factura\n\nEl mar escribió:\n> Buen día') } },
        ],
      },
      {
        mimeType: 'application/pdf',
        filename: 'factura.pdf',
        body: { attachmentId: 'att1', size: 12345 },
      },
    ],
  },
}

describe('normalizarMensaje', () => {
  it('reconoce los mensajes que envió la mesa', () => {
    expect(normalizarMensaje(MENSAJE_DE_LA_MESA, CORREO_MESA).deLaMesa).toBe(true)
    expect(normalizarMensaje(RESPUESTA_CON_ADJUNTO, CORREO_MESA).deLaMesa).toBe(false)
  })

  it('extrae el nombre y el correo del autor', () => {
    const m = normalizarMensaje(RESPUESTA_CON_ADJUNTO, CORREO_MESA)
    expect(m.autor).toBe('Ricardo Hernandez')
    expect(m.correoAutor).toBe('comercial28@garantiplus.mx')
  })

  it('usa el correo como autor cuando no viene nombre', () => {
    const sinNombre = {
      ...RESPUESTA_CON_ADJUNTO,
      payload: {
        ...RESPUESTA_CON_ADJUNTO.payload,
        headers: [{ name: 'From', value: 'suelto@x.mx' }],
      },
    }
    expect(normalizarMensaje(sinNombre, CORREO_MESA).autor).toBe('suelto@x.mx')
  })

  it('devuelve la fecha como texto ISO, no como Date', () => {
    const m = normalizarMensaje(MENSAJE_DE_LA_MESA, CORREO_MESA)
    expect(typeof m.fechaIso).toBe('string')
    expect(m.fechaIso).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('prefiere el texto plano y le quita las citas', () => {
    expect(normalizarMensaje(RESPUESTA_CON_ADJUNTO, CORREO_MESA).texto).toBe('Adjunto la factura')
  })

  it('convierte el HTML cuando no hay texto plano', () => {
    const soloHtml = {
      ...MENSAJE_DE_LA_MESA,
      payload: {
        ...MENSAJE_DE_LA_MESA.payload,
        parts: [{ mimeType: 'text/html', body: { data: b64('<p>Solo <b>HTML</b></p>') } }],
      },
    }
    expect(normalizarMensaje(soloHtml, CORREO_MESA).texto).toBe('Solo HTML')
  })

  it('lista los adjuntos con nombre, tipo y tamaño', () => {
    const m = normalizarMensaje(RESPUESTA_CON_ADJUNTO, CORREO_MESA)
    expect(m.adjuntos).toEqual([
      { id: 'att1', nombre: 'factura.pdf', tipo: 'application/pdf', bytes: 12345 },
    ])
  })

  it('no confunde una parte de texto con un adjunto', () => {
    expect(normalizarMensaje(MENSAJE_DE_LA_MESA, CORREO_MESA).adjuntos).toEqual([])
  })

  it('recorre las partes anidadas para encontrar el cuerpo', () => {
    expect(normalizarMensaje(RESPUESTA_CON_ADJUNTO, CORREO_MESA).texto.length).toBeGreaterThan(0)
  })

  it('conserva el Message-ID para poder responder en el hilo', () => {
    expect(normalizarMensaje(MENSAJE_DE_LA_MESA, CORREO_MESA).messageId).toBe('<abc@mail.gmail.com>')
  })

  it('tolera un mensaje sin cuerpo sin lanzar', () => {
    const vacio = { id: 'm3', internalDate: '1754430000000', payload: { headers: [] } }
    expect(() => normalizarMensaje(vacio, CORREO_MESA)).not.toThrow()
    expect(normalizarMensaje(vacio, CORREO_MESA).texto).toBe('')
  })
})

describe('leerHilo', () => {
  it('ordena los mensajes del más antiguo al más reciente', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ id: 't1', messages: [RESPUESTA_CON_ADJUNTO, MENSAJE_DE_LA_MESA] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    ) as unknown as typeof globalThis.fetch
    const hilo = await leerHilo(
      { fetch: fetchMock, accessToken: 'ya29', correoMesa: CORREO_MESA },
      't1',
    )
    expect(hilo.mensajes.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('explica el 404 como hilo inexistente', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 }),
    ) as unknown as typeof globalThis.fetch
    await expect(
      leerHilo({ fetch: fetchMock, accessToken: 'ya29', correoMesa: CORREO_MESA }, 'inexistente'),
    ).rejects.toThrow(/no existe/)
  })
})

describe('buscarHilo', () => {
  it('busca por el asunto exacto del caso', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ threads: [{ id: 't9' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as unknown as typeof globalThis.fetch
    const id = await buscarHilo({ fetch: fetchMock, accessToken: 'ya29', correoMesa: CORREO_MESA }, '7000')
    expect(id).toBe('t9')
    const [url] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(decodeURIComponent(String(url))).toContain('subject:"Seguimiento de Caso | Gplus Seguros | 7000"')
  })

  it('devuelve null cuando no hay hilo todavía', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } }),
    ) as unknown as typeof globalThis.fetch
    expect(
      await buscarHilo({ fetch: fetchMock, accessToken: 'ya29', correoMesa: CORREO_MESA }, '7000'),
    ).toBeNull()
  })
})
```

- [ ] **Step 2 a 4: Ejecutar, implementar, verificar**

La implementación recorre `payload.parts` en profundidad buscando `text/plain` y `text/html`, trata como adjunto cualquier parte con `filename` y `body.attachmentId`, decodifica `base64url`, y aplica `limpiarCuerpo`. `buscarHilo` usa `users.threads.list?q=<consultaDeBusqueda(folio)>`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: lectura y normalización del hilo de Gmail"
```

---

## Task 6: Envío de correo

**Files:**
- Create: `src/lib/google/gmail-send.ts`
- Test: `src/lib/google/gmail-send.test.ts`

**Interfaces:**
- Produces:
  - `enviarCorreo(deps, mensaje, threadId?): Promise<{ id: string; threadId: string }>`
  - `class CorreoDemasiadoGrandeError extends Error`

- [ ] **Step 1: Pruebas**

Verifican que: el cuerpo se manda como `raw` en base64url; al responder se incluye `threadId` en el JSON e `In-Reply-To` en el MIME; se lanza `CorreoDemasiadoGrandeError` **antes** de llamar a Gmail si los adjuntos exceden 25 MB, con el tamaño en el mensaje; el 403 se traduce a un mensaje sobre permisos de envío; y un fallo de red no deja el estado a medias.

- [ ] **Step 2 a 5: Implementar contra `users.messages.send`, verificar, commit**

---

## Task 7: Panel de conversación

**Files:**
- Create: `src/app/caso/[fila]/conversacion.tsx`, `src/app/caso/[fila]/acciones-correo.ts`, `src/app/api/adjunto/[fila]/[mensaje]/[adjunto]/route.ts`
- Modify: `src/app/caso/[fila]/page.tsx`

**Interfaces:**
- Server Actions: `abrirConversacion(fila, cuerpo, copias, archivos)`, `responder(fila, cuerpo, copias, archivos)`, `refrescarHilo(fila)`.
- La ruta de adjuntos valida sesión, pide el adjunto a Gmail con la credencial de la mesa y lo entrega con `Content-Disposition: attachment`. No almacena nada.

Requisitos del panel:

- Si no hay hilo: botón **Abrir conversación**, con la plantilla del tipo de trámite precargada y editable, el destinatario visible pero no editable, y un campo para agregar copias.
- Si hay hilo: burbujas en orden cronológico, alineadas a la derecha las de la mesa y a la izquierda las del solicitante, con autor, hora y el texto plano. Los adjuntos como elementos descargables con nombre y tamaño.
- Campo de respuesta con adjuntar archivos, contador de tamaño y aviso al superar 25 MB.
- Botón de actualizar propio del panel.
- Si el caso tiene estatus terminal, aviso de que está cerrado y la respuesta sigue disponible.
- Al enviar el primer correo: guardar `threadId` en `casos_hilo`, sellar `KB` si estaba vacía, emitir `conversacion_iniciada` y registrar en bitácora las copias agregadas. En las respuestas, emitir `respuesta_enviada`.

- [ ] Steps: implementar, ejecutar suite y build, verificación manual, commit.

---

## Task 8: Administrador de plantillas

**Files:**
- Create: `src/app/ajustes/plantillas.tsx`
- Modify: `src/app/ajustes/page.tsx`

Lista de plantillas por tipo de trámite con edición del cuerpo, vista previa del HTML resultante con datos de ejemplo, y guardado que registra quién la cambió. Solo admin.

---

## Task 9: Verificación de punta a punta y despliegue

- [ ] **Step 1: Suite completa y build**
- [ ] **Step 2: Verificación manual, con aviso previo al solicitante** (el primer envío sale a un correo real):
  1. Abrir conversación de un caso de prueba **hacia una dirección propia**, no de una agencia.
  2. Comprobar que llega con el asunto normalizado, el diseño HTML y la firma.
  3. Responder desde el correo receptor adjuntando un archivo.
  4. Refrescar el panel: la respuesta aparece como texto plano, sin la cita, con el adjunto descargable.
  5. Descargar el adjunto desde la app.
  6. Responder desde la app con un archivo y confirmar que llega.
  7. Verificar que `KB` se sellló y que `casos_hilo` guardó el `threadId`.
- [ ] **Step 3: Desplegar y actualizar `docs/AVANCE.md`**

---

## Criterio de cierre de la Etapa 3

La etapa está terminada cuando, en producción: se abre la conversación de un caso desde la herramienta con asunto normalizado y destinatario tomado del formulario; el correo llega con diseño HTML y firma; la respuesta del solicitante aparece en el chat como texto plano sin citas; los adjuntos se descargan desde la app y se envían desde ella; `KB` se sella al primer envío; el vínculo caso↔hilo persiste; las plantillas se editan sin desplegar; y la suite pasa completa.

Al cerrar, se escribe el plan de la Etapa 4 (eventos de BI restantes, importación bajo demanda y paso a la hoja productiva).
