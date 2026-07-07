import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, delay, map, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { ContractFilters, IContractRepository } from '../domain/repositories/contract.repository';
import { Contract, NoveltySummary } from '../domain/models/contract.entity';
import { Assignee } from '../domain/models/assignee.model';
import { NoveltyDraft } from '../domain/models/novelty-draft.model';
import { AlertResponse, ContratoGeneralDto, InformacionProveedorDto, NovedadMidDto } from './dtos/legacy-api.dto';
import { toAssignee, toContract, toNoveltySummaries } from './mappers/contract.mapper';

/**
 * Repositorio contra las APIs institucionales (administrativa_amazon_api + novedades_mid).
 * Solo las lecturas están conectadas; las escrituras (crear/anular novedad) siguen
 * simuladas hasta que se aborde esa fase.
 */
@Injectable({ providedIn: 'root' })
export class HttpContractService implements IContractRepository {
  private readonly http = inject(HttpClient);
  private readonly adm = environment.ADMINISTRATIVA_PRUEBAS_SERVICE;
  private readonly mid = environment.NOVEDADES_MID_SERVICE;

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
    // Id compuesto `${numero}_${vigencia}` generado por el mapper.
    const sep = id.lastIndexOf('_');
    const numero = sep > 0 ? id.slice(0, sep) : id;
    const vigencia = sep > 0 ? id.slice(sep + 1) : '';
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

  createNovelty(contractId: string, draft: NoveltyDraft): Observable<void> {
    // TODO(escrituras): POST {novedadesMid}novedad/ — pendiente; por ahora solo lecturas.
    return of(undefined).pipe(
      delay(400),
      tap(() => console.warn('[HttpContractService] createNovelty aún no conectado', contractId, draft))
    );
  }

  annulNovelty(contractId: string, noveltyId: string): Observable<void> {
    // TODO(escrituras): PATCH {novedadesMid}novedad/{id} — pendiente; por ahora solo lecturas.
    return of(undefined).pipe(
      delay(400),
      tap(() => console.warn('[HttpContractService] annulNovelty aún no conectado', contractId, noveltyId))
    );
  }

  // --- Privados ---

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

  /** Completa una fila de contrato con el nombre del contratista y sus novedades. */
  private toDomain(row: ContratoGeneralDto): Observable<Contract> {
    const suscrito = row.ContratoSuscrito?.[0];
    const numero = String(suscrito?.NumeroContratoSuscrito ?? row.NumeroContrato ?? '');
    const vigencia = String(row.VigenciaContrato ?? row.Vigencia ?? suscrito?.Vigencia ?? '');
    const contratistaId = typeof row.Contratista === 'object' ? row.Contratista?.Id : row.Contratista;
    return forkJoin({
      proveedor: this.proveedorPorId(contratistaId),
      novelties: this.novedadesDeContrato(numero, vigencia)
    }).pipe(map(({ proveedor, novelties }) => toContract(row, proveedor, novelties)));
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

/** Los CRUD legados devuelven `[{}]` cuando no hay filas: se filtran los objetos vacíos. */
function nonEmpty<T extends object>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).filter(r => r && Object.keys(r).length > 0);
}

/** Vigencia del contrato tal como la entrega el backend. */
function vigenciaOf(row: ContratoGeneralDto): number {
  return Number(row.VigenciaContrato ?? row.Vigencia) || 0;
}
