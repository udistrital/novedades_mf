import { ACTA_ENDPOINT, toActaPayload } from './acta-payload.mapper';
import { NoveltyType } from '../../domain/models/novelty-type.enum';
import { Contract, NoveltySummary } from '../../domain/models/contract.entity';
import { NoveltyStatus } from '../../domain/models/novelty-type.enum';
import {
  AdicionProrrogaDraft,
  CesionDraft,
  ReinicioDraft,
  SuspensionDraft,
  TerminacionDraft
} from '../../domain/models/novelty-draft.model';

/** Contrato 653/2025, el de las trazas reales. */
function contrato(novelties: NoveltySummary[] = []): Contract {
  return {
    id: '653_2025',
    principalId: '16387',
    number: '653',
    contractType: 'Contrato de Prestación de Servicios',
    contractorName: 'CONTRATISTA UNO',
    contractorId: '52706308',
    contractorProviderId: '193',
    contractingEntity: 'UD',
    totalValue: 60_533_823,
    object: 'PRESTAR SUS SERVICIOS PROFESIONALES',
    initialTerm: 'TRESCIENTOS QUINCE ( 315 ) DIAS',
    executionUnitId: 205,
    executionTerm: 315,
    subscriptionDate: '06/02/2025',
    startDate: '07/02/2025',
    endDate: '21/12/2025',
    supervisor: 'CHISABA PEREIRA CRISTIAN ALEJANDRO',
    supervisorDocument: '1121906736',
    spendingManager: 'ORDENADOR UNO',
    spendingManagerDocument: '80038553',
    executingUnit: 1,
    novelties
  };
}

const solicitud = {
  fechaSolicitud: '2026-08-03',
  fechaExpedicionActa: '2026-08-03',
  numOficioSupervisor: '123',
  fechaOficioSupervisor: '2026-08-03',
  numOficioOrdenador: '321',
  fechaOficioOrdenador: '2026-08-03'
};

const sinClausula = { activa: false, posicion: null, texto: '' };

describe('ACTA_ENDPOINT', () => {
  it('cubre los cinco tipos de novedad que generan acta', () => {
    expect(Object.keys(ACTA_ENDPOINT).length).toBe(5);
    expect(ACTA_ENDPOINT[NoveltyType.SUSPENSION]).toBe('v1/actas/suspension');
    expect(ACTA_ENDPOINT[NoveltyType.EARLY_TERMINATION]).toBe('v1/actas/terminacion-liquidacion');
  });
});

describe('toActaPayload — bloque contrato (obligatorio en las cinco)', () => {
  const draft: SuspensionDraft = {
    type: NoveltyType.SUSPENSION,
    solicitud,
    periodoDias: 26,
    fechaInicio: '2025-02-10',
    fechaFin: '2025-03-05',
    fechaReinicio: '2025-03-06',
    motivo: 'Fuerza mayor',
    clausula: sinClausula
  };

  it('envía las fechas en ISO, no en dd/mm/yyyy', () => {
    const c = toActaPayload(contrato(), draft)['contrato'] as Record<string, unknown>;
    expect(c['fecha_inicio']).toBe('2025-02-07');
    // La suscripción es anterior al inicio: son fechas distintas.
    expect(c['fecha_suscripcion']).toBe('2025-02-06');
  });

  it('envía las tres personas con nombre y documento', () => {
    const c = toActaPayload(contrato(), draft)['contrato'] as Record<string, Record<string, string>>;
    expect(c['contratista']).toEqual({ nombre: 'CONTRATISTA UNO', documento: '52706308' });
    expect(c['supervisor']['documento']).toBe('1121906736');
    expect(c['ordenador']).toEqual({ nombre: 'ORDENADOR UNO', documento: '80038553' });
  });

  it('envía el valor y el plazo VIGENTES, no los iniciales', () => {
    const conAdicion = contrato([
      { id: '1', type: NoveltyType.ADDITION_EXTENSION, expeditionDate: '01/03/2025', status: NoveltyStatus.FINISHED, canAnnul: false, valorAdicion: 1_000_000, diasProrroga: 10 }
    ]);
    const c = toActaPayload(conAdicion, draft)['contrato'] as Record<string, unknown>;
    // El servicio valida el tope del 50 % contra este valor: tiene que ser el mismo
    // que usan los topes del formulario.
    expect(c['valor_contrato']).toBe(61_533_823);
    expect(c['plazo_dias']).toBe(325);
    expect(c['vigencia']).toBe(2025);
  });
});

