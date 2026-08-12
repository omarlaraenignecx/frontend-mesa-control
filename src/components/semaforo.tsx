import { semaforoDe, type NivelSemaforo } from '@/lib/casos/semaforo'
import { cn } from '@/lib/utils'

const RELLENO: Record<NivelSemaforo, string> = {
  verde: 'bg-emerald-500',
  ambar: 'bg-amber-500',
  rojo: 'bg-red-500',
  desconocido: 'bg-muted-foreground/50',
}

const TEXTO: Record<NivelSemaforo, string> = {
  verde: 'text-emerald-700 dark:text-emerald-400',
  ambar: 'text-amber-700 dark:text-amber-400',
  rojo: 'text-red-700 dark:text-red-400',
  desconocido: 'text-muted-foreground',
}

const SIN_ESTATUS = 'Sin estatus final'

/**
 * El punto del semáforo. Cuando la hoja no trae estatus final se dibuja hueco,
 * solo el contorno: es la señal de que el caso está pendiente de resolución.
 */
export function PuntoSemaforo({
  estatusFinal,
  className,
}: {
  estatusFinal: string | null
  className?: string
}) {
  const nivel = semaforoDe({ estatusFinal })
  return (
    <span
      title={estatusFinal?.trim() || SIN_ESTATUS}
      className={cn(
        'inline-block size-3 shrink-0 rounded-full',
        nivel ? RELLENO[nivel] : 'border-2 border-muted-foreground/50 bg-transparent',
        className,
      )}
    />
  )
}

/** El mismo punto con el estatus escrito al lado, para el encabezado del caso. */
export function EtiquetaSemaforo({ estatusFinal }: { estatusFinal: string | null }) {
  const nivel = semaforoDe({ estatusFinal })
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-base',
        nivel ? TEXTO[nivel] : 'text-muted-foreground',
      )}
    >
      <PuntoSemaforo estatusFinal={estatusFinal} className="size-2.5" />
      {estatusFinal?.trim() || SIN_ESTATUS}
    </span>
  )
}
