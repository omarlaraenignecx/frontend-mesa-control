import { timingSafeEqual } from 'node:crypto'

/**
 * Las rutas que llama n8n no tienen sesión de usuario: se autentican con un
 * secreto compartido en la cabecera `Authorization`.
 *
 * La comparación es de tiempo constante para no filtrar el secreto por la
 * duración de la respuesta, y sin secreto configurado la ruta queda **cerrada**:
 * un despliegue al que le falte la variable no debe quedar abierto al mundo.
 */
export function secretoValido(cabecera: string | null, esperado: string | undefined): boolean {
  if (!esperado) return false
  const recibido = (cabecera ?? '').replace(/^Bearer\s+/i, '').trim()
  const a = Buffer.from(recibido, 'utf8')
  const b = Buffer.from(esperado, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