describe('toActaPayload — por tipo', () => {
  it('suspensión NO envía fecha_reinicio: el servicio la calcula', () => {
    const draft: SuspensionDraft = {
      type: NoveltyType.SUSPENSION,
      solicitud,
      periodoDias: 26,
      fechaInicio: '2025-02-10',
      fechaFin: '2025-03-05',
      fechaReinicio: '2025-03-06',
      motivo: 'Fuerza mayor',
      clausula: sinClausula
    };
    const p = toActaPayload(contrato(), draft);
    expect(p['fecha_inicio_suspension']).toBe('2025-02-10');
    expect(p['motivo']).toBe('Fuerza mayor');
    expect('fecha_reinicio' in p).toBeFalse();
  });

  it('reinicio cita el acta de la suspensión que reanuda', () => {
    const suspension: NoveltySummary = {
      id: '10',
      type: NoveltyType.SUSPENSION,
      expeditionDate: '09/02/2025',
      status: NoveltyStatus.IN_EXECUTION,
      canAnnul: true,
      diasSuspension: 49
    };
    const draft: ReinicioDraft = {
      type: NoveltyType.RESTART,
      solicitud: { fechaSolicitud: '2026-08-03', fechaExpedicionActa: '2026-08-03' },
      fechaInicioSuspension: '2025-02-08',
      fechaFinSuspension: '2025-03-26',
      periodoDias: 49,
      fechaReinicio: '2025-03-27'
    };
    const previa = toActaPayload(contrato([suspension]), draft)['suspension_previa'] as Record<string, string>;
    expect(previa['fecha_acta']).toBe('2025-02-09');
    expect(previa['fecha_fin_suspension']).toBe('2025-03-26');
  });

  it('adición/prórroga manda el CDP dentro del contrato y el plazo nuevo en letras', () => {
    const draft: AdicionProrrogaDraft = {
      type: NoveltyType.ADDITION_EXTENSION,
      solicitud: { numSolicitud: '123', fechaSolicitud: '2026-08-03', numOficio: '321', fechaOficio: '2026-08-03', fechaActa: '2026-08-03' },
      adicion: { activa: true, numCdp: '1233', vigencia: '2025', valorAdicional: 1233, fechaAdicion: '2025-12-22' },
      prorroga: { activa: true, tiempoDias: 12, fechaProrroga: '2025-12-22' },
      clausula: sinClausula
    };
    const p = toActaPayload(contrato(), draft);
    const c = p['contrato'] as Record<string, unknown>;
    expect(c['cdp_numero']).toBe('1233');
    expect(c['cdp_vigencia']).toBe(2025);
    expect(p['prorroga_dias']).toBe(12);
    // 315 días + 12 = 327 → 10 meses y 27 días. El acta expresa todos los plazos en
    // meses y días, sea cual sea la unidad con que se pactó el contrato.
    expect(p['nuevo_plazo_contrato']).toBe('DIEZ ( 10 ) MESES Y VEINTISIETE ( 27 ) DÍAS');
  });


  it('conserva un CDP alfanumérico: es un identificador, no una cantidad', () => {
    // El campo fue `type="number"` y el navegador vaciaba "CDP-001" sin avisar,
    // así que el acta imprimía el CDP en blanco aunque el usuario lo hubiera puesto.
    const draft: AdicionProrrogaDraft = {
      type: NoveltyType.ADDITION_EXTENSION,
      solicitud: { numSolicitud: '123', fechaSolicitud: '2026-08-03', numOficio: '321', fechaOficio: '2026-08-03', fechaActa: '2026-08-03' },
      adicion: { activa: true, numCdp: 'CDP-001', vigencia: '2025', valorAdicional: 1233, fechaAdicion: '2025-12-22' },
      prorroga: { activa: true, tiempoDias: 12, fechaProrroga: '2025-12-22' },
      clausula: sinClausula
    };
    const c = toActaPayload(contrato(), draft)['contrato'] as Record<string, unknown>;
    expect(c['cdp_numero']).toBe('CDP-001');
  });

  const cesion: CesionDraft = {
    type: NoveltyType.ASSIGNMENT,
    solicitud,
    fechaSesion: '2025-12-21',
    fechaTerminacionCedente: '2025-12-20',
    valorDesembolsado: 20,
    valorFavorCedente: 10,
    diasFaltantes: 15,
    cedulaCesionario: '80038553',
    cesionario: { name: 'RAÚL EDUARDO GUTIERREZ MOLINA', documentNumber: '80038553', documentType: 'CÉDULA DE CIUDADANÍA' },
    considerando: { activo: true, posicion: 3, texto: 'Considerando extra' },
    clausula: { activa: true, posicion: 8, texto: 'Cláusula extra' }
  };

  it('cesión manda el nombre del cesionario, no solo su cédula', () => {
    const p = toActaPayload(contrato(), cesion);
    expect(p['cesionario']).toEqual({
      nombre: 'RAÚL EDUARDO GUTIERREZ MOLINA',
      documento: '80038553',
      tipo_documento: 'C.C.'
    });
    expect(p['dias_pago_cedente']).toBe('QUINCE ( 15 ) DÍAS');
    expect(p['nuevo_considerando']).toBe('Considerando extra');
    expect(p['nueva_clausula']).toBe('Cláusula extra');
  });

  it('cesión deriva los dos plazos, que el formulario no captura y el servicio exige', () => {
    const p = toActaPayload(contrato(), cesion);
    // Cedente: 07/02/2025 → 20/12/2025 con mes = 30 días y extremos incluidos = 314.
    expect(p['plazo_cedente']).toBe('DIEZ ( 10 ) MESES Y CATORCE ( 14 ) DÍAS');
    // Cesionario: 21/12/2025 → fin vigente del contrato (21/12/2025) = 1 día. Los
    // meses se imprimen aunque sean cero, para que el plazo se lea siempre igual.
    expect(p['plazo_cesionario']).toBe('CERO ( 0 ) MESES Y UN ( 1 ) DÍA');
    expect(p['fecha_solicitud']).toBe('2026-08-03');
  });

  it('cesión: el plazo del cesionario se cuenta desde la cesión hasta el fin del contrato', () => {
    // Es el dato que el acta imprime dos veces ("por un plazo de …"): en el estado
    // financiero y en la CLÁUSULA TERCERA. El contrato 653/2025 termina el 21/12/2025.
    const p = toActaPayload(contrato(), { ...cesion, fechaSesion: '2025-12-01' });
    expect(p['plazo_cesionario']).toBe('CERO ( 0 ) MESES Y VEINTIUNO ( 21 ) DÍAS');
  });

  it('cesión posterior al fin del contrato: el plazo del cesionario sale como marcador', () => {
    // Un plazo negativo no se imprime como cifra: el acta pone su `________`. Por eso
    // el formulario topa la fecha de cesión al fin vigente del contrato.
    const p = toActaPayload(contrato(), { ...cesion, fechaSesion: '2026-08-28' });
    expect(p['plazo_cesionario']).toBe('________');
  });

  it('cesión manda el marcador del acta cuando no hay días de pago al cedente', () => {
    // El campo del formulario es opcional pero el del servicio es obligatorio: sin
    // dato va "________", no una cifra inventada ni un 422.
    const p = toActaPayload(contrato(), { ...cesion, diasFaltantes: null });
    expect(p['dias_pago_cedente']).toBe('________');
  });

  it('terminación manda los tres saldos tal como se digitaron', () => {
    const draft: TerminacionDraft = {
      type: NoveltyType.EARLY_TERMINATION,
      solicitud,
      fechaTerminacion: '2025-12-20',
      fechaCertificacion: '2025-12-19',
      valorDesembolsado: 60_000_000,
      saldoFavorContratista: 533_823,
      saldoFavorUniversidad: 0,
      clausula: sinClausula
    };
    const p = toActaPayload(contrato(), draft);
    expect(p['valor_desembolsado']).toBe(60_000_000);
    expect(p['saldo_contratista']).toBe(533_823);
    expect(p['saldo_universidad']).toBe(0);
    expect(p['fecha_certificacion']).toBe('2025-12-19');
    // Los efectos legales arrancan al día siguiente de la terminación.
    expect(p['fecha_efectos_legales']).toBe('2025-12-21');
  });

  it('omite la cláusula adicional cuando no está activa', () => {
    const draft: TerminacionDraft = {
      type: NoveltyType.EARLY_TERMINATION,
      solicitud,
      fechaTerminacion: '2025-12-20',
      fechaCertificacion: '2025-12-19',
      valorDesembolsado: 1,
      saldoFavorContratista: 0,
      saldoFavorUniversidad: 0,
      clausula: { activa: false, posicion: 3, texto: 'no se envía' }
    };
    expect('nueva_clausula' in toActaPayload(contrato(), draft)).toBeFalse();
  });
});

