import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CALLBACK = readFileSync(join(import.meta.dirname, 'route.ts'), 'utf8')
const AUTORIZAR = readFileSync(
  join(import.meta.dirname, '..', 'autorizar', 'route.ts'),
  'utf8',
)
const AJUSTES = readFileSync(
  join(import.meta.dirname, '..', '..', '..', 'siniestros', 'ajustes', 'page.tsx'),
  'utf8',
)

describe('pedir el consentimiento', () => {
  it('pide un permiso permanente, o no serviría para el siguiente correo', () => {
    expect(AUTORIZAR).toContain("'access_type', 'offline'")
    expect(AUTORIZAR).toContain("'prompt', 'consent'")
  })

  it('la puede abrir cualquier usuario autorizado, no solo el administrador', () => {
    // Cada quien concede su propia cuenta; pedir ser admin de la mesa para eso daría
    // permisos que no tienen que ver con el buzón.
    expect(AUTORIZAR).toContain('usuarioActual()')
    expect(AUTORIZAR).not.toContain("rol !== 'admin'")
  })

  it('sugiere la cuenta de la sesión, sin imponerla', () => {
    expect(AUTORIZAR).toContain("'login_hint', usuario.correo")
  })
})

describe('volver del consentimiento', () => {
  it('le pregunta a Google qué buzón se autorizó', () => {
    // La pantalla de Google deja cambiar de cuenta: guardar la de la sesión haría que
    // el módulo enviara desde un buzón atribuido a otra persona.
    expect(CALLBACK).toContain('users/me/profile')
    expect(CALLBACK).toContain('buzonAutorizado(')
  })

  it('guarda el buzón que Google reportó, no el de la sesión', () => {
    expect(CALLBACK).toContain('guardarCredencialSiniestros(\n    correo,')
    // El correo de la sesión se guarda aparte, como quién autorizó.
    expect(CALLBACK).toContain('usuario.correo,')
  })

  it('rechaza una cuenta de otro dominio', () => {
    expect(CALLBACK).toContain('DOMINIO_PERMITIDO')
    expect(CALLBACK).toContain("conError('dominio-ajeno')")
  })

  it('no guarda nada si Google no entregó el permiso permanente', () => {
    expect(CALLBACK).toContain("conError('sin-refresh-token')")
    const guardado = CALLBACK.indexOf('guardarCredencialSiniestros(')
    expect(CALLBACK.indexOf("conError('sin-refresh-token')")).toBeLessThan(guardado)
    expect(CALLBACK.indexOf("conError('sin-buzon')")).toBeLessThan(guardado)
  })

  it('la primera cuenta autorizada queda designada', () => {
    // Si no, el módulo tendría una credencial válida y seguiría diciendo que no hay.
    expect(CALLBACK).toContain('if ((await cuentaActiva()) === null) await activarCuenta(correo)')
  })

  it('deja una ficha mínima, para que la cuenta pueda firmar', () => {
    expect(CALLBACK).toContain('if (!(await leerFicha(correo)))')
  })
})

describe('la pantalla de ajustes del módulo', () => {
  it('no exige administrador', () => {
    expect(AJUSTES).toContain('requerirUsuario()')
    expect(AJUSTES).not.toContain('requerirAdmin()')
  })

  it('explica qué implica el permiso de leer el correo, antes del botón', () => {
    // Es la cuenta personal de trabajo de alguien: tiene que saberlo antes, no en un
    // pie de página.
    expect(AJUSTES).toMatch(/bandeja de entrada/)
    expect(AJUSTES.indexOf('bandeja de entrada')).toBeLessThan(
      AJUSTES.indexOf('/api/siniestros/autorizar'),
    )
  })

  it('avisa cuando el correo está saliendo por el buzón de la mesa', () => {
    expect(AJUSTES).toContain("estado.estado === 'provisional'")
    expect(AJUSTES).toMatch(/Provisionalmente, por el buz[oó]n de la mesa/)
  })

  it('quitar la cuenta de otra persona pide ser administrador', () => {
    const acciones = readFileSync(
      join(import.meta.dirname, '..', '..', '..', 'siniestros', 'ajustes', 'acciones.ts'),
      'utf8',
    )
    expect(acciones).toContain('Solo un administrador puede quitar la cuenta de otra persona.')
    expect(acciones).toContain('Solo puedes editar tu propia ficha.')
    expect(acciones).toContain('Solo un administrador puede cambiar el buzón del módulo.')
  })
})
