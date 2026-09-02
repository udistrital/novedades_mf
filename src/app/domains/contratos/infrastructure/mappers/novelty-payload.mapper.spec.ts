import {
  NOVEDAD_BACKEND,
  NoveltyWriteContext,
  bogotaNoonIso,
  toCompensacionPayload,
  toGestorDocumentalPayload,
  toNoveltyPayload,
  toReplicaPayload,
  toReplicaReinicioPayload,
  toValidarCambioEstadoPayload
} from './novelty-payload.mapper';
import { NoveltyStatus, NoveltyType } from '../../domain/models/novelty-type.enum';
import { Contract } from '../../domain/models/contract.entity';
import {
  AdicionProrrogaDraft,
  CesionDraft,
  ReinicioDraft,
  SuspensionDraft,
  TerminacionDraft
} from '../../domain/models/novelty-draft.model';

/**
 * Contrato 653/2025, el mismo de las trazas reales registradas en
 * `docs/endpoints_registrados.md`.
 */
function contrato(): Contract {
  return {
    id: '653_2025',
    principalId: '16387',
    number: '653',
    contractType: 'Prestación de servicios',
    contractorName: 'CONTRATISTA UNO',
    contractorId: '52706308',
    contractorProviderId: '193',
    contractingEntity: 'UD',
    totalValue: 60_533_823,
    object: '—',
    initialTerm: 'TRESCIENTOS QUINCE ( 315 ) DIAS',
    executionUnitId: 205,
    executionTerm: 315,
    // Fechas del acta de inicio del contrato real (no las derivadas del plazo).
    startDate: '07/02/2025',
    endDate: '21/12/2025',
    supervisor: 'SUPERVISOR',
    supervisorDocument: '1121906736',
    spendingManager: 'ORDENADOR',
    novelties: []
  };
}

function ctx(extra: Partial<NoveltyWriteContext> = {}): NoveltyWriteContext {
  return {
    contract: contrato(),
    vigencia: '2025',
    enlace: 'e8b60541-1172-4d1d-8ca3-c3f1cb2df83a',
    usuario: 'CC1030672927',
    now: new Date(2026, 6, 26, 14, 58),
    ...extra
  };
}

const solicitud = {
  fechaSolicitud: '2026-07-26',
  fechaExpedicionActa: '2026-07-26',
  numOficioSupervisor: '123',
  fechaOficioSupervisor: '2026-07-26',
  numOficioOrdenador: '123',
  fechaOficioOrdenador: '2026-07-26'
};

describe('bogotaNoonIso', () => {
  it('convierte la fecha del formulario al mediodía de Bogotá que espera el backend', () => {
    expect(bogotaNoonIso('2025-12-21')).toBe('2025-12-21T17:00:00.000Z');
  });

  it('acepta también el formato dd/mm/yyyy de los datos del contrato', () => {
    expect(bogotaNoonIso('07/02/2025')).toBe('2025-02-07T17:00:00.000Z');
  });

  it('devuelve cadena vacía si no hay fecha', () => {
    expect(bogotaNoonIso('')).toBe('');
    expect(bogotaNoonIso(null)).toBe('');
  });
});

