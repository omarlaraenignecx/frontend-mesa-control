'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { requerirUsuario } from '@/lib/auth/guard'
import { registrarAccion, registrarCambios } from '@/lib/casos/bitacora'
import { forzarBloqueo, latir, liberarBloqueo } from '@/lib/casos/bloqueo'
import { fechaDeCierreASellar, seCierraAhora } from '@/lib/casos/cierre'
import { cargarCaso, depsDeGoogle } from '@/lib/casos/consulta'
import { emitirEvento } from '@/lib/casos/eventos'
import { componerObservaciones } from '@/lib/casos/observaciones'
import { calcularDiff, type Seguimiento } from '@/lib/casos/seguimiento'
import { FilaCambiadaError, escribirFolio, escribirSeguimiento } from '@/lib/google/sheet-writer'

export type ResultadoGuardado =
  | { ok: true; cambios: number }
  | { ok: false; error: string; conflicto: boolean }

export async function guardarSeguimiento(
  fila: number,
  propuesto: Seguimiento,
  notaNueva: string,
): Promise<ResultadoGuardado> {
  const usuario = await requerirUsuario()
  const cargado = await cargarCaso(fila)
  if (!cargado) {
    return { ok: false, error: 'El caso ya no existe en la hoja.', conflicto: false }
  }
  const { caso, mapa } = cargado

  const valores: Seguimiento = { ...propuesto }
  const ahora = new Date()

  // Observaciones: acumulativo, nunca sobrescribe lo que ya escribió alguien.
  if (notaNueva.trim()) {
    valores.observaciones = componerObservaciones(
      caso.observaciones,
      notaNueva,
      usuario.nombreEnHoja ?? usuario.correo,
      ahora,
    )
  } else {
    delete valores.observaciones
  }

  // Sellado de la fecha de atención final al cerrar el caso.
  const cerrandoAhora = seCierraAhora(caso, valores.estatusFinal)
  const fechaCierre = fechaDeCierreASellar(caso, valores.estatusFinal, ahora)
  if (fechaCierre) valores.fechaAtencionFinal = fechaCierre

  const cambios = calcularDiff(caso, valores)
  if (cambios.length === 0) return { ok: true, cambios: 0 }

  try {
    await escribirSeguimiento(
      await depsDeGoogle(),
      mapa,
      fila,
      Object.fromEntries(cambios.map((c) => [c.campo, c.nuevo])),
      { marcaTemporalTexto: caso.marcaTemporalTexto, folio: caso.folio },
    )
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error desconocido al guardar.',
      conflicto: e instanceof FilaCambiadaError,
    }
  }

  await registrarCambios(fila, caso.folio, usuario.correo, cambios)
  await emitirEvento({
    tipo: 'caso_guardado',
    fila,
    folio: caso.folio,
    tipoTramite: caso.tipoTramite,
    estatusResultante: valores.estatusFinal ?? caso.estatusFinal,
    correoUsuario: usuario.correo,
  })
  if (cerrandoAhora) {
    await emitirEvento({
      tipo: 'caso_cerrado',
      fila,
      folio: caso.folio,
      tipoTramite: caso.tipoTramite,
      estatusResultante: valores.estatusFinal,
      correoUsuario: usuario.correo,
    })
  }

  updateTag('casos')
  revalidatePath(`/caso/${fila}`)
  return { ok: true, cambios: cambios.length }
}

export async function capturarFolio(fila: number, folio: string): Promise<ResultadoGuardado> {
  const usuario = await requerirUsuario()
  const cargado = await cargarCaso(fila)
  if (!cargado) {
    return { ok: false, error: 'El caso ya no existe en la hoja.', conflicto: false }
  }

  try {
    await escribirFolio(await depsDeGoogle(), cargado.mapa, fila, folio, {
      marcaTemporalTexto: cargado.caso.marcaTemporalTexto,
      folio: cargado.caso.folio,
    })
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al capturar el folio.',
      conflicto: e instanceof FilaCambiadaError,
    }
  }

  await registrarAccion(fila, folio, usuario.correo, 'Folio de atención', folio, 'folio_capturado')
  updateTag('casos')
  revalidatePath(`/caso/${fila}`)
  return { ok: true, cambios: 1 }
}

export async function liberar(fila: number): Promise<void> {
  const usuario = await requerirUsuario()
  await liberarBloqueo(fila, usuario.correo)
  revalidatePath(`/caso/${fila}`)
}

export async function forzar(fila: number): Promise<void> {
  const usuario = await requerirUsuario()
  const previo = await forzarBloqueo(fila)
  if (previo && previo !== usuario.correo) {
    await registrarAccion(
      fila,
      null,
      usuario.correo,
      'Bloqueo',
      `Liberación forzada; lo tenía ${previo}`,
      'bloqueo_forzado',
    )
  }
  revalidatePath(`/caso/${fila}`)
}

export async function mantenerBloqueo(fila: number): Promise<void> {
  const usuario = await requerirUsuario()
  await latir(fila, usuario.correo)
}
