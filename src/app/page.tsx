import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export default async function Inicio() {
  const sesion = await auth()
  redirect(sesion ? '/fila' : '/login')
}