describe('toNoveltyPayload — Terminación Anticipada (NP_TER)', () => {
  const draft: TerminacionDraft = {
    type: NoveltyType.EARLY_TERMINATION,
    solicitud,
    fechaTerminacion: '2025-12-21',
    fechaCertificacion: '2025-12-22',
    valorDesembolsado: 123,
    saldoFavorContratista: 123,
    saldoFavorUniversidad: 123,
    clausula: { activa: false, posicion: null, texto: '' }
  };

  it('reproduce el body de la traza real', () => {
    const p = toNoveltyPayload(draft, ctx());
    expect(p['contrato']).toBe('653');
    expect(p['vigencia']).toBe('2025');
    expect(p['tiponovedad']).toBe('NP_TER');
    expect(p['estado']).toBe('TERM');
    expect(p['cesionario']).toBe(193);
    expect(p['numerosolicitud']).toBe('');
    expect(p['motivo']).toBe('');
    expect(p['valor_desembolsado']).toBe(123);
    expect(p['saldo_contratista']).toBe(123);
    expect(p['saldo_universidad']).toBe(123);
    expect(p['fecha_terminacion_anticipada']).toBe('2025-12-21T17:00:00.000Z');
    // La terminación cierra el contrato ese mismo día.
    expect(p['fechafinefectiva']).toBe('2025-12-21T17:00:00.000Z');
    expect(p['enlace']).toBe('e8b60541-1172-4d1d-8ca3-c3f1cb2df83a');
    expect(p['numerooficiosupervisor']).toBe('123');
  });

  it('la réplica viaja con el plazo completo del contrato y el tipo 218', () => {
    const r = toReplicaPayload(draft, ctx());
    expect(r['TipoNovedad']).toBe(218);
    expect(r['NumeroContrato']).toBe('653');
    expect(r['Vigencia']).toBe(2025);
    expect(r['Contratista']).toBe(193);
    expect(r['Documento']).toBe('52706308');
    expect(r['PlazoEjecucion']).toBe(315);
    expect(r['FechaInicio']).toBe('2025-02-07T17:00:00.000Z');
    expect(r['FechaFin']).toBe('2025-12-21T17:00:00.000Z');
    expect(r['ValorNovedad']).toBe(123);
    expect(r['esFechaActual']).toBeTrue();
  });

  it('NO envía UnidadEjecucion: es el único tipo cuya réplica la omite', () => {
    expect('UnidadEjecucion' in toReplicaPayload(draft, ctx())).toBeFalse();
  });

  it('reproduce exactamente la traza real, clave por clave y en su mismo orden', () => {
    expect(JSON.stringify(toReplicaPayload(draft, ctx()))).toBe(JSON.stringify({
      NumeroContrato: '653',
      Vigencia: 2025,
      FechaRegistro: '2026-07-26T17:00:00.000Z',
      FechaInicio: '2025-02-07T17:00:00.000Z',
      FechaFin: '2025-12-21T17:00:00.000Z',
      Contratista: 193,
      PlazoEjecucion: 315,
      ValorNovedad: 123,
      Documento: '52706308',
      NumeroCdp: 0,
      VigenciaCdp: 0,
      TipoNovedad: 218,
      esFechaActual: true
    }));
  });
});

describe('toNoveltyPayload — Suspensión (NP_SUS)', () => {
  const draft: SuspensionDraft = {
    type: NoveltyType.SUSPENSION,
    solicitud: { ...solicitud, numOficioOrdenador: '321' },
    periodoDias: 26,
    fechaInicio: '2025-02-10',
    fechaFin: '2025-03-05',
    fechaReinicio: '2025-03-06',
    motivo: 'No hizo la tarea',
    clausula: { activa: false, posicion: null, texto: '' }
  };

  it('reproduce el body de la traza real', () => {
    const p = toNoveltyPayload(draft, ctx());
    expect(p['tiponovedad']).toBe('NP_SUS');
    // La suspensión no cambia el `estado` que viaja en la novedad.
    expect(p['estado']).toBe('ENEJ');
    expect(p['motivo']).toBe('No hizo la tarea');
    expect(p['periodosuspension']).toBe(26);
    expect(p['fechasuspension']).toBe('2025-02-10T17:00:00.000Z');
    expect(p['fechafinsuspension']).toBe('2025-03-05T17:00:00.000Z');
    expect(p['fechareinicio']).toBe('2025-03-06T17:00:00.000Z');
    expect(p['numerooficioordenador']).toBe('321');
    expect(p['cesionario']).toBe(193);
  });

  it('corre la fecha fin efectiva tantos días como dure la suspensión', () => {
    // Fin del acta (21/12/2025) + 26 días de suspensión = 16/01/2026, el valor
    // exacto que envía la traza real. Con el fin derivado del plazo daba 3 días menos.
    expect(toNoveltyPayload(draft, ctx())['fechafinefectiva']).toBe('2026-01-16T17:00:00.000Z');
  });

  it('la réplica viaja con el período de suspensión y el tipo 216', () => {
    const r = toReplicaPayload(draft, ctx());
    expect(r['TipoNovedad']).toBe(216);
    expect(r['PlazoEjecucion']).toBe(26);
    expect(r['FechaInicio']).toBe('2025-02-10T17:00:00.000Z');
    expect(r['FechaFin']).toBe('2025-03-05T17:00:00.000Z');
    expect(r['UnidadEjecucion']).toBe(205);
    expect(r['ValorNovedad']).toBeUndefined();
  });
});

