import { ESTATUS_POR_OMISION } from './cola'

/**
 * Estado de las casillas del filtro de estatus final.
 *
 * Vive aparte del componente porque la selección tiene una regla que no es obvia
 * al leer el JSX: la URL sin `?estatus=` no significa "sin filtro" sino "solo los
 * pendientes" (`ESTATUS_POR_OMISION`, ver `cola.ts`). El panel tiene que mostrar
 * eso marcado, o el área lee que no hay filtro cuando sí lo hay.
 */

/** Lo que el filtro está aplicando de verdad, que es lo que va marcado. */
export function seleccionVisible(seleccion: string[]): string[] {
  return seleccion.length ? seleccion : ESTATUS_POR_OMISION
}

/**
 * Marca o desmarca un estatus. Al desmarcar el último queda la lista vacía, que
 * es el filtro por omisión: nunca se llega a una tabla sin ninguna fila por no
 * tener estatus elegido.
 */
export function alternarEstatus(seleccion: string[], valor: string): string[] {
  const visible = seleccionVisible(seleccion)
  return visible.includes(valor)
    ? visible.filter((v) => v !== valor)
    : [...visible, valor]
}

export function todosSeleccionados(seleccion: string[], todos: string[]): boolean {
  if (todos.length === 0) return false
  const visible = new Set(seleccionVisible(seleccion))
  return todos.every((v) => visible.has(v))
}

/** "Seleccionar todos" y, en el segundo clic, de regreso a los pendientes. */
export function alternarTodos(seleccion: string[], todos: string[]): string[] {
  return todosSeleccionados(seleccion, todos) ? [] : [...todos]
}
