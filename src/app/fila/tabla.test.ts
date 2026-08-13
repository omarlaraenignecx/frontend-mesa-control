import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * La tabla no tiene pruebas de render —el proyecto no monta DOM—, pero el orden
 * de las columnas sí es un acuerdo con el área: el correo va pegado antes de la
 * agencia. Esta prueba lee el archivo y lo exige.
 */
const pagina = readFileSync(path.join(process.cwd(), 'src/app/fila/page.tsx'), 'utf8')

const encabezados = [...pagina.matchAll(/<TableHead[^>/]*>([^<]+)<\/TableHead>/g)].map((m) =>
  m[1].trim(),
)

describe('columnas de la tabla de la fila', () => {
  it('existe la columna del correo', () => {
    expect(encabezados).toContain('Correo')
  })

  it('el correo va justo antes de la agencia', () => {
    expect(encabezados.indexOf('Correo')).toBe(encabezados.indexOf('Agencia') - 1)
  })

  it('la celda muestra el correo del solicitante', () => {
    expect(pagina).toContain('caso.correoSolicitante')
  })

  it('la fila de "ningún caso" abarca todas las columnas', () => {
    // Cuenta también el <TableHead className="w-10" /> del semáforo, que va
    // autocerrado y por eso no aparece en `encabezados`. El delimitador del
    // final es indispensable: sin él, `<TableHeader>` entra en la cuenta.
    const total = [...pagina.matchAll(/<TableHead[\s/>]/g)].length
    expect(pagina).toContain(`colSpan={${total}}`)
  })
})
