import { ListaCargando } from '@/components/casos/lista-cargando'
import { SINIESTROS } from '@/lib/modulos/modulo'

export default function Cargando() {
  return <ListaCargando titulo={SINIESTROS.titulo} />
}
