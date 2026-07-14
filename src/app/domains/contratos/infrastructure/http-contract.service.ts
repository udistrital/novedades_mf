import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { ContractFilters, IContractRepository } from '../domain/repositories/contract.repository';
import { Contract, NoveltySummary } from '../domain/models/contract.entity';
import { ContractStatus } from '../domain/models/contract-status.enum';
import { Assignee } from '../domain/models/assignee.model';
import { NoveltyDraft } from '../domain/models/novelty-draft.model';
import { Aseguradora, Poliza, PolizaUpdate } from '../domain/models/poliza.model';
import { currentContractorId } from '../domain/contract.rules';
import { UserSessionService } from '../../../shared/auth/user-session.service';
import {
  AlertResponse,
  ApiResponseDto,
  ContratoEstadoDto,
  ContratoGeneralDto,
  EntidadAseguradoraDto,
  EstadoContratoDto,
  InformacionProveedorDto,
  NovedadMidDto,
  PolizaDto
} from './dtos/legacy-api.dto';
import {
  toAseguradora,
  toAssignee,
  toContract,
  toContractStatus,
  toNoveltySummaries,
  toPoliza
} from './mappers/contract.mapper';
import {
  targetStateId,
  toCambioEstadoPayload,
  toNoveltyPayload
} from './mappers/novelty-payload.mapper';

/**
 * Repositorio contra las APIs institucionales (administrativa_amazon_api,
 * novedades_mid, novedades_crud y core_amazon_crud).
 *
 * Escrituras: el flujo replica la coreografía del cliente legado
 * (validar cambio de estado → crear novedad → registrar estado) SIN la réplica
 * hacia Ágora/Titan ni su compensación manual — esa orquestación queda del
 * lado del backend según TD-007/ADR-014.
 */
@Injectable({ providedIn: 'root' })
export class HttpContractService implements IContractRepository {
  private readonly http = inject(HttpClient);
  private readonly session = inject(UserSessionService);
  private readonly adm = environment.ADMINISTRATIVA_PRUEBAS_SERVICE;
  private readonly mid = environment.NOVEDADES_MID_SERVICE;
  private readonly crud = environment.NOVEDADES_SERVICE;
  private readonly core = environment.CORE_AMAZON_SERVICE;

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

