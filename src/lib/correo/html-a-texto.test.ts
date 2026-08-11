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
    const texto =
      'Ya lo revisé, gracias.\n\nEl mar, 5 ago 2026 a las 15:14, Mesa de Control escribió:\n> Buen día\n> Adjunto'
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

  it('no se queda con texto cuando el mensaje es solo una cita', () => {
    // Un correo que solo cita no tiene texto propio; la interfaz lo muestra
    // como "(sin texto)" en lugar de inventar contenido.
    expect(quitarCitas('> solo cita')).toBe('')
  })

  it('no corta un mensaje que casualmente menciona la palabra escribió', () => {
    const texto = 'El cliente escribió mal su RFC, hay que corregirlo'
    expect(quitarCitas(texto)).toBe(texto)
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
