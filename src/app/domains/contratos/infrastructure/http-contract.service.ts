import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, throwError, timeout } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { ActaResponsables, CdpRp, ContractFilters, IContractRepository } from '../domain/repositories/contract.repository';
import { Contract, NoveltySummary } from '../domain/models/contract.entity';
import { ContractStatus } from '../domain/models/contract-status.enum';
import { NoveltyType } from '../domain/models/novelty-type.enum';
import { Assignee } from '../domain/models/assignee.model';
import { NoveltyDraft } from '../domain/models/novelty-draft.model';
import { NoveltyDocument } from '../domain/models/novelty-document.model';
import { Aseguradora, Poliza, PolizaUpdate } from '../domain/models/poliza.model';
import { availableVigencias, currentContractorId } from '../domain/contract.rules';
import { UserSessionService } from '../../../shared/auth/user-session.service';
import { describeApiError } from '../../../shared/http/api-error';
import {
  ActaInicioDto,
  AlertResponse,
  ApiResponseDto,
  CdpRpTerceroDto,
  ContratoEstadoDto,
  ContratoGeneralDto,
  EntidadAseguradoraDto,
  EstadoContratoDto,
  GestorDocumentalDto,
  InformacionPersonaNaturalDto,
  InformacionProveedorDto,
  NovedadMidDto,
  NovedadPoscontractualDto,
  NovedadPostcontractualArgoDto,
  OrdenadorDto,
  PolizaDto,
  SupervisorContratoDto,
  TipoNovedadDto
} from './dtos/external-api.dto';
import {
  ordenadorGastoId,
  toAseguradora,
  toAssignee,
  toContract,
  toContractStatus,
  toDdMmYyyy,
  toNoveltySummaries,
  toPoliza
} from './mappers/contract.mapper';
import {
  ESTADO_CONTRATO_ID,
  NOVEDAD_BACKEND,
  NoveltyWriteContext,
  TIPO_NOVEDAD_REPLICA_SUSPENSION,
  conFechasIso,
  toCambioEstadoPayload,
  toCompensacionPayload,
  toGestorDocumentalPayload,
  toNoveltyPayload,
  toReplicaPayload,
  toReplicaReinicioPayload,
  toValidarCambioEstadoPayload
} from './mappers/novelty-payload.mapper';

/**
 * Repositorio contra las APIs institucionales (administrativa_amazon_api,
 * novedades_mid, novedades_crud y core_amazon_crud).
 *
 * Escrituras: replican la coreografía completa del cliente legado, confirmada
 * contra trazas reales del contrato 653/2025 (`docs/endpoints_registrados.md`):
 *
 *   subir acta → [validar cambio de estado] → crear novedad → replicar
 *   → (si la réplica falla) compensar desactivando la novedad
 *   → [registrar el nuevo estado del contrato]
 *
 * Los pasos entre corchetes solo corren para las novedades que cambian el estado
 * del contrato (suspensión, terminación anticipada y reinicio). La réplica del
 * reinicio es un PUT y no un POST: ver `replicar`.
 *
 * ⚠️ Solo se escribe contra los endpoints verificados en el ambiente de pruebas
 * (ver `docs/endpoints_registrados.md`). Cualquier otro POST/PUT/DELETE queda
 * comentado a propósito: apuntan a datos reales en todos los ambientes.
 */
@Injectable({ providedIn: 'root' })
export class HttpContractService implements IContractRepository {
  private readonly http = inject(HttpClient);
  private readonly session = inject(UserSessionService);
  private readonly adm = environment.ADMINISTRATIVA_PRUEBAS_SERVICE;
  private readonly mid = environment.NOVEDADES_MID_SERVICE;
  private readonly crud = environment.NOVEDADES_SERVICE;
  private readonly core = environment.CORE_AMAZON_SERVICE;
  private readonly jbpm = environment.FINANCIERA_JBPM_SERVICE;

  /** Firmantes del acta, resueltos una sola vez por sesión (ver `getActaResponsables`). */
  private responsables?: Observable<ActaResponsables>;

  /** Catálogo de vigencias, resuelto una sola vez por sesión (ver `getVigencias`). */
  private vigencias?: Observable<string[]>;

  getContracts(filters?: ContractFilters): Observable<Contract[]> {
    const number = filters?.number?.trim();
    const contractor = filters?.contractor?.trim();
    // No existe un "listar todos" razonable en el backend: el buscador siempre envía un criterio.
    if (!number && !contractor) return of([]);

    const rows$ = number
      ? this.contratosPorQuery(`ContratoSuscrito.NumeroContratoSuscrito:${number}`, filters?.year)
      : this.contratosDeContratista(contractor!, filters?.year);

    return rows$.pipe(
      // Por VigenciaContrato descendente: la más reciente arriba. Se ordena sobre el
      // dato crudo del backend, no sobre una fecha derivada/aproximada del dominio.
      map(rows => [...rows].sort((a, b) => vigenciaOf(b) - vigenciaOf(a))),
      switchMap(rows => (rows.length ? forkJoin(rows.map(r => this.toDomain(r))) : of([])))
    );
  }

  /**
   * Contrato para la vista de detalle (formularios de novedad). Además de lo que
   * trae el listado, resuelve el **acta de inicio** y el **ordenador del gasto**:
   * datos que el listado no necesita y que cuestan dos peticiones más por contrato.
   */
  getContractById(id: string): Observable<Contract | undefined> {
    const { numero, vigencia } = splitContractId(id);
    return this.contratosPorQuery(`ContratoSuscrito.NumeroContratoSuscrito:${numero}`, vigencia).pipe(
      switchMap(rows =>
        rows.length ? this.toDomain(rows[0]).pipe(switchMap(c => this.conActaYOrdenador(c, rows[0]))) : of(undefined)
      )
    );
  }

  searchContractors(query: string): Observable<Assignee[]> {
    const q = query.replace(/\D/g, '');
    if (!q) return of([]);
    // `__icontains` es el operador de filtro estándar de los CRUD Beego; si el servicio
    // no lo soporta, la búsqueda con el documento completo (exacta) sigue funcionando.
    return this.http
      .get<InformacionProveedorDto[]>(`${this.adm}informacion_proveedor`, {
        params: { query: `NumDocumento__icontains:${q}`, limit: 20 }
      })
      .pipe(
        map(rows => nonEmpty(rows).map(toAssignee)),
        catchError(() => of([]))
      );
  }

