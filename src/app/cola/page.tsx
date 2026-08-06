import { usuarioActual } from '@/lib/auth/usuarios'

export default async function Cola() {
  const usuario = await usuarioActual()
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Cola de casos</h1>
      <p className="text-sm text-neutral-500">
        Sesión de {usuario.correo} · rol {usuario.rol}
      </p>
    </main>
  )
}
