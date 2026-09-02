import { Observable } from 'rxjs';
import { Contract } from '../models/contract.entity';
import { NoveltyDraft } from '../models/novelty-draft.model';
import { NoveltyDocument } from '../models/novelty-document.model';

/**
 * Puerto de generación del acta de una novedad: recibe el contrato y la solicitud
 * y devuelve el documento ya armado.
 *
 * Es una abstracción deliberada, no especulativa: el servicio que la implementa
 * hoy (`actas_novedad_mid`) es **temporal** y va a reemplazarse. El dominio y la
 * aplicación solo conocen esta firma, así que el reemplazo se limita a escribir
 * otra implementación en `infrastructure/` y cambiar el binding de `app.config.ts`
 * — sin tocar formularios, casos de uso ni reglas.
 *
 * Se declara como clase abstracta porque Angular la usa además como token de DI
 * (mismo patrón que `IContractRepository`).
 */
export abstract class IActaGenerator {
  /**
   * Genera el acta de la novedad que está por registrarse.
   *
   * @param contract Contrato afectado, con sus datos maestros y novedades previas.
   * @param draft Solicitud tal como la capturó el formulario.
   * @param opciones Datos del documento que no salen del contrato ni de la
   * solicitud: quiénes lo tramitan y cómo se imprime.
   */
  abstract generarActa(
    contract: Contract,
    draft: NoveltyDraft,
    opciones?: ActaOptions
  ): Observable<NoveltyDocument>;
}

/** Ajustes del documento, independientes del contrato y de la novedad. */
export interface ActaOptions {
  /** Nombre de quien elabora el acta (usuario en sesión). */
  elaboro?: string;
  /** Nombre del jefe de la Oficina de Contratación, que la aprueba. */
  jefeJuridica?: string;
  /** Tamaño de letra del cuerpo del documento, en puntos. */
  tamanoLetra?: number;
  /** Certificado de Disponibilidad Presupuestal vigente, del encabezado del acta. */
  cdp?: string;
  /** Registro presupuestal vigente; el acta lo rotula "CRP". */
  rp?: string;
}
