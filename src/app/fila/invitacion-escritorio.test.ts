import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const INVITACION = readFileSync(join(import.meta.dirname, 'invitacion-escritorio.tsx'), 'utf8')
const PAGINA = readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8')

describe('invitación a los avisos de escritorio', () => {
  it('la fila la muestra: es la pantalla que el área tiene abierta todo el día', () => {
    expect(PAGINA).toContain('<InvitacionEscritorio />')
  })

  it('solo aparece mientras el permiso está sin decidir', () => {
    // Concedido o bloqueado, del resto se encarga el panel de la campanita.
    expect(INVITACION).toContain("permiso !== 'preguntar'")
  })

  it('quien la descarta no la vuelve a ver', () => {
    expect(INVITACION).toContain('CLAVE_INVITACION')
    expect(INVITACION).toContain('guardarPreferencia(CLAVE_INVITACION, true)')
  })

  it('arranca oculta para no parpadear en cada carga', () => {
    expect(INVITACION).toContain('useState(true)')
    expect(INVITACION).toContain('queueMicrotask')
  })

  it('lee y guarda por el módulo de preferencias, que envuelve localStorage', () => {
    // Ahí está el `try`: `localStorage` lanza en ventanas privadas.
    expect(INVITACION).toContain("from '@/components/notificaciones/preferencias'")
    expect(INVITACION).not.toContain('window.localStorage')
  })
})
