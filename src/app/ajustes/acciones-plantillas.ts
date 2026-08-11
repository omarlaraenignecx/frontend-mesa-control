'use server'

import { revalidatePath } from 'next/cache'
import { requerirAdmin } from '@/lib/auth/guard'
import { guardarPlantilla, sembrarPlantillas } from '@/lib/correo/plantillas'

export type ResultadoPlantilla = { ok: true } | { ok: false; error: string }

export async function guardarPlantillaAccion(
  tipoTramite: string,
  cuerpo: string,
): Promise<ResultadoPlantilla> {
  const usuario = await requerirAdmin()

  if (!cuerpo.trim()) {
    return { ok: false, error: 'La plantilla no puede quedar vacía.' }
  }

  try {
    await guardarPlantilla(tipoTramite, cuerpo, usuario.correo)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar la plantilla.' }
  }

  revalidatePath('/ajustes')
  return { ok: true }
}

export async function sembrarPlantillasAccion(): Promise<ResultadoPlantilla> {
  await requerirAdmin()
  try {
    await sembrarPlantillas()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudieron crear.' }
  }
  revalidatePath('/ajustes')
  return { ok: true }
}
