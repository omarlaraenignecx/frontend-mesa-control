'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import type { Ficha } from '@/lib/siniestros/ejecutivos'
import {
  alternarBuzonProvisional,
  designarCuenta,
  guardarFichaDeEjecutivo,
  quitarCuenta,
  type Resultado,
} from './acciones'

function Aviso({ resultado }: { resultado: Resultado | null }) {
  if (!resultado) return null
  if (resultado.ok) return <span className="text-base text-emerald-600">Guardado.</span>
  return <span className="text-base text-red-600">{resultado.error}</span>
}

/**
 * La ficha con la que firma un ejecutivo. Es un formulario y no un texto fijo porque
 * es lo que el cliente lee al final del correo: el área lo corrige sin esperar un
 * despliegue.
 */
export function FormularioFicha({ ficha, editable }: { ficha: Ficha; editable: boolean }) {
  const [pendiente, iniciar] = useTransition()
  const [resultado, setResultado] = useState<Resultado | null>(null)

  return (
    <form
      action={(datos) =>
        iniciar(async () => {
          setResultado(await guardarFichaDeEjecutivo(datos))
        })
      }
      className="space-y-3"
    >
      <input type="hidden" name="correo" value={ficha.correo} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">Nombre</span>
          <Input name="nombre" defaultValue={ficha.nombre} disabled={!editable} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">Puesto</span>
          <Input name="puesto" defaultValue={ficha.puesto} disabled={!editable} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-muted-foreground">Teléfono</span>
          <Input name="telefono" defaultValue={ficha.telefono} disabled={!editable} />
        </label>
      </div>
      {editable ? (
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-lg bg-primary px-4 py-2.5 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pendiente ? 'Guardando…' : 'Guardar ficha'}
          </button>
          <Aviso resultado={resultado} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Solo su dueño —o un administrador— puede editar esta ficha.
        </p>
      )}
    </form>
  )
}

export function BotonDesignar({ correo }: { correo: string }) {
  const [pendiente, iniciar] = useTransition()
  const [resultado, setResultado] = useState<Resultado | null>(null)
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            setResultado(await designarCuenta(correo))
          })
        }
        className="text-base text-blue-600 underline underline-offset-4 hover:text-blue-700 disabled:opacity-60"
      >
        {pendiente ? 'Designando…' : 'Usar esta cuenta para enviar'}
      </button>
      <Aviso resultado={resultado} />
    </span>
  )
}

export function BotonQuitar({ correo }: { correo: string }) {
  const [pendiente, iniciar] = useTransition()
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-base text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Quitar esta cuenta
      </button>
    )
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-base">
        Al quitarla, el módulo se queda sin correo hasta que alguien vuelva a autorizar.
      </span>
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            setResultado(await quitarCuenta(correo))
            setConfirmando(false)
          })
        }
        className="rounded-lg bg-red-600 px-3.5 py-2 text-base font-medium text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pendiente ? 'Quitando…' : 'Quitar'}
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="text-base text-muted-foreground underline underline-offset-4"
      >
        Cancelar
      </button>
      <Aviso resultado={resultado} />
    </span>
  )
}

/**
 * El interruptor del buzón provisional.
 *
 * Va acompañado de su explicación completa y no de una etiqueta corta: quien lo
 * enciende tiene que saber que los correos del ramo empezarán a salir de
 * `mesadecontrol@`, que es exactamente lo que este módulo existe para no hacer.
 */
export function InterruptorProvisional({
  encendido,
  puede,
}: {
  encendido: boolean
  puede: boolean
}) {
  const [pendiente, iniciar] = useTransition()
  const [resultado, setResultado] = useState<Resultado | null>(null)

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-primary"
          checked={encendido}
          disabled={!puede || pendiente}
          onChange={(e) => {
            const nuevo = e.target.checked
            iniciar(async () => {
              setResultado(await alternarBuzonProvisional(nuevo))
            })
          }}
        />
        <span className="text-base">
          <span className="font-medium">
            Usar provisionalmente el buzón de la Mesa de Control
          </span>
          <span className="mt-1 block text-muted-foreground">
            Mientras nadie autorice la cuenta del ramo, los correos de siniestros saldrán de{' '}
            <strong>mesadecontrol@gplusseguros.mx</strong> y las respuestas llegarán a ese buzón,
            firmados con la ficha del ejecutivo designado. Sirve para probar el módulo; en cuanto
            se autorice la cuenta propia, esta se ignora y conviene apagarla.
          </span>
        </span>
      </label>
      {!puede && (
        <p className="text-sm text-muted-foreground">
          Solo un administrador puede cambiar el buzón del módulo.
        </p>
      )}
      <Aviso resultado={resultado} />
    </div>
  )
}
