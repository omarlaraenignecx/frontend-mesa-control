import { describe, expect, it } from 'vitest'
import { resolverAcceso, type UsuarioAutorizado } from './allowlist'

const AUTORIZADOS: UsuarioAutorizado[] = [
  { correo: 'keynor.rivas@gplusseguros.mx', nombreEnHoja: 'Keynor', rol: 'operador', activo: true },
  { correo: 'mesadecontrol@gplusseguros.mx', nombreEnHoja: null, rol: 'admin', activo: true },
  { correo: 'norma.zacarias@gplusseguros.mx', nombreEnHoja: 'Norma', rol: 'operador', activo: false },
]

describe('resolverAcceso', () => {
  it('autoriza a un operador de la allowlist y expone su nombre en la hoja', () => {
    const r = resolverAcceso('keynor.rivas@gplusseguros.mx', AUTORIZADOS)
    expect(r).toEqual({
      autorizado: true,
      usuario: AUTORIZADOS[0],
    })
  })

  it('autoriza al administrador aunque no tenga nombre en la hoja', () => {
    const r = resolverAcceso('mesadecontrol@gplusseguros.mx', AUTORIZADOS)
    expect(r.autorizado).toBe(true)
    if (r.autorizado) expect(r.usuario.rol).toBe('admin')
  })

  it('rechaza una cuenta del dominio que no está en la allowlist', () => {
    expect(resolverAcceso('otra.persona@gplusseguros.mx', AUTORIZADOS)).toEqual({
      autorizado: false,
      motivo: 'fuera-de-allowlist',
    })
  })

  it('rechaza un correo de otro dominio aunque estuviera en la lista', () => {
    expect(resolverAcceso('keynor.rivas@gmail.com', AUTORIZADOS)).toEqual({
      autorizado: false,
      motivo: 'dominio-ajeno',
    })
  })

  it('rechaza a un usuario desactivado', () => {
    expect(resolverAcceso('norma.zacarias@gplusseguros.mx', AUTORIZADOS)).toEqual({
      autorizado: false,
      motivo: 'inactivo',
    })
  })

  it('rechaza cuando no hay correo', () => {
    expect(resolverAcceso(undefined, AUTORIZADOS)).toEqual({ autorizado: false, motivo: 'sin-correo' })
    expect(resolverAcceso('', AUTORIZADOS)).toEqual({ autorizado: false, motivo: 'sin-correo' })
  })

  it('ignora diferencias de mayúsculas y espacios en el correo recibido de Google', () => {
    const r = resolverAcceso('  Keynor.Rivas@GplusSeguros.MX ', AUTORIZADOS)
    expect(r.autorizado).toBe(true)
  })
})