describe('toNoveltyPayload — Cesión (NP_CES)', () => {
  const draft: CesionDraft = {
    type: NoveltyType.ASSIGNMENT,
    solicitud: { ...solicitud, numOficioOrdenador: '321' },
    fechaSesion: '2025-12-21',
    fechaTerminacionCedente: '2025-12-20',
    valorDesembolsado: 20,
    valorFavorCedente: 10,
    diasFaltantes: null,
    cedulaCesionario: '80038553',
    considerando: { activo: false, posicion: null, texto: '' },
    clausula: { activa: false, posicion: null, texto: '' }
  };

  const cesionario = { providerId: '97', documento: '80038553', nombre: 'RAÚL EDUARDO GUTIERREZ MOLINA' };

  it('separa cedente (contratista actual) y cesionario (nuevo)', () => {
    const p = toNoveltyPayload(draft, ctx({ cesionario }));
    expect(p['tiponovedad']).toBe('NP_CES');
    expect(p['cedente']).toBe(193);
    expect(p['cesionario']).toBe(97);
    expect(p['fechacesion']).toBe('2025-12-21T17:00:00.000Z');
    expect(p['fechafinefectiva']).toBe('2025-12-21T17:00:00.000Z');
    expect(p['valor_desembolsado']).toBe(20);
    expect(p['valor_a_favor']).toBe(10);
    expect(p['numerosolicitud']).toBeNull();
    expect(p['numeroactaentrega']).toBe(0);
  });

  it('la réplica cambia de contratista y lleva documento actual/nuevo (tipo 219)', () => {
    const r = toReplicaPayload(draft, ctx({ cesionario }));
    expect(r['TipoNovedad']).toBe(219);
    expect(r['Contratista']).toBe(97);
    expect(r['DocumentoActual']).toBe('52706308');
    expect(r['DocumentoNuevo']).toBe('80038553');
    expect(r['NombreCompleto']).toBe('RAÚL EDUARDO GUTIERREZ MOLINA');
    expect(r['PlazoEjecucion']).toBe(1);
    expect(r['FechaInicio']).toBe('2025-12-21T17:00:00.000Z');
    expect(r['FechaFin']).toBe('2025-12-21T17:00:00.000Z');
  });

  it('PlazoEjecucion es siempre 1, no los días faltantes por pago del formulario', () => {
    const conDias: CesionDraft = { ...draft, diasFaltantes: 12 };
    expect(toReplicaPayload(conDias, ctx({ cesionario }))['PlazoEjecucion']).toBe(1);
  });

  it('no cambia el estado del contrato (la traza no registra contrato_estado)', () => {
    expect(NOVEDAD_BACKEND[NoveltyType.ASSIGNMENT]?.estadoDestinoId).toBeNull();
  });
});

