import { describe, expect, it } from 'vitest'
import {
  MARCA_MESA,
  avisoDeRespuesta,
  renderCorreo,
  sustituirVariables,
  variablesDelCaso,
} from './render-correo'

const V = {
  solicitante: 'Ricardo Hernandez',
  folio: '7000',
  agencia: 'CHEVROLET CAMPESTRE',
  tramite: 'Emisión',
  atiende: 'Keynor Rivas',
}

describe('sustituirVariables', () => {
  it('reemplaza las variables de la plantilla', () => {
    expect(sustituirVariables('Buen día {{solicitante}}, caso {{folio}}', V)).toBe(
      'Buen día Ricardo Hernandez, caso 7000',
    )
  })

  it('reemplaza todas las apariciones de la misma variable', () => {
    expect(sustituirVariables('{{folio}} y {{folio}}', V)).toBe('7000 y 7000')
  })

  it('tolera espacios dentro de las llaves', () => {
    expect(sustituirVariables('Hola {{ solicitante }}', V)).toBe('Hola Ricardo Hernandez')
  })

  it('deja intacta una variable que no conoce, para que se note en la revisión', () => {
    expect(sustituirVariables('{{inexistente}}', V)).toBe('{{inexistente}}')
  })

  it('no rompe una plantilla sin variables', () => {
    expect(sustituirVariables('Texto plano sin variables', V)).toBe('Texto plano sin variables')
  })
})

describe('renderCorreo', () => {
  const cuerpo = 'Recibimos tu solicitud.\n\nNos falta la factura de la unidad.'

  it('el HTML incluye el encabezado del área', () => {
    const { html } = renderCorreo(cuerpo, V)
    expect(html).toContain('Mesa de Control')
    expect(html).toContain('Gplus Seguros')
  })

  it('el HTML firma con quien atiende y el buzón de la mesa', () => {
    const { html } = renderCorreo(cuerpo, V)
    expect(html).toContain('Keynor Rivas')
    expect(html).toContain('mesadecontrol@gplusseguros.mx')
  })

  it('convierte los párrafos del cuerpo en <p>', () => {
    const { html } = renderCorreo(cuerpo, V)
    expect(html).toContain('<p')
    expect(html).toContain('Recibimos tu solicitud.')
    expect(html).toContain('Nos falta la factura de la unidad.')
  })

  it('convierte los saltos simples en <br> dentro del párrafo', () => {
    const { html } = renderCorreo('Línea uno\nLínea dos', V)
    expect(html).toContain('Línea uno<br>Línea dos')
  })

  it('escapa el HTML que escriba el usuario, para no romper el correo', () => {
    const { html } = renderCorreo('Ojo con <script>alert(1)</script> esto', V)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapa también el nombre de quien atiende', () => {
    const { html } = renderCorreo(cuerpo, { ...V, atiende: 'Ana <malicia>' })
    expect(html).not.toContain('<malicia>')
  })

  it('la alternativa de texto conserva el cuerpo y la firma sin etiquetas', () => {
    const { texto } = renderCorreo(cuerpo, V)
    expect(texto).toContain('Recibimos tu solicitud.')
    expect(texto).toContain('Atiende: Keynor Rivas')
    expect(texto).not.toContain('<')
  })

  it('usa estilos en línea, que es lo único que respetan los clientes de correo', () => {
    const { html } = renderCorreo(cuerpo, V)
    expect(html).toContain('style=')
    expect(html).not.toContain('<style>')
  })

  it('menciona el folio para que la agencia identifique el caso', () => {
    expect(renderCorreo(cuerpo, V).html).toContain('7000')
    expect(renderCorreo(cuerpo, V).texto).toContain('7000')
  })

  it('no deja el bloque del trámite cuando el caso no lo tiene', () => {
    const { texto } = renderCorreo(cuerpo, { ...V, tramite: '' })
    expect(texto).toContain('Caso 7000')
    expect(texto).not.toContain('Caso 7000 ·')
  })

  it('descarta los párrafos vacíos que deja el usuario al teclear', () => {
    const { html } = renderCorreo('Uno\n\n\n\nDos', V)
    expect(html.match(/<p /g)?.length).toBe(2)
  })
})

describe('avisoDeRespuesta', () => {
  it('pide responder al mismo correo y nombra el caso', () => {
    const aviso = avisoDeRespuesta('7000')
    expect(aviso.titulo).toBe('Responde en este mismo correo')
    expect(aviso.detalle).toContain('caso 7000')
    expect(aviso.detalle).toContain('Responder')
  })

  it('advierte lo que pasa si la agencia abre un correo nuevo', () => {
    expect(avisoDeRespuesta('7000').detalle).toContain('correo nuevo')
  })

  it('sin folio habla de la solicitud, no deja el número en blanco', () => {
    const aviso = avisoDeRespuesta('')
    expect(aviso.detalle).toContain('tu solicitud')
    expect(aviso.detalle).not.toContain('caso')
  })
})