  /**
   * Descarga el acta de una novedad. El mid responde con el documento completo
   * (contenido en base64 dentro del envoltorio `Alert`), no con un redirect: por
   * eso no se puede enlazar la URL directamente desde la vista.
   */
  getNoveltyDocument(documentId: string): Observable<NoveltyDocument> {
    return this.http
      .get<AlertResponse<GestorDocumentalDto>>(`${this.mid}gestor_documental/${documentId}`)
      .pipe(
        switchMap(res => {
          const doc = res?.Body;
          if (!esAlertaExitosa(res) || !doc?.file) {
            return throwError(() => new Error('No se pudo obtener el acta del gestor documental.'));
          }
          return of({
            fileName: doc['dc:title'] ?? `acta-${documentId}.pdf`,
            mimeType: doc['file:content']?.['mime-type'] ?? 'application/pdf',
            base64: doc.file
          });
        })
      );
  }

  /**
   * Crea la novedad con la cascada completa del legado (ver TSDoc de la clase).
   *
   * El contrato se recarga primero porque los payloads necesitan datos que no
   * viajan en el draft: id principal, id de proveedor del contratista, unidad y
   * plazo de ejecución.
   */
  createNovelty(contractId: string, draft: NoveltyDraft, actaBase64 = ''): Observable<void> {
    const { vigencia } = splitContractId(contractId);
    return this.getContractById(contractId).pipe(
      switchMap(contract =>
        contract
          ? this.ejecutarCascada(contract, vigencia, draft, actaBase64)
          : throwError(() => new Error('No se encontró el contrato sobre el que se registra la novedad.'))
      ),
      // Ninguna novedad se registra a medias: si algún paso falla o la cascada
      // completa excede el tiempo límite, se aborta y se corta lo que quede en vuelo.
      timeout({ each: TIMEOUT_CASCADA_MS, with: () => throwError(() => new Error(ERROR_TIMEOUT)) })
    );
  }

  /** Cascada de escritura de una novedad; ver el TSDoc de la clase para el orden. */
  private ejecutarCascada(contract: Contract, vigencia: string, draft: NoveltyDraft, actaBase64: string): Observable<void> {
    const usuario = this.session.usuarioRegistro();
    const cfg = NOVEDAD_BACKEND[draft.type];
    const now = new Date();

    // Los payloads dependen de datos del contrato que el backend puede no haber
    // entregado; sin ellos se escribiría una novedad inválida en silencio.
    const faltante = datoDeContratoFaltante(contract, draft);
    if (faltante) {
      return throwError(() => new Error(`No se registró la novedad: falta ${faltante} del contrato.`));
    }

    // Los cinco tipos que los formularios producen tienen configuración; el único
    // miembro del enum sin ella es `EXTENSION`, que ninguna página construye.
    if (!cfg) return throwError(() => new Error(`No hay configuración de backend para la novedad "${draft.type}".`));

    // Prerrequisitos que la cascada necesita resueltos antes de escribir.
    return forkJoin({
      // Id del catálogo `tipo_novedad`: lo exige el PUT de compensación.
      tipoNovedadId: this.tipoNovedadId(cfg.catalogo),
      // Cesionario del formulario → proveedor (id, documento y nombre para la réplica).
      cesionario: this.cesionarioDeDraft(draft),
      // Estado destino del catálogo + estado actual del contrato: ambos van en
      // el cuerpo (modo arreglo) de `validarCambioEstado`.
      estadoDestino: cfg.estadoDestinoId === null ? of(undefined) : this.estadoContratoPorId(cfg.estadoDestinoId),
      estadoActual: cfg.estadoDestinoId === null ? of(undefined) : this.ultimoEstadoContrato(contract.principalId, vigencia)
    }).pipe(
      switchMap(({ tipoNovedadId, cesionario, estadoDestino, estadoActual }) => {
        const ctxBase = { contract, vigencia, usuario, now, cesionario };

        // Sin cesionario resuelto la cesión dejaría el contrato cedido a nadie
        // (novedad sin `cesionario`, réplica sin `Contratista`): se corta antes
        // de subir el acta, que es la primera escritura.
        if (draft.type === NoveltyType.ASSIGNMENT && !cesionario?.providerId) {
          return throwError(() => new Error('No se encontró el cesionario en informacion_proveedor: no se registró la cesión.'));
        }

        // 1) Acta al gestor documental → devuelve el `enlace` que guarda la novedad.
        return this.subirActa(cfg, ctxBase, actaBase64).pipe(
          switchMap(enlace => {
            const ctx: NoveltyWriteContext = { ...ctxBase, enlace };

            // 2) Validación del cambio de estado (solo si la novedad lo cambia).
            const validar$ = cfg.estadoDestinoId === null || !estadoDestino
              ? of(undefined)
              : this.validarCambioEstado(nombreEstado(estadoActual), estadoDestino);

            return validar$.pipe(
              // 3) Creación de la novedad.
              switchMap(() => this.postNovedad(draft, ctx)),
              // 4) Réplica hacia Ágora/Titan; si falla, se compensa desactivando la novedad.
              switchMap(novedadId => this.replicarOCompensar(draft, ctx, novedadId, tipoNovedadId)),
              // 5) Registro del nuevo estado del contrato.
              switchMap(() =>
                cfg.estadoDestinoId === null
                  ? of(undefined)
                  : this.registrarEstado(cfg.estadoDestinoId, contract.principalId, vigencia, usuario)
              )
            );
          })
        );
      }),
      map(() => undefined)
    );
  }

  /** POST del acta en `gestor_documental`; devuelve el UUID (`enlace`) del documento. */
  private subirActa(
    cfg: NonNullable<(typeof NOVEDAD_BACKEND)[keyof typeof NOVEDAD_BACKEND]>,
    ctx: Omit<NoveltyWriteContext, 'enlace'>,
    actaBase64: string
  ): Observable<string> {
    return this.http
      .post<AlertResponse<unknown>>(`${this.mid}gestor_documental`, toGestorDocumentalPayload(cfg, ctx, actaBase64))
      .pipe(
        switchMap(res =>
          esAlertaExitosa(res)
            ? of(extraerEnlace(res?.Body))
            : throwError(() => new Error(alertaError(res)))
        )
      );
  }

