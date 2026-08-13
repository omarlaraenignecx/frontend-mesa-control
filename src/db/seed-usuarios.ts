import { getDb } from './index'
import { usuariosAutorizados } from './schema'

/** Allowlist de la Mesa de Control. El nombre debe coincidir con el catálogo de la columna KE. */
const USUARIOS = [
  { correo: 'keynor.rivas@gplusseguros.mx', nombreEnHoja: 'Keynor', rol: 'operador' as const, activo: true },
  { correo: 'patricia.ramirez@gplusseguros.mx', nombreEnHoja: 'Paty', rol: 'operador' as const, activo: true },
  { correo: 'norma.zacarias@gplusseguros.mx', nombreEnHoja: 'Norma', rol: 'operador' as const, activo: true },
  { correo: 'jose.mendoza@gplusseguros.mx', nombreEnHoja: 'José Juan', rol: 'operador' as const, activo: true },
  { correo: 'mesadecontrol@gplusseguros.mx', nombreEnHoja: null, rol: 'admin' as const, activo: true },
]

async function main() {
  const db = getDb()
  for (const u of USUARIOS) {
    await db
      .insert(usuariosAutorizados)
      .values(u)
      .onConflictDoUpdate({
        target: usuariosAutorizados.correo,
        set: { nombreEnHoja: u.nombreEnHoja, rol: u.rol, activo: u.activo },
      })
  }
  console.log(`Allowlist sembrada: ${USUARIOS.length} usuarios.`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