describe('toNoveltyPayload — Adición y Prórroga (NP_ADPRO)', () => {
  const draft: AdicionProrrogaDraft = {
    type: NoveltyType.ADDITION_EXTENSION,
    solicitud: {
      numSolicitud: '123',
      fechaSolicitud: '2026-07-26',
      numOficio: '123',
      fechaOficio: '2026-07-26',
      fechaActa: '2026-07-26'
    },
    // `numCdp` llega como number en runtime: el input es `type="number"` y Angular
    // guarda lo que devuelve NumberValueAccessor, no el string que declara el draft.
    adicion: { activa: true, numCdp: 1233 as unknown as string, vigencia: '0', valorAdicional: 1233, fechaAdicion: '2025-12-22' },
    prorroga: { activa: true, tiempoDias: 12, fechaProrroga: '2025-12-22' },
    clausula: { activa: false, posicion: null, texto: '' }
  };

  it('reproduce el body de la traza real', () => {
    const p = toNoveltyPayload(draft, ctx());
    expect(p['tiponovedad']).toBe('NP_ADPRO');
    expect(p['estado']).toBe('ENEJ');
    expect(p['numerosolicitud']).toBe('123');
    // El formulario solo captura el oficio del ordenador.
    expect(p['numerooficiosupervisor']).toBe('n.a.');
    expect(p['numerooficioordenador']).toBe('123');
    expect(p['numerocdp']).toBe('1233');
    expect(p['vigenciacdp']).toBe('0');
    expect(p['numerorp']).toBe('0');
    expect(p['vigenciarp']).toBe('0');
    expect(p['valoradicion']).toBe(1233);
    expect(p['tiempoprorroga']).toBe(12);
    expect(p['fechaprorroga']).toBe('2025-12-22T17:00:00.000Z');
    // Fin efectivo = fecha de prórroga + días de prórroga.
    expect(p['fechafinefectiva']).toBe('2026-01-03T17:00:00.000Z');
  });

  it('la réplica lleva los días de prórroga, el CDP y el tipo 220', () => {
    const r = toReplicaPayload(draft, ctx());
    expect(r['TipoNovedad']).toBe(220);
    expect(r['PlazoEjecucion']).toBe(12);
    expect(r['FechaInicio']).toBe('2025-12-22T17:00:00.000Z');
    expect(r['FechaFin']).toBe('2026-01-03T17:00:00.000Z');
    expect(r['ValorNovedad']).toBe(1233);
    expect(r['NumeroCdp']).toBe(1233);
    expect(r['VigenciaCdp']).toBe(0);
    // Adición sí envía UnidadEjecucion (a diferencia de terminación).
    expect(r['UnidadEjecucion']).toBe(205);
  });
});

