import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const AUTO = readFileSync(join(import.meta.dirname, 'auto-actualizar.tsx'), 'utf8')
const PAGINA = readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8')
const INSIGNIA = readFileSync(
  join(import.meta.dirname, '..', '..', 'components', 'notificaciones', 'insignia-correo.tsx'),
  'utf8',
)

/**
 * El orden se mide sobre el código y no sobre el archivo: los comentarios nombran
 * las mismas funciones para explicar por qué van en ese orden, y medir sobre ellos
 * da el resultado al revés.
 */
const soloCodigo = (fuente: string) =>
  fuente
    .split('\n')
    .filter((linea) => !/^\s*(\/\/|\*|\/\*)/.test(linea))
    .join('\n')

describe('auto-actualizar la fila', () => {
  it('reacciona a las peticiones nuevas, no a los correos', () => {
    expect(AUTO).toContain("tipo === 'caso_nuevo'")
  })

  it('invalida la caché antes de refrescar, o la tabla vuelve igual', () => {
    // `router.refresh()` sin invalidar reconstruye la página con la lectura
    // cacheada de la hoja: el caso nuevo no aparecería.
    const codigo = soloCodigo(AUTO)
    expect(codigo.indexOf('await actualizar()')).toBeLessThan(codigo.indexOf('router.refresh()'))
  })

  it('avisa en pantalla que la tabla se movió sola', () => {
    expect(AUTO).toMatch(/petici[oó]n/i)
    expect(AUTO).toContain('Entendido')
  })

  it('no dibuja nada mientras no llegue nada', () => {
    expect(AUTO).toContain('if (cuantas === 0) return null')
  })
})

describe('la acción de actualizar', () => {
  it('la comparten el botón y el refresco automático', () => {
    expect(PAGINA).toContain("import { actualizar } from './acciones'")
    expect(PAGINA).toContain('<BotonActualizar accion={actualizar} />')
    // Ya no se declara dentro de la página: un componente de cliente no puede
    // importar una acción definida dentro de otro componente.
    expect(PAGINA).not.toContain("async function actualizar()")
  })
})

describe('insignia de correo en la tabla', () => {
  it('no dibuja nada cuando el caso no tiene mensajes sin leer', () => {
    expect(INSIGNIA).toContain('if (cuantos === 0) return null')
  })

  it('es azul, trae el número y explica qué significa', () => {
    expect(INSIGNIA).toContain('bg-blue-600')
    expect(INSIGNIA).toContain('{cuantos}')
    expect(INSIGNIA).toContain('sr-only')
  })

  it('cuelga del borde izquierdo sin salirse del contenedor que recorta', () => {
    // La tabla vive en un `overflow-x-auto`: un desplazamiento negativo la
    // cortaría. Va pegada al filo, con el lado derecho redondeado.
    expect(INSIGNIA).toContain('left-0')
    expect(INSIGNIA).toContain('rounded-r-full')
    expect(INSIGNIA).not.toMatch(/-left-\d/)
  })

  it('la primera celda le hace lugar y es el ancla de posición', () => {
    expect(PAGINA).toContain('<TableCell className="relative pl-10">')
    expect(PAGINA).toContain('<InsigniaCorreo fila={caso.fila} />')
  })
})