describe('el aviso dentro del correo', () => {
  const cuerpo = 'Recibimos tu solicitud.'

  it('viaja en el HTML, resaltado y antes de la firma', () => {
    const { html } = renderCorreo(cuerpo, V)
    const aviso = avisoDeRespuesta(V.folio)
    expect(html).toContain(aviso.titulo)
    expect(html).toContain(aviso.detalle)
    expect(html.indexOf(aviso.titulo)).toBeLessThan(html.indexOf('Atiende:'))
    // Fondo distinto al del cuerpo: es una advertencia, tiene que verse.
    expect(html).toContain('#fff8e1')
  })

  it('viaja también en la alternativa de texto, que es la que ven algunos clientes', () => {
    const { texto } = renderCorreo(cuerpo, V)
    expect(texto).toContain(avisoDeRespuesta(V.folio).titulo)
    expect(texto).not.toContain('<')
  })

  it('queda después del cuerpo que escribió la mesa', () => {
    const { texto } = renderCorreo(cuerpo, V)
    expect(texto.indexOf('Recibimos tu solicitud.')).toBeLessThan(
      texto.indexOf(avisoDeRespuesta(V.folio).titulo),
    )
  })
})

describe('la marca del correo', () => {
  const v = {
    solicitante: 'Ana',
    folio: '7000',
    agencia: 'AGENCIA',
    tramite: 'Emisión',
    atiende: 'Keynor',
  }

  it('el correo de la mesa no cambió: misma banda, mismo pie', () => {
    // Son los correos que salen a diario a las agencias. Cualquier cambio aquí es un
    // cambio en lo que ven los clientes de la mesa.
    const { html, texto } = renderCorreo('Buen día', v)
    expect(html).toContain('background:#005ba9')
    expect(html).toContain('Mesa de Control')
    expect(html).toContain('Mesa de Control — Gplus Seguros')
    expect(html).toContain('Atiende: Keynor')
    expect(html).toContain('mesadecontrol@gplusseguros.mx')
    expect(texto).toContain('Atiende: Keynor')
    // Sin líneas de puesto ni teléfono: la mesa no las tiene.
    expect(html).not.toContain('TEL ')
  })

  it('el del ramo firma con la ficha del ejecutivo y no dice quién atiende', () => {
    // Del otro lado hay un cliente con un siniestro: quiere saber a quién le habla.
    const marca = {
      titulo: 'Atención a Siniestros',
      color: '#0f3d5c',
      firma: {
        nombre: 'Jose Juan Mendoza Diaz',
        puesto: 'Ejecutivo de siniestros',
        telefono: '55 4884 2862',
        correo: 'jose.mendoza@gplusseguros.mx',
      },
      muestraQuienAtiende: false,
    }
    const { html, texto } = renderCorreo('Buen día', v, marca)
    expect(html).toContain('background:#0f3d5c')
    expect(html).toContain('Atención a Siniestros')
    expect(html).toContain('Jose Juan Mendoza Diaz')
    expect(html).toContain('Ejecutivo de siniestros')
    expect(html).toContain('TEL 55 4884 2862')
    expect(html).toContain('jose.mendoza@gplusseguros.mx')
    // El «Atiende:» de la mesa sobraría: la firma ya dice quién lleva el caso.
    expect(html).not.toContain('Atiende:')
    expect(texto).not.toContain('Atiende:')
    expect(texto).toContain('TEL 55 4884 2862')
  })

  it('una firma sin teléfono no deja la línea a medias', () => {
    const marca = {
      titulo: 'Atención a Siniestros',
      color: '#0f3d5c',
      firma: { nombre: 'Norma Zacarías', puesto: null, telefono: null, correo: 'n@x.mx' },
      muestraQuienAtiende: false,
    }
    const { html } = renderCorreo('Buen día', v, marca)
    expect(html).not.toContain('TEL ')
    expect(html).toContain('Norma Zacarías')
  })

  it('el aviso de responder en el mismo correo va en las dos marcas', () => {
    // Es lo que mantiene la respuesta dentro del hilo del caso.
    for (const html of [renderCorreo('x', v).html, renderCorreo('x', v, MARCA_MESA).html]) {
      expect(html).toContain('Responde en este mismo correo')
    }
  })
})

describe('variablesDelCaso', () => {
  it('prefiere la aseguradora que registró el área a la que declaró el solicitante', () => {
    // La del seguimiento es la que de verdad está atendiendo el siniestro.
    const v = variablesDelCaso(
      { ...CASO_VACIO, aseguradoraSeguimiento: 'HDI', aseguradoraDeclarada: 'QUÁLITAS' },
      '6426',
      { nombreEnHoja: 'José Juan', correo: 'j@x.mx' },
    )
    expect(v.aseguradora).toBe('HDI')
  })

  it('cae a la declarada cuando el área todavía no registró ninguna', () => {
    const v = variablesDelCaso(
      { ...CASO_VACIO, aseguradoraSeguimiento: null, aseguradoraDeclarada: 'QUÁLITAS' },
      '6426',
      { nombreEnHoja: null, correo: 'j@x.mx' },
    )
    expect(v.aseguradora).toBe('QUÁLITAS')
    // Sin nombre en la hoja se firma con el correo: nunca queda en blanco.
    expect(v.atiende).toBe('j@x.mx')
  })
})

const CASO_VACIO = {
  nombreSolicitante: null,
  agencia: null,
  tipoTramite: null,
  nombreCliente: null,
  aseguradoraSeguimiento: null,
  aseguradoraDeclarada: null,
  numeroSiniestro: null,
  tipoSiniestro: null,
  poliza: null,
}