/**
 * El acta imprime la calidad ("Director") en tres sitios del ordenador y en la
 * firma. Sin `rol` salen como `________`, que es lo que pasaba antes del
 * 2026-08-24: el dato existe en el backend y no se estaba enviando.
 */
describe('toActaPayload — rol de las personas', () => {
  const draft: SuspensionDraft = {
    type: NoveltyType.SUSPENSION,
    solicitud,
    fechaInicio: '2025-02-10',
    fechaFin: '2025-03-05',
    fechaReinicio: '2025-03-06',
    periodoDias: 26,
    motivo: 'x',
    clausula: sinClausula
  };

  it('envía el rol del ordenador y del supervisor cuando se conocen', () => {
    const c = { ...contrato(), spendingManagerRole: 'Director', supervisorRole: 'JEFE DE SECCIÓN' };
    const bloque = toActaPayload(c, draft)['contrato'] as Record<string, Record<string, unknown>>;
    expect(bloque['ordenador']['rol']).toBe('Director');
    expect(bloque['supervisor']['rol']).toBe('JEFE DE SECCIÓN');
  });

  it('omite `rol` cuando no se conoce, en vez de mandarlo vacío', () => {
    const bloque = toActaPayload(contrato(), draft)['contrato'] as Record<string, Record<string, unknown>>;
    // Ausente, no ''. El servicio imprime entonces su propio marcador.
    expect('rol' in bloque['ordenador']).toBeFalse();
    expect('rol' in bloque['supervisor']).toBeFalse();
  });
});

