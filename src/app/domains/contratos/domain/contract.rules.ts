import { Contract, NoveltySummary } from './models/contract.entity';
import { NoveltyType } from './models/novelty-type.enum';

/** Primer año con contratos en el sistema. */
const PRIMERA_VIGENCIA = 2015;

/** Vigencias seleccionables, del año actual hacia atrás hasta la primera registrada. */
export function availableVigencias(): string[] {
  const current = new Date().getFullYear();
  return Array.from({ length: current - PRIMERA_VIGENCIA + 1 }, (_, i) => String(current - i));
}

/** Convierte una fecha dd/mm/yyyy en epoch para poder comparar cronológicamente. */
function parseExpeditionDate(date: string): number {
  const [d, m, y] = date.split('/').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime();
}

/** Última novedad del contrato según su fecha de expedición. */
export function getLatestNovelty(contract: Contract): NoveltySummary | undefined {
  if (!contract.novelties.length) return undefined;
  return contract.novelties.reduce((latest, current) =>
    parseExpeditionDate(current.expeditionDate) >= parseExpeditionDate(latest.expeditionDate)
      ? current
      : latest
  );
}

/**
 * Un contrato está suspendido cuando su última novedad es de tipo Suspensión.
 * (Un posterior Reinicio vuelve a dejar la última novedad en otro tipo.)
 */
export function isContractSuspended(contract: Contract): boolean {
  return getLatestNovelty(contract)?.type === NoveltyType.SUSPENSION;
}
