import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Todo esto toca `window`, así que la suite —que corre sin DOM— revisa el archivo.
 * Lo que se cuida son las decisiones que no se ven leyendo el JSX y que, si se
 * pierden, dejan de llegar los avisos o rompen la página.
 */
const ESCRITORIO = readFileSync(join(import.meta.dirname, 'escritorio.ts'), 'utf8')
const EMISOR = readFileSync(join(import.meta.dirname, 'emisor-escritorio.tsx'), 'utf8')
const AJUSTE = readFileSync(join(import.meta.dirname, 'ajuste-escritorio.tsx'), 'utf8')
const PROVEEDOR = readFileSync(join(import.meta.dirname, 'proveedor.tsx'), 'utf8')
const PREFERENCIAS = readFileSync(join(import.meta.dirname, 'preferencias.ts'), 'utf8')
const TIMBRE = readFileSync(join(import.meta.dirname, 'timbre.ts'), 'utf8')
const PANEL = readFileSync(join(import.meta.dirname, 'panel.tsx'), 'utf8')

/** El código sin los comentarios, para que un comentario no haga pasar una prueba. */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('trato con la API Notification', () => {
  it('pregunta por el soporte antes de tocar el navegador', () => {
    // Sin esto, el render del servidor truena: `Notification` no existe en Node.
    expect(ESCRITORIO).toContain("'Notification' in window")
    expect(ESCRITORIO).toContain("typeof window !== 'undefined'")
  })

  it('el permiso se pide desde un gesto del usuario, nunca al montar', () => {
    // Chrome ignora `requestPermission()` sin interacción, y pedirlo al entrar es
    // de las cosas que más molestan de un sitio.
    const codigo = soloCodigo(ESCRITORIO)
    expect(codigo).toContain('Notification.requestPermission()')
    expect(codigo).toMatch(/const pedirPermiso = useCallback/)
    // La única llamada vive en el callback, no en el efecto de montaje.
    const efecto = codigo.slice(codigo.indexOf('useEffect('), codigo.indexOf('pedirPermiso'))
    expect(efecto).not.toContain('requestPermission')
  })

  it('el estado arranca sin soporte para que servidor y navegador coincidan', () => {
    expect(ESCRITORIO).toContain("useState<PermisoEscritorio>('sin-soporte')")
  })

  it('lee el navegador en microtarea y no en el cuerpo del efecto', () => {
    expect(ESCRITORIO).toContain('queueMicrotask')
  })

  it('el permiso concedido no basta: también cuenta la preferencia del usuario', () => {
    expect(ESCRITORIO).toContain("permisoActual() === 'concedido' && leerPreferencia(CLAVE_AVISOS")
  })

  it('el aviso se queda en pantalla hasta que alguien lo atienda', () => {
    // Un correo del asegurado no puede esfumarse en cinco segundos mientras el
    // usuario estaba en otra ventana.
    expect(ESCRITORIO).toContain('requireInteraction: true')
  })

  it('el clic trae la ventana al frente y luego navega', () => {
    expect(ESCRITORIO).toContain('window.focus()')
    expect(ESCRITORIO).toContain('alAbrir(aviso.destino)')
  })

  it('construir la notificación no puede tumbar la página', () => {
    const cuerpo = ESCRITORIO.slice(ESCRITORIO.indexOf('export function emitirAviso'))
    expect(cuerpo).toMatch(/try \{[\s\S]*?new Notification/)
  })

  it('el aviso de prueba también suena', () => {
    // Es el momento en que el usuario está atento y puede decir si le molesta, y es
    // además el clic que desbloquea el audio de la página.
    const prueba = ESCRITORIO.slice(ESCRITORIO.indexOf('export function emitirPrueba'))
    expect(prueba).toContain('tocarTimbre()')
  })

  it('al activar manda un aviso de prueba', () => {
    // El permiso puede estar concedido y el sistema silenciándolo igual (modo
    // concentración); sin la prueba el usuario creería que quedó listo.
    expect(ESCRITORIO).toContain('emitirPrueba')
    expect(soloCodigo(ESCRITORIO)).toMatch(/setEncendido\(true\)\s*\n\s*emitirPrueba\(\)/)
  })
})

describe('emisor', () => {
  it('se cuelga del mismo sondeo que la campanita', () => {
    expect(EMISOR).toContain('alLlegar')
    expect(EMISOR).toContain('avisosDeEscritorio')
  })

  it('consulta el permiso en el momento de emitir, no al montar', () => {
    // El usuario pudo conceder o revocar en medio, desde el panel o desde el
    // candado de la barra de direcciones.
    expect(soloCodigo(EMISOR)).toMatch(/alLlegar\(\(nuevas\) => \{\s*\n\s*if \(!avisosEncendidos\(\)\) return/)
  })

  it('no marca nada como leído: leer es abrir el caso', () => {
    expect(EMISOR).not.toContain('marcarLeidas')
  })

  it('va montado dentro del proveedor, no en cada página', () => {
    expect(PROVEEDOR).toContain('<EmisorEscritorio />')
  })
})

describe('ajuste en el panel', () => {
  it('el panel lo muestra', () => {
    expect(PANEL).toContain('<AjusteEscritorio />')
  })

  it('sin soporte no ofrece nada', () => {
    expect(AJUSTE).toContain("if (permiso === 'sin-soporte') return null")
  })

  it('con el permiso bloqueado dice dónde se desbloquea', () => {
    expect(AJUSTE).toContain("permiso === 'negado'")
    expect(AJUSTE).toMatch(/candado de la barra de direcciones/)
  })

  it('con el permiso dado se pueden apagar sin ir a la configuración del sitio', () => {
    expect(AJUSTE).toContain('alternar')
    expect(AJUSTE).toMatch(/Apagar/)
  })
})

describe('preferencias', () => {
  it('cada acceso a localStorage va envuelto: lanza en ventanas privadas', () => {
    const veces = PREFERENCIAS.match(/catch \{/g) ?? []
    expect(veces.length).toBeGreaterThanOrEqual(2)
    expect(PREFERENCIAS).toContain('window.localStorage.getItem')
    expect(PREFERENCIAS).toContain('window.localStorage.setItem')
  })

  it('sin valor guardado responde lo que pida quien pregunta', () => {
    expect(PREFERENCIAS).toContain('if (valor === null) return omision')
  })
})

describe('timbre', () => {
  it('se sintetiza y no trae un archivo de audio', () => {
    // La opción `sound` de la API Notification está deprecada y ningún navegador la
    // implementa, así que el sonido sale de la página de todos modos.
    expect(TIMBRE).toContain('createOscillator')
    expect(TIMBRE).not.toMatch(/new Audio\(/)
  })

  it('reusa un solo AudioContext', () => {
    // Los navegadores limitan cuántos se pueden abrir; uno por aviso los agota.
    expect(TIMBRE).toContain('contexto ??= new Constructor()')
  })

  it('espera a que el contexto esté corriendo antes de programar las notas', () => {
    // Con el contexto suspendido el reloj de audio está congelado: programar antes de
    // que reanude deja las rampas de ganancia en el pasado y el oscilador suena en
    // silencio. Es el defecto que enmudeció el timbre el 17/8/2026.
    expect(TIMBRE).toContain('await Promise.race([')
    expect(TIMBRE).toContain('ctx.resume(),')
    expect(TIMBRE).toMatch(/return \(ctx\.state as AudioContextState\) === 'running'/)
    expect(TIMBRE).toMatch(/asegurarActivo\(ctx\)\.then\(\(activo\) => \{\s*\n\s*if \(activo\) programarNotas\(ctx\)/)
  })

  it('respeta el interruptor antes de sonar', () => {
    const tocar = TIMBRE.slice(TIMBRE.indexOf('export function tocarTimbre'))
    expect(tocar).toMatch(/if \(!timbreEncendido\(\)\) return/)
  })

  it('sube y baja el volumen en lugar de cortar de golpe', () => {
    // Un seno que arranca y corta en seco chasquea en las bocinas.
    expect(TIMBRE).toContain('linearRampToValueAtTime')
    expect(TIMBRE).toContain('exponentialRampToValueAtTime')
  })

  it('un fallo de WebAudio no rompe la página', () => {
    expect(TIMBRE).toMatch(/try \{[\s\S]*?catch \{/)
  })

  it('suena una vez por tanda, no una por aviso', () => {
    const cuerpo = EMISOR.slice(EMISOR.indexOf('alLlegar('))
    expect(cuerpo.indexOf('tocarTimbre()')).toBeLessThan(cuerpo.indexOf('for (const aviso'))
    expect(cuerpo.match(/tocarTimbre\(\)/g)).toHaveLength(1)
  })

  it('cualquier gesto de la página desbloquea el audio, y se reintenta', () => {
    // Falla silenciosa que esto cierra: el contexto nace suspendido, así que quien
    // recargara y se fuera a otra ventana sin tocar nada perdía el timbre.
    expect(TIMBRE).toContain("document.addEventListener('pointerdown'")
    expect(TIMBRE).toContain("document.addEventListener('keydown'")
    expect(TIMBRE).toContain('removeEventListener')
    expect(EMISOR).toContain('useEffect(() => prepararTimbre(), [])')
  })

  it('sin `once`: un primer gesto que no baste no deja la página sin timbre', () => {
    const preparar = TIMBRE.slice(
      TIMBRE.indexOf('export function prepararTimbre'),
      TIMBRE.indexOf('export function audioBloqueado'),
    )
    expect(preparar).not.toContain('once: true')
    expect(preparar).toContain('if (listo) return')
  })

  it('no espera para siempre a que el navegador reanude', () => {
    // Chrome no rechaza `resume()` sin gesto del usuario: deja la promesa pendiente.
    // Sin límite, el timbre de un aviso sonaba siete minutos después, al primer clic.
    expect(TIMBRE).toContain('const ESPERA_ACTIVACION_MS = 2_000')
    expect(TIMBRE).toContain('Promise.race')
  })

  it('cuando llega un aviso sin sonido, la fila lo dice', () => {
    const auto = readFileSync(
      join(import.meta.dirname, '..', '..', 'app', 'fila', 'auto-actualizar.tsx'),
      'utf8',
    )
    expect(auto).toContain('if (audioBloqueado()) setSinTimbre(true)')
    expect(auto).toMatch(/El timbre no sonó/)
  })

  it('tiene su propio interruptor, aparte de los globos', () => {
    // Hay quien quiere ver los avisos y no oírlos: oficina compartida, llamadas.
    expect(AJUSTE).toContain('guardarTimbre')
    expect(AJUSTE).toContain('timbreEncendido()')
  })

  it('suena al encenderlo, que es la única forma de saber si el volumen alcanza', () => {
    expect(AJUSTE).toContain('if (siguiente) void probar()')
  })

  it('si el navegador no deja sonar, el panel lo dice en lugar de quedarse mudo', () => {
    expect(TIMBRE).toContain('export async function probarTimbre(): Promise<boolean>')
    expect(AJUSTE).toContain('setBloqueado(!(await probarTimbre()))')
    expect(AJUSTE).toMatch(/no dejó sonar el timbre/)
  })
})