describe('toNoveltyPayload — Reinicio (NP_REI)', () => {
  const draft: ReinicioDraft = {
    type: NoveltyType.RESTART,
    solicitud: { fechaSolicitud: '2026-08-03', fechaExpedicionActa: '2026-08-03' },
    fechaInicioSuspension: '2025-02-08',
    fechaFinSuspension: '2025-03-26',
    periodoDias: 49,
    fechaReinicio: '2025-03-27'
  };

  const ctxReinicio = () => ctx({ now: new Date(2026, 7, 3, 4, 56), enlace: 'a1db3b7d-ffa0-4456-85a4-b6a6133182ba' });

  it('reproduce el body de la traza real', () => {
    const p = toNoveltyPayload(draft, ctxReinicio());
    expect(p['tiponovedad']).toBe('NP_REI');
    // El reinicio cierra la suspensión: la traza envía TERM, no ENEJ.
    expect(p['estado']).toBe('TERM');
    expect(p['periodosuspension']).toBe(49);
    expect(p['fechasuspension']).toBe('2025-02-08T17:00:00.000Z');
    expect(p['fechafinsuspension']).toBe('2025-03-26T17:00:00.000Z');
    expect(p['fechareinicio']).toBe('2025-03-27T17:00:00.000Z');
    expect(p['fechasolicitud']).toBe('2026-08-03T17:00:00.000Z');
    expect(p['numerooficioestadocuentas']).toBe(0);
    expect(p['valor_desembolsado']).toBe(0);
    expect(p['observacion']).toBe('');
    expect(p['cesionario']).toBe(193);
    // El reinicio no captura oficios de supervisor/ordenador.
    expect('numerooficiosupervisor' in p).toBeFalse();
  });

  /** Registro de la suspensión tal como lo devuelve Ágora. */
  const suspensionArgo = {
    Id: 8123,
    NumeroContrato: '653',
    Vigencia: 2025,
    PlazoEjecucion: 315,
    FechaInicio: '2025-02-08T17:00:00.000Z',
    UnidadEjecucion: 205
  };

  it('la réplica REEMPLAZA el registro de Ágora: reenvía sus campos, no solo las fechas nuevas', () => {
    // El mid copia este cuerpo tal cual a `novedad_postcontractual/{id}`, que es un
    // reemplazo: lo que no viaje se borra. Antes solo iban las fechas.
    expect(JSON.stringify(toReplicaReinicioPayload(draft, ctxReinicio(), suspensionArgo))).toBe(
      JSON.stringify({
        NumeroContrato: '653',
        Vigencia: 2025,
        FechaRegistro: '2026-08-03T17:00:00.000Z',
        Contratista: 193,
        Documento: '52706308',
        PlazoEjecucion: 315,
        FechaInicio: '2025-02-08T17:00:00.000Z',
        FechaFin: '2025-03-26T17:00:00.000Z',
        FechaReinicio: '2025-03-27T17:00:00.000Z',
        UnidadEjecucion: 205,
        TipoNovedad: 216
      })
    );
  });

  it('pasa a ISO las fechas que Ágora devuelva en el formato por defecto de Go', () => {
    const p = toReplicaReinicioPayload(draft, ctxReinicio(), {
      ...suspensionArgo,
      FechaInicio: '2025-02-08 12:00:00.032834 +0000 +0000'
    });
    expect(p['FechaInicio']).toBe('2025-02-08T12:00:00Z');
  });

  /**
   * El legado encadena: cada novedad parte del `FechaFinEfectiva` que dejó la
   * anterior. Recalcularlo desde el acta de inicio acumulaba el desvío de cada
   * novedad previa — los 2 días de diferencia de la traza del 03/08.
   */
  describe('fechafinefectiva encadenada', () => {
    /** Contrato con una suspensión ya registrada, que es de donde parte el reinicio. */
    const conSuspension = (fechaFinEfectiva: string, diasSuspension = 49) =>
      ctx({
        now: new Date(2026, 7, 3, 4, 56),
        contract: {
          ...contrato(),
          novelties: [
            {
              id: '1',
              type: NoveltyType.SUSPENSION,
              expeditionDate: '03/08/2026',
              status: NoveltyStatus.IN_EXECUTION,
              canAnnul: true,
              diasSuspension,
              fechaFinEfectiva
            }
          ]
        }
      });

    it('copia el fin efectivo que dejó la suspensión cuando el período no cambia', () => {
      const p = toNoveltyPayload(draft, conSuspension('10/02/2026'));
      expect(p['fechafinefectiva']).toBe('2026-02-10T17:00:00.000Z');
    });

    it('lo adelanta cuando el reinicio acorta la suspensión', () => {
      // Registrados 49 días, se reinicia a los 40: el contrato termina 9 días antes.
      const p = toNoveltyPayload({ ...draft, periodoDias: 40 }, conSuspension('10/02/2026'));
      expect(p['fechafinefectiva']).toBe('2026-02-01T17:00:00.000Z');
    });

    it('sin fin efectivo registrado cae a la aproximación del dominio', () => {
      const p = toNoveltyPayload(draft, conSuspension(''));
      expect(p['fechafinefectiva']).toBeTruthy();
    });
  });

  it('devuelve el contrato a En ejecución (estado 4)', () => {
    expect(NOVEDAD_BACKEND[NoveltyType.RESTART]?.estadoDestinoId).toBe(4);
  });
});

