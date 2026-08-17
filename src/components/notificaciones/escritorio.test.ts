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

  it('localStorage va envuelto: lanza en ventanas privadas', () => {
    const veces = ESCRITORIO.match(/catch \{/g) ?? []
    expect(veces.length).toBeGreaterThanOrEqual(3)
    expect(ESCRITORIO).toContain('window.localStorage.getItem')
    expect(ESCRITORIO).toContain('window.localStorage.setItem')
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
