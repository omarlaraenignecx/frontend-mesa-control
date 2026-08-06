import { requerirUsuario } from '@/lib/auth/guard'

export default async function Cola() {
  const usuario = await requerirUsuario()
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-xl font-semibold">Cola de casos</h1>
      <p className="text-sm text-neutral-500">
        Sesión de {usuario.correo} · rol {usuario.rol}
        {usuario.nombreEnHoja ? ` · atiende como ${usuario.nombreEnHoja}` : ''}
      </p>
      {usuario.rol === 'admin' && (
        <a href="/ajustes" className="inline-block text-sm underline">
          Ir a Ajustes
        </a>
      )}
    </main>
  )
}
