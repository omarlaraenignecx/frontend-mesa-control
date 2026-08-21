'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { requerirUsuario } from '@/lib/auth/guard'
import { registrarCambios } from '@/lib/casos/bitacora'
import { claseDelCaso } from '@/lib/casos/caso'
import { fechaDeCierreASellar, seCierraAhora } from '@/lib/casos/cierre'
import { cargarCaso, depsDeGoogle } from '@/lib/casos/consulta'
import { emitirEvento } from '@/lib/casos/eventos'
import { componerObservaciones } from '@/lib/casos/observaciones'
import { calcularDiff, type Seguimiento } from '@/lib/casos/seguimiento'
import {
  FilaCambiadaError,
  SelloNoEscritoError,
  escribirSeguimiento,
} from '@/lib/google/sheet-writer'

export type ResultadoGuardado =
  | { ok: true; cambios: number; aviso?: string }
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

  let aviso: string | undefined
  try {
    await escribirSeguimiento(
      await depsDeGoogle(),
      mapa,
      fila,
      Object.fromEntries(cambios.map((c) => [c.campo, c.nuevo])),
      { marcaTemporalTexto: caso.marcaTemporalTexto, folio: caso.folio },
    )
  } catch (e) {
    // El sello es una falla parcial: los cambios sí quedaron en la hoja, así que
    // el guardado sigue su curso —bitácora, eventos y caché— y el aviso viaja
    // con el resultado. Reportarlo como error perdería el rastro de lo escrito.
    if (e instanceof SelloNoEscritoError) {
      aviso = e.message
    } else {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Error desconocido al guardar.',
        conflicto: e instanceof FilaCambiadaError,
      }
    }
  }

  await registrarCambios(fila, caso.folio, usuario.correo, cambios)
  await emitirEvento({
    tipo: 'caso_guardado',
    fila,
    folio: caso.folio,
    tipoTramite: claseDelCaso(caso),
    estatusResultante: valores.estatusFinal ?? caso.estatusFinal,
    correoUsuario: usuario.correo,
  })
  if (cerrandoAhora) {
    await emitirEvento({
      tipo: 'caso_cerrado',
      fila,
      folio: caso.folio,
      tipoTramite: claseDelCaso(caso),
      estatusResultante: valores.estatusFinal,
      correoUsuario: usuario.correo,
    })
  }

  updateTag('casos')
  revalidatePath(`/caso/${fila}`)
  return { ok: true, cambios: cambios.length, aviso }
}

/**
 * Marca el caso como atendido por quien pulsa el botón, escribiendo su nombre en
 * la columna "Quien Atendio" de la hoja.
 *
 * Los casos ya no se bloquean: cualquiera puede entrar y modificar cualquier
 * caso, y esta marca es lo que evita que dos personas trabajen lo mismo sin
 * saberlo. Que sea un dato de la hoja y no un candado interno tiene una ventaja:
 * el área lo ve desde la propia hoja, como siempre lo ha visto.
 */
export async function atenderYo(fila: number): Promise<ResultadoGuardado> {
  const usuario = await requerirUsuario()

  const nombre = usuario.nombreEnHoja?.trim()
  if (!nombre) {
    return {
      ok: false,
      error:
        'Tu cuenta no tiene nombre registrado en la columna de la hoja, así que no se puede marcar. Pídeselo al administrador o captúralo en el seguimiento.',
      conflicto: false,
    }
  }

  const cargado = await cargarCaso(fila)
  if (!cargado) {
    return { ok: false, error: 'El caso ya no existe en la hoja.', conflicto: false }
  }
  const { caso, mapa } = cargado

  if (caso.quienAtendio?.trim() === nombre) return { ok: true, cambios: 0 }

  try {
    await escribirSeguimiento(
      await depsDeGoogle(),
      mapa,
      fila,
      { quienAtendio: nombre },
      { marcaTemporalTexto: caso.marcaTemporalTexto, folio: caso.folio },
    )
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'No se pudo marcar el caso.',
      conflicto: e instanceof FilaCambiadaError,
    }
  }

  await registrarCambios(fila, caso.folio, usuario.correo, [
    {
      campo: 'quienAtendio',
      etiqueta: 'Quién atendió',
      anterior: caso.quienAtendio,
      nuevo: nombre,
    },
  ])
  await emitirEvento({
    tipo: 'caso_tomado',
    fila,
    folio: caso.folio,
    tipoTramite: claseDelCaso(caso),
    correoUsuario: usuario.correo,
  })

  updateTag('casos')
  revalidatePath(`/caso/${fila}`)
  return { ok: true, cambios: 1 }
}
