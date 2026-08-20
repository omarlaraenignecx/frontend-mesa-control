import { redirect } from 'next/navigation'
import { PantallaDeCaso } from '@/components/casos/pantalla-de-caso'
import { esSiniestro } from '@/lib/casos/area'
import { cargarCaso } from '@/lib/casos/consulta'
import { MESA, SINIESTROS } from '@/lib/modulos/modulo'

export default async function CasoDeSiniestros({
  params,
}: {
  params: Promise<{ fila: string }>
}) {
  const { fila: filaTexto } = await params
  const fila = Number(filaTexto)

  // El espejo de la redirección de la mesa: un caso que no es del ramo no se atiende
  // aquí, o su respuesta saldría firmada por el ejecutivo de siniestros.
  if (Number.isInteger(fila) && fila >= 2) {
    const cargado = await cargarCaso(fila)
    if (cargado && !esSiniestro(cargado.caso)) redirect(MESA.rutaCaso(fila))
  }

  return <PantallaDeCaso modulo={SINIESTROS} filaTexto={filaTexto} />
}
