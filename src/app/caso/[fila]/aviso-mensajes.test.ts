import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FUENTE = readFileSync(join(import.meta.dirname, 'aviso-mensajes.tsx'), 'utf8')
const PAGINA = readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8')

describe('aviso de mensajes nuevos', () => {
  it('solo mira los correos de este caso', () => {
    expect(FUENTE).toContain("tipo === 'correo_recibido'")
    expect(FUENTE).toContain('n.fila === fila')
  })

  it('refresca el chat al llegar el mensaje, sin esperar al usuario', () => {
    expect(FUENTE).toContain('refrescarConversacion')
    expect(FUENTE).toContain('router.refresh()')
  })

  it('se marca leído a los segundos, y solo con la pestaña a la vista', () => {
    // Lo pidió el área: abrir el caso y verlo cuenta como leerlo. Con la pestaña
    // oculta no cuenta, o se marcaría leído lo que nadie miró.
    expect(FUENTE).toContain('ESPERA_LECTURA_MS')
    expect(FUENTE).toContain('document.hidden')
    expect(FUENTE).toContain('marcarLeidasDeFila')
  })

  it('cancela el temporizador si el caso se cierra antes', () => {
    expect(FUENTE).toContain('clearTimeout')
  })

  it('es azul y dice cuántos son, en singular y en plural', () => {
    expect(FUENTE).toContain('text-blue-700')
    expect(FUENTE).toContain("cuantos === 1 ? 'mensaje nuevo' : 'mensajes nuevos'")
  })

  it('no dibuja nada cuando no hay mensajes sin leer', () => {
    expect(FUENTE).toContain('if (cuantos === 0) return null')
  })

  it('va junto al título de la conversación', () => {
    const titulo = PAGINA.indexOf('Conversación')
    const aviso = PAGINA.indexOf('<AvisoMensajesNuevos fila={fila} />')
    expect(aviso).toBeGreaterThan(titulo)
    // Dentro del mismo encabezado: entre uno y otro no debe cerrarse el título.
    expect(PAGINA.slice(titulo, aviso)).not.toContain('</CardTitle>')
  })
})
