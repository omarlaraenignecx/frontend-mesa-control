import { getDb } from './index'
import { usuariosAutorizados } from './schema'

/**
 * Allowlist de la herramienta. El nombre debe coincidir con el catálogo de la columna
 * KE de la hoja.
 *
 * La lista es la única puerta: desde el 21 de agosto de 2026 no se exige además que el
 * correo sea del dominio de la empresa, para que quien desarrolla la herramienta entre
 * con su propia identidad en lugar de con la cuenta compartida de administrador.
 */
const USUARIOS = [
  { correo: 'keynor.rivas@gplusseguros.mx', nombreEnHoja: 'Keynor', rol: 'operador' as const, activo: true },
  { correo: 'patricia.ramirez@gplusseguros.mx', nombreEnHoja: 'Paty', rol: 'operador' as const, activo: true },
  { correo: 'norma.zacarias@gplusseguros.mx', nombreEnHoja: 'Norma', rol: 'operador' as const, activo: true },
  { correo: 'jose.mendoza@gplusseguros.mx', nombreEnHoja: 'José Juan', rol: 'operador' as const, activo: true },
  { correo: 'mesadecontrol@gplusseguros.mx', nombreEnHoja: null, rol: 'admin' as const, activo: true },
  // Externo: desarrollo y soporte de la herramienta. Sin nombre en la hoja porque no
  // atiende casos; si algún día atendiera uno, la columna KE se queda vacía a propósito.
  { correo: 'omar.lara@enginecx.com', nombreEnHoja: null, rol: 'admin' as const, activo: true },
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
