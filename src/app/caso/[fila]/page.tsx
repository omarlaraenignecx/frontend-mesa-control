import { redirect } from 'next/navigation'
import { PantallaDeCaso } from '@/components/casos/pantalla-de-caso'
import { esSiniestro } from '@/lib/casos/area'
import { cargarCaso } from '@/lib/casos/consulta'
import { MESA, SINIESTROS } from '@/lib/modulos/modulo'

export default async function CasoDeLaMesa({ params }: { params: Promise<{ fila: string }> }) {
  const { fila: filaTexto } = await params
  const fila = Number(filaTexto)

  // La fila de la mesa sigue listando los casos de siniestros —lo pidió el área—, pero
  // atenderlos aquí haría que la respuesta saliera con la marca y la plantilla de la
  // mesa. Se ven desde la mesa; se atienden en su módulo.
  //
  // La lectura no se desperdicia: está cacheada con la etiqueta `casos` y la pantalla
  // vuelve a pedir el mismo caso un instante después, así que no cuesta una llamada
  // más a Google.
  if (Number.isInteger(fila) && fila >= 2) {
    const cargado = await cargarCaso(fila)
    if (cargado && esSiniestro(cargado.caso)) redirect(SINIESTROS.rutaCaso(fila))
  }

  return <PantallaDeCaso modulo={MESA} filaTexto={filaTexto} />
}