describe('acta y cambio de estado', () => {
  it('el acta viaja con el nombre y los metadatos de la traza, y el PDF vacío', () => {
    const cfg = NOVEDAD_BACKEND[NoveltyType.EARLY_TERMINATION]!;
    const [doc] = toGestorDocumentalPayload(cfg, ctx()) as Record<string, unknown>[];
    expect(doc['IdTipoDocumento']).toBe(38);
    expect(doc['nombre']).toBe('acta_terminacion_anticipada_653_20267261458.pdf');
    expect(doc['descripcion']).toBe('6532025');
    // El PDF lo genera un servicio aparte, aún no implementado.
    expect(doc['file']).toBe('');
    expect(doc['metadatos']).toEqual({ contrato: 653, vigencia: 2025, estado: 'TERM', idNovedad: '' });
  });

  it('validarCambioEstado va en modo arreglo: [estado actual, catálogo del destino]', () => {
    const destino = { Id: 2, NombreEstado: 'Suspendido', FechaRegistro: '2016-01-08T00:00:00Z' };
    expect(toValidarCambioEstadoPayload('ejecucion', destino)).toEqual([{ NombreEstado: 'ejecucion' }, destino]);
  });

  it('la compensación desactiva la novedad conservando el resto del registro', () => {
    const p = toCompensacionPayload({ Id: 10555, ContratoId: 653, Activo: true, Motivo: '' });
    expect(p['Activo']).toBeFalse();
    expect(p['Motivo']).toBe('Error en la réplica');
    expect(p['Id']).toBe(10555);
    expect(p['ContratoId']).toBe(653);
  });


  it('reescribe a ISO las fechas que el CRUD devuelve en formato Go', () => {
    // Devolver `2026-08-24 14:00:26.032834 +0000 +0000` tal cual hacía que Postgres
    // rechazara el PUT completo ("invalid input syntax for type timestamp") y la
    // compensación fallara, dejando la novedad activa y sin replicar.
    const p = toCompensacionPayload({
      Id: 10616,
      Activo: true,
      Motivo: '',
      FechaCreacion: '2026-08-24 14:00:26.032834 +0000 +0000',
      FechaModificacion: '2026-08-24 14:00:26.032834 +0000 +0000'
    });
    expect(p['FechaCreacion']).toBe('2026-08-24T14:00:26Z');
    expect(p['FechaModificacion']).toBe('2026-08-24T14:00:26Z');
  });

  it('deja intactas las fechas que ya vienen en ISO y los campos que no son fecha', () => {
    const p = toCompensacionPayload({
      Id: 1,
      Activo: true,
      Motivo: '',
      FechaCreacion: '2026-07-26T12:00:00Z',
      OficioSupervisor: '123',
      Estado: '4569'
    });
    expect(p['FechaCreacion']).toBe('2026-07-26T12:00:00Z');
    expect(p['OficioSupervisor']).toBe('123');
    expect(p['Estado']).toBe('4569');
  });

  it('no toca una fecha ISO con desfase horario: reescribirla a Z la correría cinco horas', () => {
    const p = toCompensacionPayload({ Id: 1, FechaCreacion: '2026-07-26T12:00:00-05:00' });
    expect(p['FechaCreacion']).toBe('2026-07-26T12:00:00-05:00');
  });

  it('la compensación aplana TipoNovedad: la traza lo envía como número, no como objeto', () => {
    const leido = { Id: 10585, TipoNovedad: { Id: 3, Nombre: 'Reinicio' } };
    expect(toCompensacionPayload(leido, 3)['TipoNovedad']).toBe(3);
    // Sin el id del catálogo, se toma el del objeto anidado en vez de reenviarlo.
    expect(toCompensacionPayload(leido)['TipoNovedad']).toBe(3);
  });
});

/**
 * El acta se archiva **tipo por tipo**: hoy solo adición y prórroga manda el PDF.
 * En los demás el documento se registra vacío y "Ver acta" no lo encuentra (F1).
 */
describe('archivado del acta en el gestor documental', () => {
  const ctx = {
    contract: { number: '123', id: '123_2025' } as never,
    vigencia: '2025',
    usuario: 'CC1',
    now: new Date('2026-08-27T12:00:00Z')
  } as never;

  it('las cinco novedades suben su PDF en base64: es lo que hace que "Ver acta" funcione', () => {
    for (const tipo of Object.values(NoveltyType)) {
      const cfg = NOVEDAD_BACKEND[tipo];
      if (!cfg) continue;
      const doc = toGestorDocumentalPayload(cfg, ctx, 'JVBERi0x')[0] as Record<string, unknown>;
      expect(doc['file']).toBe('JVBERi0x');
    }
  });
});
