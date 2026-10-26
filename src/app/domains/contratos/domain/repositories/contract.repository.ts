import { Observable } from 'rxjs';
import { Contract } from '../models/contract.entity';
import { NoveltyDraft } from '../models/novelty-draft.model';
import { NoveltyType } from '../models/novelty-type.enum';
import { NoveltyDocument } from '../models/novelty-document.model';
import { Assignee } from '../models/assignee.model';
import { Aseguradora, Poliza, PolizaUpdate } from '../models/poliza.model';

/** Criterios de búsqueda del dashboard; `number` y `contractor` son excluyentes entre sí. */
export interface ContractFilters {
  number?: string;
  contractor?: string;
  year?: string;
}

/**
 * Puerto de acceso a contratos y novedades (patrón repositorio de DDD).
 *
 * Clase abstracta en lugar de interface para poder usarse como token de DI:
 * la implementación activa (`HttpContractService`) se registra en
 * `app.config.ts`. Las capas de aplicación y presentación solo dependen de
 * esta abstracción.
 */
export abstract class IContractRepository {
  abstract getContracts(filters?: ContractFilters): Observable<Contract[]>;
  abstract getContractById(id: string): Observable<Contract | undefined>;
  /**
   * Registra la novedad con la cascada completa.
   *
   * @param actaBase64 PDF del acta ya generado, para archivarlo en el gestor
   * documental. Se genera **antes** de la cascada (ADR-018), así que llega hecho, y
   * lo archivan los cinco tipos de novedad: es lo que hace funcionar "Ver acta".
   */
  abstract createNovelty(contractId: string, draft: NoveltyDraft, actaBase64?: string): Observable<void>;
  /**
   * Anula la novedad y deja el contrato en el estado que corresponde.
   *
   * @param type Tipo de la novedad anulada: decide a qué estado vuelve el
   * contrato. El mid revierte siempre a "En ejecución", que es incorrecto para el
   * reinicio (ver `HttpContractService.estadoTrasAnular`).
   */
  abstract annulNovelty(contractId: string, noveltyId: string, type: NoveltyType): Observable<void>;
  /** Busca contratistas por cédula/NIT para el autocomplete (cédula + nombre). */
  /**
   * Vigencias (años) con contratos en el sistema, de la más reciente a la más
   * antigua. Es un catálogo del backend, no un rango calculado: crece solo al
   * empezar cada año y solo él sabe hasta dónde llega el histórico.
   */
  abstract getVigencias(): Observable<string[]>;
  abstract searchContractors(query: string): Observable<Assignee[]>;
  /** Descarga el acta de una novedad desde el gestor documental. */
  abstract getNoveltyDocument(documentId: string): Observable<NoveltyDocument>;
  /** Reapertura administrativa de un contrato Finalizado: lo devuelve a "En ejecución". */
  abstract activateContract(contractId: string): Observable<void>;
  /** Catálogo de entidades aseguradoras (registro de póliza post-cesión). */
  abstract getAseguradoras(): Observable<Aseguradora[]>;
  /** Póliza asociada a una novedad (la cesión crea el registro; el acta de inicio lo completa). */
  abstract getPolizaDeNovedad(noveltyId: string): Observable<Poliza | undefined>;
  /** Completa/actualiza el registro de póliza existente. */
  abstract updatePoliza(polizaId: string, cambios: PolizaUpdate): Observable<void>;

  /**
   * Quiénes tramitan el acta: quien la elabora (el usuario en sesión) y quien la
   * aprueba (el jefe de la Oficina de Contratación). No dependen del contrato ni
   * de la novedad, pero el acta los imprime en su cuadro de firmas.
   */
  abstract getActaResponsables(): Observable<ActaResponsables>;

  /**
   * CDP y CRP vigentes del contrato. El acta los imprime en su encabezado y no
   * salen de Ágora: viven en el sistema financiero.
   */
  abstract getCdpRp(contract: Contract): Observable<CdpRp>;
}

/**
 * Certificados presupuestales que encabezan el acta: el de disponibilidad (CDP) y
 * el de registro (RP), que el acta rotula "CRP".
 */
export interface CdpRp {
  cdp: string;
  rp: string;
}

/** Firmantes del cuadro final del acta ("Proyectó" y "Revisó y Aprobó"). */
export interface ActaResponsables {
  /** Nombre de quien elabora el acta: el usuario en sesión. */
  elaboro: string;
  /** Nombre del jefe de la Oficina de Contratación, que la aprueba. */
  jefeJuridica: string;
}
