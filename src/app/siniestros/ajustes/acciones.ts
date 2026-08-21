'use server'

import { revalidatePath } from 'next/cache'
import { requerirUsuario } from '@/lib/auth/guard'
import { normalizarCorreo } from '@/lib/auth/allowlist'
import { quitarCredencialSiniestros } from '@/lib/siniestros/credencial'
import {
  activarCuenta,
  guardarBuzonProvisional,
  guardarFicha,
  type Ficha,
} from '@/lib/siniestros/ejecutivos'

export type Resultado = { ok: true } | { ok: false; error: string }

const RUTA = '/siniestros/ajustes'

/**
 * Guarda la ficha con la que firma un ejecutivo.
 *
 * Cada quien edita la suya; un administrador puede editar cualquiera. La ficha es lo
 * que el cliente lee al final del correo, así que no la puede cambiar quien no sea su
 * dueño ni quien no responda por el módulo.
 */
export async function guardarFichaDeEjecutivo(datos: FormData): Promise<Resultado> {
  const usuario = await requerirUsuario()
  const correo = normalizarCorreo(String(datos.get('correo') ?? ''))
  if (!correo) return { ok: false, error: 'Falta el correo del ejecutivo.' }

  if (usuario.rol !== 'admin' && normalizarCorreo(usuario.correo) !== correo) {
    return { ok: false, error: 'Solo puedes editar tu propia ficha.' }
  }

  const ficha: Ficha = {
    correo,
    nombre: String(datos.get('nombre') ?? '').trim(),
    puesto: String(datos.get('puesto') ?? '').trim(),
    telefono: String(datos.get('telefono') ?? '').trim(),
  }
  if (!ficha.nombre) return { ok: false, error: 'El nombre no puede quedar vacío: es la firma.' }

  await guardarFicha(ficha, usuario.correo)
  revalidatePath(RUTA)
  return { ok: true }
}

/** Designa quién envía y firma. Lo puede hacer cualquier usuario autorizado. */
export async function designarCuenta(correo: string): Promise<Resultado> {
  await requerirUsuario()
  const limpio = normalizarCorreo(correo)
  if (!limpio) return { ok: false, error: 'Falta el correo.' }
  await activarCuenta(limpio)
  revalidatePath(RUTA)
  return { ok: true }
}

/**
 * Quita el consentimiento de un buzón. Solo su dueño o un administrador: retirar la
 * cuenta de otra persona deja al módulo sin correo de un momento a otro.
 */
export async function quitarCuenta(correo: string): Promise<Resultado> {
  const usuario = await requerirUsuario()
  const limpio = normalizarCorreo(correo)
  if (usuario.rol !== 'admin' && normalizarCorreo(usuario.correo) !== limpio) {
    return { ok: false, error: 'Solo un administrador puede quitar la cuenta de otra persona.' }
  }
  await quitarCredencialSiniestros(limpio)
  revalidatePath(RUTA)
  return { ok: true }
}

/**
 * Enciende o apaga el buzón provisional de la mesa.
 *
 * Solo el administrador. Encenderlo hace que los correos del ramo salgan de
 * `mesadecontrol@`, que es justo lo que el módulo existe para no hacer; es una
 * concesión para poder probar y no una preferencia de trabajo.
 */
export async function alternarBuzonProvisional(encendido: boolean): Promise<Resultado> {
  const usuario = await requerirUsuario()
  if (usuario.rol !== 'admin') {
    return { ok: false, error: 'Solo un administrador puede cambiar el buzón del módulo.' }
  }
  await guardarBuzonProvisional(encendido)
  revalidatePath(RUTA)
  return { ok: true }
}
