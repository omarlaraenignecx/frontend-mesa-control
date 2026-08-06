import { describe, expect, it } from 'vitest'
import { esUrlDrive, extraerAdjuntos } from './drive-links'

describe('esUrlDrive', () => {
  it('reconoce el formato que produce el formulario', () => {
    expect(esUrlDrive('https://drive.google.com/open?id=11eqHaUTW-S99z7eWxBY5gasO')).toBe(true)
  })

  it('reconoce los otros formatos de Drive', () => {
    expect(esUrlDrive('https://drive.google.com/file/d/1abcDEF/view?usp=sharing')).toBe(true)
    expect(esUrlDrive('https://docs.google.com/spreadsheets/d/1abcDEF/edit')).toBe(true)
  })

  it('no confunde texto suelto con un enlace', () => {
    expect(esUrlDrive('pendiente de enviar')).toBe(false)
    expect(esUrlDrive('')).toBe(false)
  })
})

describe('extraerAdjuntos', () => {
  it('convierte la celda en un adjunto con etiqueta y fileId', () => {
    const r = extraerAdjuntos(
      'Datos completos para emisión',
      'https://drive.google.com/open?id=11eqHaUTW-S99z7eWxBY5gasO',
    )
    expect(r).toEqual([
      {
        etiqueta: 'Datos completos para emisión',
        url: 'https://drive.google.com/open?id=11eqHaUTW-S99z7eWxBY5gasO',
        fileId: '11eqHaUTW-S99z7eWxBY5gasO',
      },
    ])
  })

  it('separa varias URLs en la misma celda, que es lo que pasa cuando suben varios archivos', () => {
    const celda =
      'https://drive.google.com/open?id=AAA, https://drive.google.com/open?id=BBB\nhttps://drive.google.com/open?id=CCC'
    const r = extraerAdjuntos('Requisitos', celda)
    expect(r.map((a) => a.fileId)).toEqual(['AAA', 'BBB', 'CCC'])
    expect(r.every((a) => a.etiqueta === 'Requisitos')).toBe(true)
  })

  it('extrae el fileId del formato /file/d/', () => {
    const r = extraerAdjuntos('Factura', 'https://drive.google.com/file/d/1XyZ/view?usp=sharing')
    expect(r[0].fileId).toBe('1XyZ')
  })

  it('devuelve lista vacía si la celda no trae enlaces', () => {
    expect(extraerAdjuntos('Factura', 'lo envía por WhatsApp')).toEqual([])
    expect(extraerAdjuntos('Factura', '')).toEqual([])
  })

  it('conserva el enlace aunque no pueda deducir el fileId, para no ocultar información', () => {
    const r = extraerAdjuntos('Otro', 'https://drive.google.com/drive/folders/xyz?usp=sharing')
    expect(r).toHaveLength(1)
    expect(r[0].url).toContain('drive.google.com')
  })
})
