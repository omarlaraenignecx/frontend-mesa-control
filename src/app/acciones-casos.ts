'use server'

import { updateTag } from 'next/cache'
import { requerirUsuario } from '@/lib/auth/guard'

/**
 * Trae de la hoja lo que haya ahora mismo.
 *
 * `updateTag` y no `revalidateTag`: quien la llama quiere los datos frescos ya
 * —apretó Actualizar, o acaba de llegar una petición nueva—, no en la próxima
 * visita. La usan el botón y el refresco automático de la fila.
 *
 * Vive aquí y no dentro de `page.tsx` porque un componente de cliente no puede
 * importar una acción declarada dentro de otro componente.
 */
export async function actualizar(): Promise<void> {
  await requerirUsuario()
  updateTag('casos')
}