  getContractById(id: string): Observable<Contract | undefined> {
    const { numero, vigencia } = splitContractId(id);
    return this.contratosPorQuery(`ContratoSuscrito.NumeroContratoSuscrito:${numero}`, vigencia).pipe(
      switchMap(rows => (rows.length ? this.toDomain(rows[0]) : of(undefined)))
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
   * Crea la novedad replicando la cascada del legado: (1) para las novedades
   * que cambian el estado del contrato, valida primero la transición en el mid;
   * (2) POST de la novedad; (3) registra el nuevo estado en Ágora — deshabilitado
   * por ahora (ver comentario en el paso 3): `administrativa_amazon_api` es la
   * misma URL en todos los ambientes, no hay instancia de pruebas separada.
   * Sin réplica a Titan ni compensación (TD-007/ADR-014).
   */
  createNovelty(contractId: string, draft: NoveltyDraft): Observable<void> {
    const { numero, vigencia } = splitContractId(contractId);
    const usuario = this.session.usuarioRegistro();
    const estadoDestino = targetStateId(draft);

    const validar$ = estadoDestino !== null
      ? this.validarCambioEstado(estadoDestino, numero, vigencia, usuario)
      : of(undefined);

    return validar$.pipe(
      switchMap(() =>
        this.http.post<AlertResponse<unknown>>(`${this.mid}novedad/`, toNoveltyPayload(draft, numero, vigencia, usuario))
      ),
      switchMap(res => (esAlertaExitosa(res) ? of(undefined) : throwError(() => new Error(alertaError(res))))),
      switchMap(() => {
        // Paso 3 deshabilitado: `administrativa_amazon_api` (contrato_estado) apunta a
        // datos reales en todos los ambientes. Descomentar al pasar a producción.
        // return estadoDestino !== null ? this.registrarEstado(estadoDestino, numero, vigencia, usuario) : of(undefined);
        return of(undefined);
      }),
      map(() => undefined)
    );
  }

  /**
   * Anula la novedad vía PATCH del mid: el backend marca `Activo=false` y
   * revierte el estado del contrato en cascada (AnularNovedadYRevertirEstado).
   */
  annulNovelty(_contractId: string, noveltyId: string): Observable<void> {
    return this.http
      .patch<ApiResponseDto>(`${this.mid}novedad/${noveltyId}`, { usuario: this.session.usuarioRegistro() })
      .pipe(
        switchMap(res =>
          res?.Success !== false ? of(undefined) : throwError(() => new Error(res?.Message || 'Anulación rechazada'))
        )
      );
  }

  /**
   * Reapertura administrativa (contrato Finalizado → En ejecución): resuelve el
   * id del estado "En ejecución" en el catálogo (`estado_contrato`) y valida el
   * cambio. El registro en Ágora (`POST contrato_estado`) queda deshabilitado
   * por ahora (ver comentario abajo): esa URL es la misma en todos los
   * ambientes, no hay instancia de pruebas separada.
   */
  activateContract(contractId: string): Observable<void> {
    const { numero, vigencia } = splitContractId(contractId);
    const usuario = this.session.usuarioRegistro();
    return this.estadoContratoId('En ejecucion').pipe(
      switchMap(estadoId => {
        if (estadoId === undefined) {
          return throwError(() => new Error('No se encontró el estado "En ejecución" en el catálogo.'));
        }
        return this.validarCambioEstado(estadoId, numero, vigencia, usuario).pipe(
          switchMap(() => {
            // Deshabilitado: `administrativa_amazon_api` (contrato_estado) apunta a datos
            // reales en todos los ambientes. Descomentar al pasar a producción.
            // return this.registrarEstado(estadoId, numero, vigencia, usuario);
            return of(undefined);
          })
        );
      })
    );
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

  updatePoliza(polizaId: string, cambios: PolizaUpdate): Observable<void> {
    // El registro lo crea la cesión; el acta de inicio solo lo completa (PUT, no POST).
    return this.http
      .put(`${this.crud}poliza/${polizaId}`, {
        EntidadAseguradoraId: cambios.entidadAseguradoraId,
        NumeroPolizaId: cambios.numeroPoliza
      })
      .pipe(map(() => undefined));
  }

  // --- Privados ---

  /** Id de un estado del catálogo `estado_contrato` a partir de su nombre (p. ej. "En ejecucion"). */
  private estadoContratoId(nombreEstado: string): Observable<number | undefined> {
    return this.http
      .get<EstadoContratoDto[]>(`${this.adm}estado_contrato`, { params: { query: `NombreEstado:${nombreEstado}` } })
      .pipe(
        map(rows => nonEmpty(rows)[0]?.Id),
        catchError(() => of(undefined))
      );
  }

  private validarCambioEstado(estadoId: number, numero: string, vigencia: string, usuario: string): Observable<void> {
    return this.http
      .post<AlertResponse<unknown>>(`${this.mid}validarCambioEstado/`, toCambioEstadoPayload(estadoId, numero, vigencia, usuario))
      .pipe(
        switchMap(res => (esAlertaExitosa(res) ? of(undefined) : throwError(() => new Error(alertaError(res)))))
      );
  }

  private registrarEstado(estadoId: number, numero: string, vigencia: string, usuario: string): Observable<void> {
    return this.http
      .post(`${this.adm}contrato_estado`, toCambioEstadoPayload(estadoId, numero, vigencia, usuario))
      .pipe(map(() => undefined));
  }

  private contratosPorQuery(baseQuery: string, year?: string): Observable<ContratoGeneralDto[]> {
    const query = year ? `${baseQuery},VigenciaContrato:${year}` : baseQuery;
    return this.http
      .get<ContratoGeneralDto[]>(`${this.adm}contrato_general/`, { params: { query } })
      .pipe(map(nonEmpty), catchError(() => of([])));
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
        // Contratista vigente tras cesión: se sobreescribe con el último cesionario.
        return this.proveedorPorId(cesionarioId).pipe(
          map(cesionario =>
            cesionario
              ? { ...contract, contractorName: cesionario.NomProveedor ?? '', contractorId: String(cesionario.NumDocumento ?? '') }
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
