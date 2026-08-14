import { describe, expect, it } from 'vitest'
import { SIN_ESTATUS } from './cola'
import {
  alternarEstatus,
  alternarTodos,
  seleccionVisible,
  todosSeleccionados,
} from './seleccion-estatus'

const TODOS = ['Concluida', 'Improcedente', 'Tramite', SIN_ESTATUS]

describe('seleccionVisible', () => {
  it('sin nada en la URL marca la casilla de pendientes, que es lo que se filtra', () => {
    expect(seleccionVisible([])).toEqual([SIN_ESTATUS])
  })

  it('respeta la selección explícita', () => {
    expect(seleccionVisible(['Tramite'])).toEqual(['Tramite'])
  })
})

describe('alternarEstatus', () => {
  it('agregar un estatus conserva los pendientes que ya estaban marcados', () => {
    expect(alternarEstatus([], 'Tramite')).toEqual([SIN_ESTATUS, 'Tramite'])
  })

  it('quita el estatus que ya estaba marcado', () => {
    expect(alternarEstatus([SIN_ESTATUS, 'Tramite'], 'Tramite')).toEqual([SIN_ESTATUS])
  })

  it('desmarcar pendientes deja el resto de la selección intacta', () => {
    expect(alternarEstatus([SIN_ESTATUS, 'Concluida'], SIN_ESTATUS)).toEqual(['Concluida'])
  })

  it('quedarse sin ninguna casilla vuelve a la vista de pendientes', () => {
    // Una selección vacía en la URL significa "solo los pendientes", así que
    // desmarcar la última casilla regresa ahí en lugar de dejar la tabla en blanco.
    expect(alternarEstatus([SIN_ESTATUS], SIN_ESTATUS)).toEqual([])
  })
})

describe('todosSeleccionados', () => {
  it('es verdadero solo cuando están todos los valores de la hoja', () => {
    expect(todosSeleccionados(TODOS, TODOS)).toBe(true)
    expect(todosSeleccionados(['Concluida', 'Tramite'], TODOS)).toBe(false)
    expect(todosSeleccionados([], TODOS)).toBe(false)
  })

  it('no se marca cuando la hoja todavía no trae estatus', () => {
    expect(todosSeleccionados([], [])).toBe(false)
  })
})

describe('alternarTodos', () => {
  it('marca todos los estatus de golpe', () => {
    expect(alternarTodos([], TODOS)).toEqual(TODOS)
  })

  it('vuelve a los pendientes cuando ya estaban todos marcados', () => {
    expect(alternarTodos(TODOS, TODOS)).toEqual([])
  })
})
