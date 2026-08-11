'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { requerirUsuario } from '@/lib/auth/guard'
import { registrarAccion } from '@/lib/casos/bitacora'
import { cargarCaso, depsDeGoogle } from '@/lib/casos/consulta'
import { emitirEvento } from '@/lib/casos/eventos'
import { depsGmail, guardarVinculo, leerVinculo } from '@/lib/casos/hilo'
import { componerAsunto } from '@/lib/correo/asunto'
import { resolverDestinos } from '@/lib/correo/destinatarios'
import type { AdjuntoSalida } from '@/lib/correo/mime'
import { renderCorreo } from '@/lib/correo/render-correo'
import { formatearFechaHoja } from '@/lib/fecha'
import { enviarCorreo } from '@/lib/google/gmail-send'
import { buscarHilo, leerHilo } from '@/lib/google/gmail-thread'
import { escribirSeguimiento } from '@/lib/google/sheet-writer'

export type ResultadoEnvio = { ok: true; threadId: string } | { ok: false; error: string }

async function archivosDeFormData(datos: FormData): Promise<AdjuntoSalida[]> {
  const archivos = datos.getAll('archivos').filter((a): a is File => a instanceof File && a.size > 0)
  return Promise.all(
    archivos.map(async (a) => ({
      nombre: a.name,
      tipo: a.type || 'application/octet-stream',
      contenido: new Uint8Array(await a.arrayBuffer()),
    })),
  )
}

function copiasDeFormData(datos: FormData): string[] {
  return String(datos.get('copias') ?? '')
    .split(/[,;\s]+/)
    .map((c) => c.trim())
    .filter(Boolean)
}

/**
 * Envía el correo del caso. La misma acción abre la conversación y responde: la
 * diferencia es si ya existe un hilo, y eso lo decide el estado, no el usuario.
 */
export async function enviarMensaje(fila: number, datos: FormData): Promise<ResultadoEnvio> {
  const usuario = await requerirUsuario()
  const cargado = await cargarCaso(fila)
  if (!cargado) return { ok: false, error: 'El caso ya no existe en la hoja.' }
  const { caso, mapa } = cargado

  const folio = caso.folio?.trim()
  if (!folio) {
    return { ok: false, error: 'Captura el folio del caso antes de escribirle a la agencia.' }
  }

  const cuerpo = String(datos.get('cuerpo') ?? '').trim()
  if (!cuerpo) return { ok: false, error: 'Escribe el mensaje antes de enviarlo.' }

  const copias = copiasDeFormData(datos)

  let destinos
  try {
    destinos = resolverDestinos(caso, caso.correoEjecutivo, copias)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Destinatario inválido.' }
  }

  const { html, texto } = renderCorreo(cuerpo, {
    solicitante: caso.nombreSolicitante ?? 'buen día',
    folio,
    agencia: caso.agencia ?? '',
    tramite: caso.tipoTramite ?? '',
    atiende: usuario.nombreEnHoja ?? usuario.correo,
  })

  const deps = await depsGmail()
  const vinculo = await leerVinculo(fila)
  const esPrimero = !vinculo

  // Al responder se apunta al último mensaje del hilo para que los clientes de
  // correo del solicitante lo agrupen igual que Gmail.
  let threadId: string | null = vinculo?.threadId ?? (await buscarHilo(deps, folio))
  let enRespuestaA: string | undefined
  if (threadId) {
    try {
      const hilo = await leerHilo(deps, threadId)
      enRespuestaA = hilo.mensajes.at(-1)?.messageId ?? undefined
    } catch {
      // Si el hilo no se puede leer, se envía como mensaje nuevo del mismo asunto.
      threadId = null
    }
  }

  let enviado
  try {
    enviado = await enviarCorreo(
      deps,
      {
        para: destinos.para,
        cc: destinos.cc,
        asunto: componerAsunto(folio),
        html,
        texto,
        adjuntos: await archivosDeFormData(datos),
        enRespuestaA,
      },
      threadId ?? undefined,
    )
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo enviar el correo.' }
  }

  await guardarVinculo(fila, enviado.threadId, folio)

  // El primer correo sella la fecha de respuesta que la mesa llenaba a mano.
  if (esPrimero && !caso.fechaRespuestaCorreo?.trim()) {
    try {
      await escribirSeguimiento(
        await depsDeGoogle(),
        mapa,
        fila,
        { fechaRespuestaCorreo: formatearFechaHoja(new Date()) },
        { marcaTemporalTexto: caso.marcaTemporalTexto, folio: caso.folio },
      )
      updateTag('casos')
    } catch (e) {
      // El correo ya salió: un fallo al sellar la fecha no se deshace, se anota.
      console.error('No se pudo sellar la fecha de respuesta por correo', e)
    }
  }

  if (destinos.cc.length > 0) {
    await registrarAccion(
      fila,
      caso.folio,
      usuario.correo,
      'Copias del correo',
      destinos.cc.join(', '),
      'guardado',
    )
  }

  await emitirEvento({
    tipo: esPrimero ? 'conversacion_iniciada' : 'respuesta_enviada',
    fila,
    folio: caso.folio,
    tipoTramite: caso.tipoTramite,
    estatusResultante: caso.estatusFinal,
    correoUsuario: usuario.correo,
  })

  revalidatePath(`/caso/${fila}`)
  return { ok: true, threadId: enviado.threadId }
}

export async function refrescarConversacion(fila: number): Promise<void> {
  await requerirUsuario()
  revalidatePath(`/caso/${fila}`)
}