/**
 * Campos que el acta imprime pero no salen del contrato ni de la solicitud: el
 * cuadro de firmas y el tamaño de letra. Son opcionales en los cinco endpoints,
 * así que lo que no se conoce se OMITE — mandarlo vacío sustituiría el marcador
 * `________` del servicio por una cadena en blanco.
 */
describe('toActaPayload — opciones del documento', () => {
  const draft: SuspensionDraft = {
    type: NoveltyType.SUSPENSION,
    solicitud,
    fechaInicio: '2025-02-10',
    fechaFin: '2025-03-05',
    fechaReinicio: '2025-03-06',
    periodoDias: 26,
    motivo: 'x',
    clausula: sinClausula
  };

  it('envía firmantes y tamaño de letra cuando se conocen', () => {
    const p = toActaPayload(contrato(), draft, {
      elaboro: 'Laura Niño',
      jefeJuridica: 'Ana Torres',
      tamanoLetra: 14
    });
    expect(p['elaboro']).toBe('Laura Niño');
    expect(p['jefe_juridica_nombre']).toBe('Ana Torres');
    expect(p['tamano_letra']).toBe(14);
  });

  it('omite lo que no se conoce en vez de mandarlo vacío', () => {
    const p = toActaPayload(contrato(), draft, { elaboro: '', jefeJuridica: '' });
    expect('elaboro' in p).toBeFalse();
    expect('jefe_juridica_nombre' in p).toBeFalse();
    expect('tamano_letra' in p).toBeFalse();
  });

  it('imprime el CDP y el CRP que trajo la financiera', () => {
    const c = toActaPayload(contrato(), draft, { cdp: '4097', rp: '11238' })['contrato'] as Record<string, unknown>;
    expect(c['cdp_numero']).toBe('4097');
    expect(c['rp_numero']).toBe('11238');
  });

  it('omite el CDP y el CRP cuando la financiera no los devolvió', () => {
    const c = toActaPayload(contrato(), draft, { cdp: '', rp: '' })['contrato'] as Record<string, unknown>;
    expect('cdp_numero' in c).toBeFalse();
    expect('rp_numero' in c).toBeFalse();
  });

  it('en adición y prórroga el CDP digitado manda sobre el de la financiera', () => {
    const adicion: AdicionProrrogaDraft = {
      type: NoveltyType.ADDITION_EXTENSION,
      solicitud: { numSolicitud: '123', fechaSolicitud: '2026-08-03', numOficio: '321', fechaOficio: '2026-08-03', fechaActa: '2026-08-03' },
      adicion: { activa: true, numCdp: 'CDP-001', vigencia: '2025', valorAdicional: 1233, fechaAdicion: '2025-12-22' },
      prorroga: { activa: true, tiempoDias: 12, fechaProrroga: '2025-12-22' },
      clausula: sinClausula
    };
    const c = toActaPayload(contrato(), adicion, { cdp: '4097', rp: '11238' })['contrato'] as Record<string, unknown>;
    expect(c['cdp_numero']).toBe('CDP-001');
    // El CRP no lo capta ningún formulario: siempre viene de la financiera.
    expect(c['rp_numero']).toBe('11238');
  });

  it('envía la resolución del ordenador, y solo la del ordenador', () => {
    const c = { ...contrato(), spendingManagerResolution: 'RESOLUCIÓN DE RECTORÍA No. 206' };
    const bloque = toActaPayload(c, draft)['contrato'] as Record<string, Record<string, unknown>>;
    expect(bloque['ordenador']['resolucion']).toBe('RESOLUCIÓN DE RECTORÍA No. 206');
    expect('resolucion' in bloque['supervisor']).toBeFalse();
  });
});
