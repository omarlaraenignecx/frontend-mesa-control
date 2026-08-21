import { describe, expect, it } from 'vitest'
import { resolverAcceso, type UsuarioAutorizado } from './allowlist'

const AUTORIZADOS: UsuarioAutorizado[] = [
  { correo: 'keynor.rivas@gplusseguros.mx', nombreEnHoja: 'Keynor', rol: 'operador', activo: true },
  { correo: 'mesadecontrol@gplusseguros.mx', nombreEnHoja: null, rol: 'admin', activo: true },
  { correo: 'norma.zacarias@gplusseguros.mx', nombreEnHoja: 'Norma', rol: 'operador', activo: false },
  // Externo que desarrolla la herramienta: entra por estar en la lista, no por el dominio.
  { correo: 'omar.lara@enginecx.com', nombreEnHoja: 'Omar', rol: 'admin', activo: true },
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

  it('autoriza a alguien de otro dominio que sí está en la lista', () => {
    // La lista es la puerta. Antes había que ser además del dominio, y eso obligaba a
    // los externos a entrar con la cuenta compartida de administrador: peor control,
    // porque la bitácora atribuía a mesadecontrol@ lo que hacía una persona concreta.
    const r = resolverAcceso('omar.lara@enginecx.com', AUTORIZADOS)
    expect(r.autorizado).toBe(true)
    if (r.autorizado) expect(r.usuario.rol).toBe('admin')
  })

  it('rechaza un correo de otro dominio que no está en la lista', () => {
    // El dominio ya no decide si entra, solo qué mensaje ve quien no entró: a alguien
    // de fuera le sirve saber que se equivocó de cuenta.
    expect(resolverAcceso('keynor.rivas@gmail.com', AUTORIZADOS)).toEqual({
      autorizado: false,
      motivo: 'dominio-ajeno',
    })
  })

  it('estar en la lista no basta si la cuenta está desactivada, venga de donde venga', () => {
    const conExternoInactivo = AUTORIZADOS.map((u) =>
      u.correo === 'omar.lara@enginecx.com' ? { ...u, activo: false } : u,
    )
    expect(resolverAcceso('omar.lara@enginecx.com', conExternoInactivo)).toEqual({
      autorizado: false,
      motivo: 'inactivo',
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