  /** POST de la novedad; devuelve el Id creado (necesario para compensar si falla la réplica). */
  private postNovedad(draft: NoveltyDraft, ctx: NoveltyWriteContext): Observable<string | undefined> {
    return this.http
      .post<AlertResponse<unknown>>(`${this.mid}novedad`, toNoveltyPayload(draft, ctx))
      .pipe(
        switchMap(res =>
          esAlertaExitosa(res)
            ? of(extraerNovedadId(res?.Body))
            : throwError(() => new Error(alertaError(res)))
        )
      );
  }

  /**
   * Réplica hacia Ágora/Titan; si falla, compensa desactivando la novedad recién
   * creada y propaga el error.
   *
   * La compensación **puede no ocurrir**: si no se pudo extraer el id de la novedad
   * de la respuesta del POST, o si el GET+PUT falla. Antes eso pasaba en silencio y
   * el usuario solo veía el error de réplica — indistinguible del caso bueno, aunque
   * la consecuencia es opuesta: la novedad queda **activa y sin replicar**, que es el
   * peor estado posible y el que ADR-015 dice que no debe existir. Ahora el mensaje
   * lo dice, porque es información que el usuario necesita para reportarlo.
   */
  private replicarOCompensar(
    draft: NoveltyDraft,
    ctx: NoveltyWriteContext,
    novedadId: string | undefined,
    tipoNovedadId: number | undefined
  ): Observable<void> {
    return this.replicar(draft, ctx).pipe(
      switchMap(res => (esAlertaExitosa(res) ? of(undefined) : throwError(() => new Error(alertaError(res))))),
      catchError((err: unknown) =>
        this.compensarNovedad(novedadId, tipoNovedadId).pipe(
          switchMap(compensada => throwError(() => errorDeReplica(err, compensada)))
        )
      )
    );
  }

  /**
   * Llamada de réplica, que NO es la misma para todos los tipos:
   *
   * - Cuatro tipos hacen `POST {mid}replica`: crean el registro en Ágora/Titan.
   * - **Reinicio** hace `PUT {mid}replica/{id}`: no crea nada, actualiza la
   *   suspensión que reanuda (de ahí el `TipoNovedad: 216` de suspensión y el
   *   cuerpo reducido a las dos fechas).
   *
   * El id del PUT es el del registro de la suspensión **en Ágora**, no el de la
   * novedad en `novedades_crud`: el mid hace `PUT novedad_postcontractual/{id}`
   * con él. Son dos espacios de identificadores distintos.
   */
  private replicar(draft: NoveltyDraft, ctx: NoveltyWriteContext): Observable<AlertResponse<unknown>> {
    if (draft.type !== NoveltyType.RESTART) {
      return this.http.post<AlertResponse<unknown>>(`${this.mid}replica`, toReplicaPayload(draft, ctx));
    }
    return this.suspensionReplicada(ctx).pipe(
      switchMap(argo =>
        this.http.put<AlertResponse<unknown>>(
          `${this.mid}replica/${argo.Id}`,
          toReplicaReinicioPayload(draft, ctx, argo)
        )
      )
    );
  }

  /**
   * Registro de la suspensión replicada en Ágora, el que el reinicio actualiza: de
   * él salen el id de la URL y los campos que el PUT reenvía intactos
   * (`PlazoEjecucion`, `FechaInicio`, `UnidadEjecucion`…).
   *
   * Se toma el más reciente por `FechaRegistro`, igual que el cliente legado. Si no
   * aparece, se corta antes de llamar: un PUT sin registro que actualizar solo
   * puede dañar datos ajenos.
   */
  private suspensionReplicada(ctx: NoveltyWriteContext): Observable<NovedadPostcontractualArgoDto> {
    return this.http
      .get<NovedadPostcontractualArgoDto[]>(`${this.adm}novedad_postcontractual`, {
        params: {
          query: `numero_contrato:${ctx.contract.number},vigencia:${ctx.vigencia},TipoNovedad:${TIPO_NOVEDAD_REPLICA_SUSPENSION}`,
          limit: 0,
          sortby: 'FechaRegistro',
          order: 'desc'
        }
      })
      .pipe(
        switchMap(rows => {
          const argo = nonEmpty(rows)[0];
          return argo?.Id
            ? of(argo)
            : throwError(
                () =>
                  new Error(
                    'No se encontró en Ágora la suspensión que este reinicio reanuda: no se replicó la novedad.'
                  )
              );
        })
      );
  }

