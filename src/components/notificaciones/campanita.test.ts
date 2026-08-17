import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CAMPANITA = readFileSync(join(import.meta.dirname, 'campanita.tsx'), 'utf8')
const PANEL = readFileSync(join(import.meta.dirname, 'panel.tsx'), 'utf8')

describe('campanita', () => {
  it('el punto azul solo existe cuando hay algo sin leer', () => {
    expect(CAMPANITA).toContain('noLeidas.length > 0')
    expect(CAMPANITA).toMatch(/hay &&/)
  })

  it('el punto va en la esquina superior derecha del ícono, y es azul', () => {
    expect(CAMPANITA).toContain('-top-0.5')
    expect(CAMPANITA).toContain('-right-0.5')
    expect(CAMPANITA).toContain('bg-blue-600')
  })

  it('dice cuántas hay sin leer a quien usa lector de pantalla', () => {
    expect(CAMPANITA).toContain('aria-label')
    expect(CAMPANITA).toMatch(/sin leer/)
  })
})

describe('panel', () => {
  it('es una barra lateral sobrepuesta, no un desplegable', () => {
    expect(PANEL).toContain('fixed inset-0')
    expect(PANEL).toContain('justify-end')
    expect(PANEL).toContain('h-full')
  })

  it('se dibuja en un portal a document.body', () => {
    // La cabecera de la vista del caso lleva `backdrop-blur`, y un elemento con
    // `backdrop-filter` se vuelve el bloque contenedor de sus descendientes
    // `position: fixed`. Sin portal, `inset-0` mide contra esa barra y el panel
    // sale recortado a su altura: pasó el 17/8/2026.
    expect(PANEL).toContain('createPortal')
    expect(PANEL).toContain('document.body')
  })

  it('la cabecera del caso sigue teniendo el desenfoque que obliga al portal', () => {
    // Si algún día se le quita, el portal deja de ser necesario; mientras esté,
    // quitar el portal vuelve a romper el panel.
    const caso = readFileSync(
      join(import.meta.dirname, '..', '..', 'app', 'caso', '[fila]', 'page.tsx'),
      'utf8',
    )
    expect(caso).toContain('backdrop-blur')
  })

  it('cierra con Escape y con el fondo', () => {
    expect(PANEL).toContain("e.key === 'Escape'")
    expect(PANEL).toMatch(/onClick=\{cerrar\}/)
  })

  it('quita el escucha del teclado al cerrarse', () => {
    expect(PANEL).toContain('removeEventListener')
  })

  it('cada aviso lleva a su caso y se marca leído al entrar', () => {
    expect(PANEL).toContain('href={`/caso/${n.fila}`}')
    expect(PANEL).toContain('marcarLeidas([n.id])')
  })

  it('permite marcar todas de una vez', () => {
    expect(PANEL).toContain('marcarLeidas(noLeidas.map((n) => n.id))')
  })

  it('con la lista vacía explica que no hay nada, no deja el panel en blanco', () => {
    expect(PANEL).toContain('No hay notificaciones pendientes')
  })

  it('los enlaces no prefetchean: son tantos como avisos', () => {
    expect(PANEL).toContain('prefetch={false}')
  })
})
