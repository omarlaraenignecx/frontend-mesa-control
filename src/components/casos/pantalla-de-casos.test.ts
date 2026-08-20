import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La tabla no tiene pruebas de render —el proyecto no monta DOM—, pero el orden
 * de las columnas sí es un acuerdo con el área: el correo va pegado antes de la
 * agencia. Esta prueba lee el archivo y lo exige.
 */
const archivo = readFileSync(
  path.join(process.cwd(), 'src/components/casos/pantalla-de-casos.tsx'),
  'utf8',
)

/**
 * Sin los comentarios. Aquí no es una precaución teórica: el comentario que
 * explica la cuenta de columnas nombra la etiqueta `<TableHead>`, y contarla daría
 * una columna de más.
 */
const pantalla = archivo
  .split('\n')
  .filter((linea) => !/^\s*(\/\/|\*|\/\*)/.test(linea))
  .join('\n')

const encabezados = [...pantalla.matchAll(/<TableHead[^>/]*>([^<]+)<\/TableHead>/g)].map((m) =>
  m[1].trim(),
)

describe('columnas de la tabla del listado', () => {
  it('existe la columna del correo', () => {
    expect(encabezados).toContain('Correo')
  })

  it('el correo va justo antes de la agencia', () => {
    expect(encabezados.indexOf('Correo')).toBe(encabezados.indexOf('Agencia') - 1)
  })

  it('la celda muestra el correo del solicitante', () => {
    expect(pantalla).toContain('caso.correoSolicitante')
  })

  it('la fila de "ningún caso" abarca todas las columnas, las del módulo incluidas', () => {
    // El colSpan no puede ser un número escrito: las columnas propias del módulo
    // se dibujan en un map y su cantidad solo se sabe al renderizar.
    expect(pantalla).toContain('colSpan={totalColumnas}')
    expect(pantalla).toContain(
      'const totalColumnas = COLUMNAS_COMUNES + modulo.columnasExtra.length',
    )
  })

  it('la cuenta de columnas comunes coincide con las que están escritas', () => {
    // Es lo que se rompe al agregar una columna y olvidar la constante. Se cuentan
    // los <TableHead> del archivo menos el que va dentro del map del módulo, e
    // incluye el autocerrado del semáforo, que no aparece en `encabezados`. El
    // delimitador final es indispensable: sin él, `<TableHeader>` entra en la cuenta.
    const escritos = [...pantalla.matchAll(/<TableHead[\s/>]/g)].length
    expect(pantalla).toContain(`const COLUMNAS_COMUNES = ${escritos - 1}`)
  })
})

describe('paso al otro módulo', () => {
  it('cada listado ofrece el otro, y con aspecto de botón', () => {
    // No es un enlace discreto a propósito: es la única puerta al otro módulo, y
    // quien no sabe que existe no la va a buscar entre los enlaces del encabezado.
    expect(pantalla).toContain('otrosModulos.map')
    expect(pantalla).toContain('bg-blue-600')
    expect(pantalla).toContain('font-bold')
  })

  it('sale de la lista de módulos, no está escrito para uno', () => {
    // Así la mesa ofrece siniestros y siniestros ofrece la mesa con el mismo código.
    expect(pantalla).toContain("MODULOS.filter((m) => m.clave !== modulo.clave)")
    expect(pantalla).toContain('{otro.titulo}')
  })
})