  /**
   * Compensación de una réplica fallida: relee la novedad y la reescribe
   * `Activo:false` con motivo "Error en la réplica", igual que el legado
   * (GET+PUT sobre `novedades_poscontractuales/{id}` en las trazas de Cesión y
   * Reinicio). Aplica a los cinco tipos, porque cuelga de `replicarOCompensar`.
   *
   * Sus errores no se propagan —el error que importa es el de la réplica, que
   * `replicarOCompensar` vuelve a lanzar— pero **sí se reportan**: devuelve `false`
   * cuando no pudo desactivar la novedad, para que el mensaje al usuario diga que
   * quedó registrada sin replicar.
   *
   * @returns `true` si la novedad quedó desactivada; `false` si no se pudo (sin id
   * extraíble de la respuesta del POST, o fallo del GET/PUT).
   */
  private compensarNovedad(novedadId: string | undefined, tipoNovedadId: number | undefined): Observable<boolean> {
    if (!novedadId) return of(false);
    const url = `${this.crud}novedades_poscontractuales/${novedadId}`;
    return this.http.get<NovedadPoscontractualDto>(url).pipe(
      switchMap(registro => this.http.put(url, toCompensacionPayload(registro, tipoNovedadId))),
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Anula la novedad vía PATCH del mid: el backend marca `Activo=false` y
   * revierte el estado del contrato en cascada (AnularNovedadYRevertirEstado).
   *
   * Es la única escritura activa sin traza en `endpoints_registrados.md`
   * (excepción documentada en [ADR-015]); de ahí que la respuesta se juzgue con
   * `anulacionRechazada`, que contempla las dos formas posibles.
   */
  annulNovelty(contractId: string, noveltyId: string, type: NoveltyType): Observable<void> {
    return this.http
      .patch<RespuestaAnulacion>(`${this.mid}novedad/${noveltyId}`, { usuario: this.session.usuarioRegistro() })
      .pipe(
        switchMap(res =>
          anulacionRechazada(res)
            ? throwError(() => new Error(res?.Message || alertaError(res)))
            : this.estadoTrasAnular(contractId, type)
        )
      );
  }

  /**
   * Corrige el estado del contrato después de anular, cuando el que deja el mid no
   * es el que corresponde.
   *
   * `AnularNovedadYRevertirEstado` registra **siempre** los estados 10 (Novedad
   * Anulada, transitorio) y 4 (En ejecución), sin mirar el tipo de novedad. Para el
   * reinicio eso es incorrecto: anularlo revive la suspensión que ese reinicio había
   * levantado, así que el contrato tiene que volver a **Suspendido**. En los demás
   * tipos "En ejecución" sí es el estado correcto y no se escribe nada.
   *
   * La anulación ya ocurrió cuando esto corre: si el registro del estado falla, el
   * error lo dice explícitamente para que el usuario no crea que puede reintentar la
   * anulación entera.
   */
  private estadoTrasAnular(contractId: string, type: NoveltyType): Observable<void> {
    const estadoId = estadoTrasAnulacion(type);
    if (estadoId === null) return of(undefined);
    const { numero, vigencia } = splitContractId(contractId);
    return this.contratoPrincipalId(numero, vigencia).pipe(
      switchMap(contratoId =>
        contratoId
          ? this.registrarEstado(estadoId, contratoId, vigencia, this.session.usuarioRegistro())
          : throwError(() => new Error('No se encontró el contrato.'))
      ),
      catchError((err: unknown) =>
        throwError(
          () =>
            new Error(
              `La novedad SÍ quedó anulada, pero el contrato no volvió a "Suspendido": ${describeApiError(err).detail} Corrígelo antes de tramitar otra novedad.`
            )
        )
      )
    );
  }

  /**
   * Reapertura administrativa (contrato Finalizado → En ejecución): valida la
   * transición en el mid y registra el nuevo estado, con la misma pareja de
   * llamadas que usan las novedades que cambian de estado.
   */
  activateContract(contractId: string): Observable<void> {
    const { numero, vigencia } = splitContractId(contractId);
    const usuario = this.session.usuarioRegistro();
    return forkJoin({
      estadoDestino: this.estadoContratoPorNombre('En ejecucion'),
      // Id principal de contrato_general (row.Id), no el número humano — ver createNovelty.
      contratoId: this.contratoPrincipalId(numero, vigencia)
    }).pipe(
      switchMap(({ estadoDestino, contratoId }) => {
        if (!estadoDestino?.Id) {
          return throwError(() => new Error('No se encontró el estado "En ejecución" en el catálogo.'));
        }
        if (!contratoId) {
          return throwError(() => new Error('No se encontró el contrato a activar.'));
        }
        return this.ultimoEstadoContrato(contratoId, vigencia).pipe(
          switchMap(estadoActual => this.validarCambioEstado(nombreEstado(estadoActual), estadoDestino)),
          switchMap(() => this.registrarEstado(estadoDestino.Id!, contratoId, vigencia, usuario))
        );
      }),
      timeout({ each: TIMEOUT_CASCADA_MS, with: () => throwError(() => new Error(ERROR_TIMEOUT)) })
    );
  }

  /**
   * Vigencias con contratos, tal como las lista Ágora: `[2026, 2025, …, 2015]`.
   *
   * Se cachea para la sesión (el catálogo no cambia mientras el usuario trabaja) y
   * se ordena descendente sin confiar en el orden de la respuesta, porque el primer
   * elemento se usa como vigencia por defecto del CDP.
   *
   * Si el servicio falla cae al rango calculado (`availableVigencias`): un filtro sin
   * años dejaría al usuario sin poder buscar, y el rango acierta salvo en los extremos
   * del histórico.
   */
  getVigencias(): Observable<string[]> {
    this.vigencias ??= this.http.get<number[]>(`${this.adm}vigencia_contrato`).pipe(
      map(años =>
        (años ?? [])
          .map(Number)
          .filter(Number.isFinite)
          .sort((a, b) => b - a)
          .map(String)
      ),
      map(años => (años.length ? años : availableVigencias())),
      catchError(() => of(availableVigencias())),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.vigencias;
  }

  getAseguradoras(): Observable<Aseguradora[]> {
    return this.http
      .get<EntidadAseguradoraDto[]>(`${this.core}entidad_aseguradora`, { params: { limit: 0 } })
      .pipe(
        map(rows => nonEmpty(rows).map(toAseguradora)),
        catchError(() => of([]))
      );
  }

  getPolizaDeNovedad(noveltyId: string): Observable<Poliza | undefined> {
    return this.http
      .get<PolizaDto[]>(`${this.crud}poliza`, { params: { query: `IdNovedadesPoscontractuales:${noveltyId}` } })
      .pipe(
        map(rows => {
          const row = nonEmpty(rows)[0];
          return row ? toPoliza(row) : undefined;
        }),
        catchError(() => of(undefined))
      );
  }

  /**
   * Firmantes del acta, cacheados para toda la sesión: no dependen del contrato ni
   * de la novedad, así que resolverlos una vez evita dos peticiones por cada acta
   * (y por cada previsualización).
   *
   * Nunca falla: son campos **opcionales** del acta y el servicio imprime `________`
   * cuando faltan. Que no se resuelva un nombre no puede impedir generar el acta y,
   * con ella, registrar la novedad.
   */
  getActaResponsables(): Observable<ActaResponsables> {
    this.responsables ??= forkJoin({
      elaboro: this.nombrePersona(this.session.session().documento),
      jefeJuridica: this.jefeOficinaContratacion()
    }).pipe(
      catchError(() => of({ elaboro: '', jefeJuridica: '' })),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.responsables;
  }

  /**
   * CDP y CRP vigentes del contrato, que las actas imprimen en su encabezado.
   *
   * No se cachea (depende del contrato) y **nunca falla**: son campos opcionales
   * del acta, así que un financiero caído no puede impedir tramitar la novedad —
   * el servicio imprime su marcador y el acta sale igual.
   */
  getCdpRp(contract: Contract): Observable<CdpRp> {
    const { numero, vigencia } = splitContractId(contract.id);
    if (!numero || !vigencia) return of(SIN_CDP_RP);
    return this.http.get<CdpRpTerceroDto>(`${this.jbpm}${rutaCdpRp(numero, vigencia, contract.executingUnit)}`).pipe(
      map(cdpRpVigente),
      catchError(() => of(SIN_CDP_RP))
    );
  }

  /** Nombre completo de una persona natural por documento; '' si no se puede resolver. */
  private nombrePersona(documento: string): Observable<string> {
    if (!documento) return of('');
    return this.http
      .get<InformacionPersonaNaturalDto[]>(`${this.adm}informacion_persona_natural`, {
        params: { query: `Id:${documento}` }
      })
      .pipe(
        map(rows => nombreCompleto(nonEmpty(rows)[0])),
        catchError(() => of(''))
      );
  }

  /** Jefe vigente de la Oficina de Contratación (el más reciente por `FechaFin`). */
  private jefeOficinaContratacion(): Observable<string> {
    return this.http
      .get<SupervisorContratoDto[]>(`${this.adm}supervisor_contrato`, {
        params: { query: `DependenciaSupervisor:${DEPENDENCIA_OFICINA_CONTRATACION}`, sortby: 'FechaFin', order: 'desc', limit: 1 }
      })
      .pipe(
        map(rows => aNombrePropio(nonEmpty(rows)[0]?.Nombre ?? '')),
        catchError(() => of(''))
      );
  }

  /**
   * Completa el registro de póliza que dejó la cesión (PUT, no POST: el registro
   * ya existe).
   *
   * Relee el registro y lo reenvía **completo**, igual que la compensación: el CRUD
   * Beego reemplaza el objeto en vez de hacer merge, así que mandar solo los dos
   * campos editables borraría `Activo`, `FechaCreacion` y el vínculo con la novedad.
   * Las fechas se reescriben a ISO por el mismo motivo que allí (`conFechasIso`).
   */
  updatePoliza(polizaId: string, cambios: PolizaUpdate): Observable<void> {
    return this.http
      .get<PolizaDto[]>(`${this.crud}poliza`, { params: { query: `Id:${polizaId}` } })
      .pipe(
        switchMap(rows => {
          const registro = nonEmpty(rows)[0];
          if (!registro) {
            return throwError(() => new Error('No se encontró el registro de póliza que se iba a completar.'));
          }
          return this.http.put(`${this.crud}poliza/${polizaId}`, {
            ...conFechasIso(registro),
            NumeroPolizaId: cambios.numeroPoliza,
            EntidadAseguradoraId: cambios.entidadAseguradoraId
          });
        }),
        map(() => undefined)
      );
  }

  // --- Privados ---

  // Los prerrequisitos de abajo NO capturan errores a propósito: son parte de una
  // operación de escritura y, si alguno falla, la novedad no debe crearse (ver
  // `ejecutarCascada`). La tolerancia a fallos vive solo en los métodos de lectura.

  /** Registro del catálogo `estado_contrato` por nombre (p. ej. "En ejecucion"). */
  private estadoContratoPorNombre(nombre: string): Observable<EstadoContratoDto | undefined> {
    return this.http
      .get<EstadoContratoDto[]>(`${this.adm}estado_contrato`, { params: { query: `NombreEstado:${nombre}` } })
      .pipe(map(rows => nonEmpty(rows)[0]));
  }

  /** Registro del catálogo `estado_contrato` por id; el cuerpo de `validarCambioEstado` lo envía completo. */
  private estadoContratoPorId(estadoId: number): Observable<EstadoContratoDto> {
    return this.http
      .get<EstadoContratoDto[]>(`${this.adm}estado_contrato`, { params: { query: `Id:${estadoId}` } })
      .pipe(
        switchMap(rows => {
          const row = nonEmpty(rows)[0];
          return row
            ? of(row)
            : throwError(() => new Error(`No se encontró el estado ${estadoId} en el catálogo estado_contrato.`));
        })
      );
  }

  /** Id del catálogo `tipo_novedad` por nombre. */
  private tipoNovedadId(nombre: string): Observable<number | undefined> {
    return this.http
      .get<TipoNovedadDto[]>(`${this.crud}tipo_novedad/`, { params: { query: `Nombre:${nombre}` } })
      .pipe(map(rows => nonEmpty(rows)[0]?.Id));
  }

  /** Último registro de `contrato_estado` del contrato (el estado vigente). */
  private ultimoEstadoContrato(contratoId: string, vigencia: string): Observable<ContratoEstadoDto | undefined> {
    if (!contratoId || !vigencia) return of(undefined);
    return this.http
      .get<ContratoEstadoDto[]>(`${this.adm}contrato_estado`, {
        params: { query: `NumeroContrato:${contratoId},Vigencia:${vigencia}`, sortby: 'Id', order: 'desc', limit: 1 }
      })
      .pipe(map(rows => nonEmpty(rows)[0]));
  }

  /** Cesionario del draft (solo cesión) resuelto contra `informacion_proveedor`. */
  private cesionarioDeDraft(
    draft: NoveltyDraft
  ): Observable<{ providerId: string; documento: string; nombre: string } | undefined> {
    if (draft.type !== NoveltyType.ASSIGNMENT || !draft.cedulaCesionario) return of(undefined);
    const documento = draft.cedulaCesionario.replace(/\D/g, '') || draft.cedulaCesionario;
    return this.http
      .get<InformacionProveedorDto[]>(`${this.adm}informacion_proveedor`, {
        params: { query: `NumDocumento:${documento}` }
      })
      .pipe(
        map(rows => {
          const p = nonEmpty(rows)[0];
          return p ? { providerId: String(p.Id ?? ''), documento: String(p.NumDocumento ?? documento), nombre: p.NomProveedor ?? '' } : undefined;
        })
      );
  }

  /**
   * `POST {mid}validarCambioEstado` en modo arreglo: valida la transición sin
   * aplicarla (el modo objeto la aplicaría por dentro llamando `contrato_estado`,
   * duplicando el registro que hace `registrarEstado`).
   */
  private validarCambioEstado(nombreEstadoActual: string, estadoDestino: EstadoContratoDto): Observable<void> {
    return this.http
      .post<AlertResponse<unknown>>(
        `${this.mid}validarCambioEstado`,
        toValidarCambioEstadoPayload(nombreEstadoActual, estadoDestino)
      )
      .pipe(
        switchMap(res => (esAlertaExitosa(res) ? of(undefined) : throwError(() => new Error(alertaError(res)))))
      );
  }

  /** `POST {amazon}contrato_estado`: registra el nuevo estado del contrato. */
  private registrarEstado(estadoId: number, contratoId: string, vigencia: string, usuario: string): Observable<void> {
    return this.http
      .post(`${this.adm}contrato_estado`, toCambioEstadoPayload(estadoId, contratoId, vigencia, usuario))
      .pipe(map(() => undefined));
  }

  private contratosPorQuery(baseQuery: string, year?: string): Observable<ContratoGeneralDto[]> {
    const query = year ? `${baseQuery},VigenciaContrato:${year}` : baseQuery;
    return this.http
      .get<ContratoGeneralDto[]>(`${this.adm}contrato_general/`, { params: { query } })
      .pipe(map(nonEmpty), catchError(() => of([])));
  }

  /**
   * Id principal de `contrato_general` (el primer `Id` del GET
   * `?query=ContratoSuscrito.NumeroContratoSuscrito:{numero},VigenciaContrato:{vigencia}`),
   * no el número humano del contrato. Es el "NumeroContrato" que esperan los
   * endpoints de cambio de estado (`validarCambioEstado`, `contrato_estado`).
   */
  private contratoPrincipalId(numero: string, vigencia: string): Observable<string | undefined> {
    return this.contratosPorQuery(`ContratoSuscrito.NumeroContratoSuscrito:${numero}`, vigencia).pipe(
      map(rows => (rows[0]?.Id !== undefined ? String(rows[0].Id) : undefined))
    );
  }

  /** Búsqueda por contratista: primero resuelve el proveedor por documento, luego sus contratos. */
  private contratosDeContratista(doc: string, year?: string): Observable<ContratoGeneralDto[]> {
    const digits = doc.replace(/\D/g, '') || doc;
    return this.http
      .get<InformacionProveedorDto[]>(`${this.adm}informacion_proveedor`, {
        params: { query: `NumDocumento:${digits}` }
      })
      .pipe(
        map(nonEmpty),
        switchMap(provs => (provs[0]?.Id ? this.contratosPorQuery(`Contratista:${provs[0].Id}`, year) : of([]))),
        catchError(() => of<ContratoGeneralDto[]>([]))
      );
  }

  /**
   * Completa una fila de contrato con el contratista, sus novedades y su estado
   * real; si el historial registra cesiones, el contratista vigente pasa a ser
   * el último cesionario (requerimientos §5.5).
   */
  private toDomain(row: ContratoGeneralDto): Observable<Contract> {
    const suscrito = row.ContratoSuscrito?.[0];
    const numero = String(suscrito?.NumeroContratoSuscrito ?? row.NumeroContrato ?? '');
    const vigencia = String(row.VigenciaContrato ?? row.Vigencia ?? suscrito?.Vigencia ?? '');
    const contratistaId = typeof row.Contratista === 'object' ? row.Contratista?.Id : row.Contratista;
    return forkJoin({
      proveedor: this.proveedorPorId(contratistaId),
      novelties: this.novedadesDeContrato(numero, vigencia),
      status: this.estadoDeContrato(row.Id, vigencia)
    }).pipe(
      switchMap(({ proveedor, novelties, status }) => {
        const contract = toContract(row, proveedor, novelties, status);
        const cesionarioId = currentContractorId(contract);
        if (!cesionarioId) return of(contract);
        // Contratista vigente tras cesión: se sobreescribe con el último cesionario
        // (también su id de proveedor, que es el que viaja en las escrituras).
        return this.proveedorPorId(cesionarioId).pipe(
          map(cesionario =>
            cesionario
              ? {
                  ...contract,
                  contractorName: cesionario.NomProveedor ?? '',
                  contractorId: String(cesionario.NumDocumento ?? ''),
                  contractorProviderId: String(cesionario.Id ?? contract.contractorProviderId)
                }
              : contract
          )
        );
      })
    );
  }

  /**
   * Último estado registrado del contrato (`contrato_estado`, orden Id desc).
   * El campo `NumeroContrato` del query es en realidad el id principal de
   * `contrato_general` (`row.Id`), no el número humano del contrato.
   */
  private estadoDeContrato(contratoId: number | string | undefined, vigencia: string): Observable<ContractStatus | undefined> {
    if (contratoId === undefined || contratoId === null || contratoId === '' || !vigencia) return of(undefined);
    return this.http
      .get<ContratoEstadoDto[]>(`${this.adm}contrato_estado`, {
        params: { query: `NumeroContrato:${contratoId},Vigencia:${vigencia}`, sortby: 'Id', order: 'desc', limit: 1 }
      })
      .pipe(
        map(rows => toContractStatus(nonEmpty(rows))),
        // Sin registro de estado no se bloquea el contrato: el dominio infiere.
        catchError(() => of(undefined))
      );
  }

  /**
   * Completa el contrato con la fecha real de inicio (acta de inicio) y el nombre
   * del ordenador del gasto vigente en esa fecha.
   *
   * Encadenado porque `ordenadores` se consulta por fecha: primero el acta, luego
   * el ordenador. Si el contrato no tiene ordenador (`OrdenadorGasto: null`) la
   * segunda petición no se hace y el nombre queda vacío, que es lo que las reglas
   * interpretan como "sin ordenador asignado".
   */
  private conActaYOrdenador(contract: Contract, row: ContratoGeneralDto): Observable<Contract> {
    const ordenadorId = ordenadorGastoId(row);
    return this.actaInicio(contract.principalId).pipe(
      switchMap(acta => {
        // Las fechas del acta mandan sobre las aproximaciones (`FechaRegistro` y
        // el cálculo por plazo): son el período realmente pactado.
        const base: Contract = {
          ...contract,
          startDate: toDdMmYyyy(acta.inicio) || contract.startDate,
          endDate: toDdMmYyyy(acta.fin) || undefined
        };
        if (!ordenadorId || !acta.inicio) return of(base);
        // El ordenador vigente se consulta a la fecha de inicio del contrato.
        return this.ordenadorVigente(ordenadorId, `${acta.inicio}T00:00:00Z`).pipe(
          map(ordenador => ({
            ...base,
            spendingManager: ordenador?.NombreOrdenador ?? '',
            spendingManagerDocument: ordenador?.Documento !== undefined ? String(ordenador.Documento) : undefined,
            spendingManagerRole: ordenador?.RolOrdenador || undefined,
            spendingManagerResolution: ordenador?.InfoResolucion || undefined
          }))
        );
      })
    );
  }

  /**
   * Fechas de inicio y fin del acta de inicio (`yyyy-mm-dd`), el período realmente
   * pactado del contrato. El acta no se actualiza con las prórrogas: esas las suma
   * el dominio en `contractEndDate`.
   */
  private actaInicio(contratoId: string): Observable<{ inicio: string; fin: string }> {
    const vacio = { inicio: '', fin: '' };
    if (!contratoId) return of(vacio);
    return this.http
      .get<ActaInicioDto[]>(`${this.adm}acta_inicio`, { params: { query: `NumeroContrato:${contratoId}` } })
      .pipe(
        map(rows => {
          const acta = nonEmpty(rows)[0];
          return acta
            ? { inicio: soloFecha(acta.FechaInicio), fin: soloFecha(acta.FechaFin) }
            : vacio;
        }),
        // Dato de apoyo: si falla, el detalle sigue con las fechas aproximadas.
        catchError(() => of(vacio))
      );
  }

  /** Ordenador del gasto vigente en la fecha dada (`ordenadores`); su nombre y documento van al acta. */
  private ordenadorVigente(ordenadorId: number, fechaIso: string): Observable<OrdenadorDto | undefined> {
    return this.http
      .get<OrdenadorDto[]>(`${this.adm}ordenadores`, {
        params: { query: `IdOrdenador:${ordenadorId},FechaInicio__lte:${fechaIso},FechaFin__gte:${fechaIso}` }
      })
      .pipe(
        map(rows => nonEmpty(rows)[0]),
        catchError(() => of(undefined))
      );
  }

  private proveedorPorId(id: number | string | undefined): Observable<InformacionProveedorDto | null> {
    if (id === undefined || id === null || id === '') return of(null);
    return this.http
      .get<InformacionProveedorDto[]>(`${this.adm}informacion_proveedor`, { params: { query: `Id:${id}` } })
      .pipe(
        map(rows => nonEmpty(rows)[0] ?? null),
        catchError(() => of(null))
      );
  }

  private novedadesDeContrato(numero: string, vigencia: string): Observable<NoveltySummary[]> {
    if (!numero || !vigencia) return of([]);
    return this.http.get<AlertResponse<NovedadMidDto[]>>(`${this.mid}novedad/${numero}/${vigencia}`).pipe(
      map(res => (Array.isArray(res?.Body) ? toNoveltySummaries(res.Body) : [])),
      // Sin novedades (o error del mid) no debe tumbar la fila del contrato.
      catchError(() => of<NoveltySummary[]>([]))
    );
  }
}

/** Id compuesto `${numero}_${vigencia}` generado por el mapper. */
function splitContractId(id: string): { numero: string; vigencia: string } {
  const sep = id.lastIndexOf('_');
  return sep > 0 ? { numero: id.slice(0, sep), vigencia: id.slice(sep + 1) } : { numero: id, vigencia: '' };
}

/** El mid responde 200 con `{Type:"ERROR"}` en fallos de negocio: no basta el status HTTP. */
/**
 * Respuesta de `PATCH {mid}novedad/{id}`: puede venir en la forma de `utils_oas`
 * (`{Success, Status, Message}`) o en el envoltorio `Alert` del resto del mid.
 * Cuál de las dos es, no está confirmado — el endpoint no tiene traza.
 */
type RespuestaAnulacion = ApiResponseDto & AlertResponse<unknown>;

/**
 * ¿La respuesta niega la anulación?
 *
 * Se comprueban **las dos formas** posibles y basta que una niegue. Antes solo se
 * miraba `Success !== false`, así que un `Alert` de error (donde `Success` llega
 * `undefined`) pasaba por éxito: el usuario veía "novedad anulada" sin que se
 * hubiera anulado — el mismo fallo silencioso que tiene hoy el registro de póliza.
 *
 * Una respuesta que no diga nada (vacía, o con una forma que no es ninguna de las
 * dos) se acepta a propósito: el camino feliz está probado en funcionamiento y no
 * se rompe por una forma no documentada. Cuando exista la traza (P0-6 del plan de
 * trabajo), esto se reduce a la comprobación de la forma real.
 */
export function anulacionRechazada(res: RespuestaAnulacion | null | undefined): boolean {
  if (!res) return false;
  if (res.Success === false || Number(res.Status) >= 400) return true;
  // El `Alert` solo se juzga si la respuesta trae sus marcas; si no, no aplica.
  return (res.Type !== undefined || res.Code !== undefined) && !esAlertaExitosa(res);
}

function esAlertaExitosa(res: AlertResponse<unknown> | null | undefined): boolean {
  if (!res) return false;
  const type = (res.Type ?? '').toUpperCase();
  const code = String(res.Code ?? '');
  return type !== 'ERROR' && !code.startsWith('4') && !code.startsWith('5');
}

function alertaError(res: AlertResponse<unknown> | null | undefined): string {
  return `El servicio de novedades rechazó la operación (código ${res?.Code ?? 'desconocido'}).`;
}

/** Los CRUD legados devuelven `[{}]` cuando no hay filas: se filtran los objetos vacíos. */
function nonEmpty<T extends object>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).filter(r => r && Object.keys(r).length > 0);
}

/** Vigencia del contrato tal como la entrega el backend. */
function vigenciaOf(row: ContratoGeneralDto): number {
  return Number(row.VigenciaContrato ?? row.Vigencia) || 0;
}

/** Parte de fecha (`yyyy-mm-dd`) de un timestamp del backend, sin la hora. */
function soloFecha(value: unknown): string {
  return value ? String(value).slice(0, 10) : '';
}

/** Tiempo máximo de la cascada completa de escritura de una novedad. */
const TIMEOUT_CASCADA_MS = 60_000;

const ERROR_TIMEOUT = 'La operación superó el tiempo límite y se canceló. Verifica si la novedad quedó registrada antes de reintentar.';

/**
 * Se añade al error de réplica cuando la compensación no pudo desactivar la novedad.
 * El usuario tiene que saberlo: a diferencia del caso normal —donde no queda nada
 * registrado—, aquí sí quedó una novedad activa que Ágora/Titan no conoce, y nadie
 * más va a detectarlo.
 */
const ADVERTENCIA_SIN_COMPENSAR =
  'ATENCIÓN: la novedad quedó registrada sin replicar y no se pudo desactivar automáticamente. Repórtelo a soporte con el número de contrato antes de reintentar, o quedará duplicada.';

/**
 * Error que se propaga cuando la réplica falla, según si la compensación pudo
 * deshacer la novedad.
 *
 * Con compensación se propaga el error original tal cual — conserva el
 * `HttpErrorResponse` para que la UI lo describa con su código real. Sin
 * compensación se envuelve, porque el estado del sistema es distinto y el mensaje
 * genérico de réplica fallida mentiría por omisión.
 */
export function errorDeReplica(err: unknown, compensada: boolean): unknown {
  if (compensada) return err;
  return new Error(`${describeApiError(err).detail} ${ADVERTENCIA_SIN_COMPENSAR}`);
}

/**
 * Primer dato del contrato que hace falta para armar los payloads, o `undefined`
 * si están todos. Corta la escritura antes del primer POST en vez de mandar un
 * payload con campos vacíos que el backend aceptaría a medias.
 */
function datoDeContratoFaltante(contract: Contract, draft: NoveltyDraft): string | undefined {
  if (!contract.principalId) return 'el identificador principal';
  if (!contract.contractorProviderId) return 'el identificador del contratista';
  if (!contract.contractorId) return 'el documento del contratista';
  // La réplica de terminación anticipada envía el plazo del contrato; la de
  // reinicio no envía ninguno de los dos (actualiza un registro que ya los tiene);
  // el resto de tipos envían su unidad de ejecución.
  if (draft.type === NoveltyType.EARLY_TERMINATION) {
    return contract.executionTerm ? undefined : 'el plazo de ejecución';
  }
  if (draft.type === NoveltyType.RESTART) return undefined;
  return contract.executionUnitId ? undefined : 'la unidad de ejecución';
}

/** Nombre del estado vigente que encabeza el cuerpo de `validarCambioEstado`. */
function nombreEstado(row: ContratoEstadoDto | undefined): string {
  const nombre =
    row?.NombreEstado ??
    (typeof row?.Estado === 'object' ? row?.Estado?.NombreEstado : typeof row?.Estado === 'string' ? row.Estado : '');
  return String(nombre ?? '');
}

/**
 * UUID del documento recién subido a `gestor_documental`.
 *
 * ponytail: la forma exacta de la respuesta no está documentada, así que se
 * buscan los nombres conocidos y, como red de seguridad, cualquier UUID del
 * cuerpo. Fijar el nombre real cuando el backend lo documente.
 */
function extraerEnlace(body: unknown): string {
  const row = Array.isArray(body) ? body[0] : body;
  const candidato = (row as Record<string, unknown> | null)?.['Enlace']
    ?? (row as Record<string, unknown> | null)?.['enlace']
    ?? (row as Record<string, unknown> | null)?.['uuid']
    ?? (row as Record<string, unknown> | null)?.['Uuid'];
  if (typeof candidato === 'string' && candidato) return candidato;
  if (typeof row === 'string' && row) return row;
  const uuid = JSON.stringify(body ?? '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return uuid?.[0] ?? '';
}

/**
 * Id de la novedad recién creada, necesario para compensar si la réplica falla.
 * El mid devuelve la respuesta del CRUD (`trNovedad`), que anida el registro en
 * `NovedadPoscontractual`; se leen ambas formas por si viene aplanada.
 */
function extraerNovedadId(body: unknown): string | undefined {
  const row = (Array.isArray(body) ? body[0] : body) as Record<string, unknown> | null;
  if (!row) return undefined;
  const anidada = row['NovedadPoscontractual'] as Record<string, unknown> | undefined;
  const id = anidada?.['Id'] ?? row['Id'] ?? row['id'];
  return id === undefined || id === null || id === '' ? undefined : String(id);
}

/**
 * Estado al que debe volver el contrato tras anular una novedad, o `null` si el que
 * deja el mid ("En ejecución") ya es el correcto.
 *
 * Solo el reinicio necesita corrección: anularlo devuelve el contrato a la
 * suspensión que había levantado.
 */
export function estadoTrasAnulacion(type: NoveltyType): number | null {
  return type === NoveltyType.RESTART ? ESTADO_CONTRATO_ID.SUSPENDIDO : null;
}

/** Sin dato: el acta imprime su propio marcador cuando el CDP/CRP no llega. */
const SIN_CDP_RP: CdpRp = { cdp: '', rp: '' };

/**
 * Ruta del histórico de CDP/RP de un contrato en `financiera_jbpm`.
 *
 * La unidad ejecutora va a cuatro dígitos (1 → "0001"). El `12` final es fijo: el
 * cliente legado lo escribe así en las tres actas que consultan este servicio y su
 * significado no está documentado en ninguna parte (`info/backend/endpoints_legacy.md`).
 */
export function rutaCdpRp(numero: string, vigencia: string, unidadEjecutora?: number): string {
  const unidad = String(unidadEjecutora ?? 1).padStart(4, '0');
  return `cdprptercerocontrato/${vigencia}/${numero}/${unidad}/12`;
}

/**
 * CDP y RP **vigentes**: el último registro del histórico, mismo criterio que el
 * cliente legado (el servicio los devuelve en orden cronológico).
 */
export function cdpRpVigente(res: CdpRpTerceroDto | null | undefined): CdpRp {
  const filas = res?.cdp_rp_tercero?.cdp_rp ?? [];
  const ultima = filas[filas.length - 1];
  return { cdp: String(ultima?.cdp ?? ''), rp: String(ultima?.rp ?? '') };
}

/**
 * Dependencia de la Oficina de Contratación en `supervisor_contrato`. Es un dato
 * institucional fijo: su jefe es quien aprueba todas las actas.
 */
const DEPENDENCIA_OFICINA_CONTRATACION = 'DEP636';

/** Nombre completo de una persona natural, a partir de sus cuatro campos. */
function nombreCompleto(p: InformacionPersonaNaturalDto | undefined): string {
  if (!p) return '';
  const partes = [p.PrimerNombre, p.SegundoNombre, p.PrimerApellido, p.SegundoApellido];
  return aNombrePropio(partes.filter(Boolean).join(' '));
}

/**
 * "LAURA NIÑO" → "Laura Niño". Estos dos nombres van en el cuadro de firmas del
 * acta, donde el formato institucional los escribe en nombre propio; el backend
 * los devuelve en mayúsculas. No se toca el resto de nombres del acta (contratista,
 * ordenador), que se imprimen tal como los entrega Ágora.
 */
export function aNombrePropio(nombre: string): string {
  return nombre
    .toLocaleLowerCase('es-CO')
    .replace(/(^|\s)(\p{L})/gu, (_, sep: string, letra: string) => sep + letra.toLocaleUpperCase('es-CO'))
    .trim();
}
