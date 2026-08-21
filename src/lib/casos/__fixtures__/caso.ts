import type { Caso } from '../caso'

/**
 * Un caso completo para las pruebas, con todo lo que no se esté probando ya
 * puesto. Existe porque `Caso` tiene 28 campos y cada prueba solo le importan
 * dos o tres: sin esto, agregar un campo al caso obliga a editar cada archivo de
 * prueba que arme uno a mano —pasó al agregar el área el 20/8/2026, en tres
 * archivos con el mismo literal copiado—.
 *
 * Los valores por omisión son los de la petición real del folio 7000, para que
 * una prueba que falle se pueda comparar contra la hoja.
 */
export function casoDePrueba(parcial: Partial<Caso> = {}): Caso {
  return {
    fila: 7176,
    folio: '7000',
    marcaTemporalIso: new Date(2026, 7, 5, 15, 14, 58).toISOString(),
    marcaTemporalTexto: '5/8/2026 15:14:58',
    area: 'Mesa de control',
    tipoTramite: 'Emisión',
    tipoSiniestro: null,
    tipoAtencion: null,
    numeroSiniestro: null,
    poliza: null,
    tipoNegocio: 'EXTERNA',
    nombreSolicitante: 'Ricardo Hernandez',
    correoSolicitante: 'comercial28@garantiplus.mx',
    correoEjecutivo: null,
    agencia: 'CHEVROLET CAMPESTRE',
    motivo: 'aplicar el pago a la póliza',
    aseguradoraDeclarada: null,
    nombreCliente: null,
    estatusInicial: 'Atendida/en trámite',
    estatusFinal: 'Tramite',
    quienAtendio: 'Keynor',
    folioInterno: null,
    aseguradoraSeguimiento: 'LA LATINO',
    teniaPermisos: 'No',
    causaSeguimiento: 'Función de GPLUS',
    observaciones: 'SE ENVIAN DATOS DE APLICACION DE PAGO',
    fechaRespuestaCorreo: null,
    fechaAtencionFinal: null,
    adjuntos: [],
    camposExtra: [],
    ...parcial,
  }
}

/**
 * Una petición del ramo de siniestros: área `Siniestros`, la rama del formulario
 * llena y **sin** tipo de trámite, que es como llegan de verdad —0 de 268 traen
 * ese dato—.
 */
export function siniestroDePrueba(parcial: Partial<Caso> = {}): Caso {
  return casoDePrueba({
    fila: 7250,
    folio: '6426',
    area: 'Siniestros',
    tipoTramite: null,
    tipoSiniestro: 'Daño parcial',
    tipoAtencion: 'Seguimiento a siniestro',
    numeroSiniestro: '07-AUIN-205/2026',
    poliza: 'AUIN-020215-07',
    aseguradoraDeclarada: 'EL POTOSÍ',
    nombreCliente: 'MARTHA LOPEZ LARA',
    nombreSolicitante: 'JESUS PIMENTEL',
    correoSolicitante: 'jesus.pimentel@autocom.mx',
    quienAtendio: 'José Juan',
    ...parcial,
  })
}
