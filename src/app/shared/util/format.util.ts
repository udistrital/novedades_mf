/** Fecha actual en formato yyyy-mm-dd, valor por defecto de un <input type="date">. */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Convierte una fecha ISO (yyyy-mm-dd de un <input type="date">) a dd/mm/yyyy. */
export function toDisplayDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Parsea una fecha en dd/mm/yyyy (contratos) o yyyy-mm-dd (formularios) a Date local. */
function parseAnyDate(date: string): Date {
  if (date.includes('/')) {
    const [d, m, y] = date.split('/').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Suma (o resta) días a una fecha dd/mm/yyyy o yyyy-mm-dd; devuelve yyyy-mm-dd. */
export function addDaysToDate(date: string | null | undefined, days: number): string {
  if (!date) return '';
  const d = parseAnyDate(date);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Normaliza una fecha (dd/mm/yyyy del backend o yyyy-mm-dd) al formato que exige
 * un `<input type="date">`. Inverso de `toDisplayDate`.
 */
export function toIsoDate(date: string | null | undefined): string {
  return addDaysToDate(date, 0);
}

/** Días entre dos fechas (dateB - dateA); null si falta alguna. */
export function daysBetween(dateA: string | null | undefined, dateB: string | null | undefined): number | null {
  if (!dateA || !dateB) return null;
  const ms = parseAnyDate(dateB).getTime() - parseAnyDate(dateA).getTime();
  return Math.round(ms / 86_400_000);
}

/** Formatea un valor numérico como pesos colombianos: $1.451.000.000. */
export function formatCop(value: number | null | undefined): string {
  const n = Number(value) || 0;
  return `$${n.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIECIS = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const VEINTIS = ['VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

/** Convierte 0-999 a letras (sin apócope de "uno"; se resuelve en el llamador según el contexto). */
function hundredsToWords(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100), resto = n % 100;
  const centena = c ? CENTENAS[c] : '';
  let decena: string;
  if (resto < 10) decena = UNIDADES[resto];
  else if (resto < 20) decena = DIECIS[resto - 10];
  else if (resto < 30) decena = VEINTIS[resto - 20];
  else {
    const d = Math.floor(resto / 10), u = resto % 10;
    decena = u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d];
  }
  return [centena, decena].filter(Boolean).join(' ');
}

/** "UNO" pierde la "O" final delante de un sustantivo (UN millón, VEINTIÚN mil). */
function apocopado(words: string): string {
  if (words.endsWith('VEINTIUNO')) return words.slice(0, -3) + 'ÚN';
  if (words.endsWith('UNO')) return words.slice(0, -1);
  return words;
}

/** Convierte 0-999.999 a letras, componiendo el grupo de miles sobre `hundredsToWords`. */
function belowMillionToWords(n: number): string {
  if (n < 1000) return hundredsToWords(n);
  const miles = Math.floor(n / 1000), resto = n % 1000;
  const milesWords = miles === 1 ? 'MIL' : `${apocopado(hundredsToWords(miles))} MIL`;
  return resto > 0 ? `${milesWords} ${hundredsToWords(resto)}` : milesWords;
}

/** Convierte un entero no negativo a letras en español (hasta ~999.999 millones). */
export function numberToWords(value: number): string {
  const n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return 'CERO';

  const millones = Math.floor(n / 1_000_000);
  const resto = n % 1_000_000;

  const partes: string[] = [];
  if (millones === 1) partes.push('UN MILLÓN');
  else if (millones > 1) partes.push(`${apocopado(belowMillionToWords(millones))} MILLONES`);

  if (resto > 0) partes.push(belowMillionToWords(resto));

  return partes.join(' ');
}

/** Valor en letras para actas: "TREINTA Y TRES MILLONES OCHOCIENTOS TREINTA Y OCHO MIL NOVECIENTOS PESOS". */
export function formatCopWords(value: number | null | undefined): string {
  return `${numberToWords(Number(value) || 0)} PESOS`;
}

/** Regla contable del negocio: un mes equivale siempre a 30 días, sin importar el mes calendario. */
export const DIAS_POR_MES = 30;

/** Grupos "( n ) UNIDAD" de un plazo: "NUEVE ( 9 ) MESES Y QUINCE ( 15 ) DÍAS" → dos grupos. */
const GRUPOS_PLAZO = /\(\s*(-?\d+)\s*\)\s*(MES(?:ES)?|D[ÍI]AS?)/gi;

/** Extrae el número de un plazo sin unidad reconocible ("NUEVE ( 9 )"), que se asume en meses. */
function parseMonthsTerm(term: string | null | undefined): number {
  return Number((term ?? '').match(/\(\s*(-?\d+)\s*\)/)?.[1]) || 0;
}

/**
 * Plazo total en días de un término "NUEVE ( 9 ) MESES [Y QUINCE ( 15 ) DÍAS]",
 * aplicando la regla mes = 30 días. Si la unidad de un grupo es DÍAS
 * (contratos pactados en días), no multiplica por 30.
 *
 * Es la **única** lectura de un plazo en el proyecto: cualquier cálculo sobre
 * plazos parte de aquí. `addDaysToTerm` la usaba a medias y por eso un contrato
 * pactado en días salía multiplicado por 30.
 */
export function termToDays(term: string | null | undefined): number {
  const t = term ?? '';
  const grupos = [...t.matchAll(GRUPOS_PLAZO)];
  if (!grupos.length) return parseMonthsTerm(t) * DIAS_POR_MES;
  return grupos.reduce((total, [, n, unidad]) =>
    total + Number(n) * (unidad.toUpperCase().startsWith('MES') ? DIAS_POR_MES : 1), 0);
}

const PLURAL_PLAZO = { MES: 'MESES', 'DÍA': 'DÍAS' } as const;

/** Un grupo del plazo en el formato del negocio: "QUINCE ( 15 ) DÍAS". */
function grupoPlazo(n: number, singular: keyof typeof PLURAL_PLAZO): string {
  return `${numberToWords(n)} ( ${n} ) ${n === 1 ? singular : PLURAL_PLAZO[singular]}`;
}

/**
 * Plazo en el formato del negocio a partir de sus días: "DIEZ ( 10 ) MESES Y
 * QUINCE ( 15 ) DÍAS", con la regla mes = 30 días.
 *
 * **Única forma de mostrar un plazo**, en pantalla y en las actas. Ágora los guarda
 * en la unidad con que se pactó cada contrato —unos en meses, otros en días— y eso
 * llegaba tal cual a la vista: dos contratos de la misma duración se leían distinto
 * ("TRESCIENTOS QUINCE ( 315 ) DÍAS" frente a "DIEZ ( 10 ) MESES Y QUINCE ( 15 ) DÍAS").
 * La unidad de origen se conserva en el dato numérico (`executionTerm`, `plazo_dias`),
 * no en el texto.
 *
 * Los meses se imprimen siempre, aunque sean cero: "CERO ( 0 ) MESES Y VEINTICUATRO
 * ( 24 ) DÍAS" deja claro que el plazo es corto, y no que se perdió la parte de meses.
 */
export function formatTerm(totalDays: number | null | undefined): string {
  const total = Math.max(0, Math.floor(Number(totalDays) || 0));
  const meses = grupoPlazo(Math.floor(total / DIAS_POR_MES), 'MES');
  const dias = total % DIAS_POR_MES;
  return dias === 0 ? meses : `${meses} Y ${grupoPlazo(dias, 'DÍA')}`;
}

/**
 * Duración de un período del negocio: regla contable mes = 30 días y **ambos
 * extremos incluidos** (el primer y el último día cuentan).
 *
 * No es `daysBetween`, que cuenta días de calendario: esta es la cuenta del negocio,
 * la que el backend guarda en `periodosuspension` y la que se imprime como plazo en
 * las actas. Confirmada con las dos trazas del contrato 653/2025
 * (`docs/endpoints_registrados.md`): 10/02→05/03 = 26 y 08/02→26/03 = 49.
 *
 * Se aplica **también a las suspensiones**: se evaluó contarlas en días de calendario
 * (darían 24 donde el legado registra 26) y negocio decidió el **2026-08-29** mantener
 * la regla del legado, por fidelidad con el sistema en producción y con las actas ya
 * emitidas. Ver [ADR-012](../../../../docs/adr/ADR-012-regla-mes-30-dias.md).
 */
export function periodDays(
  inicio: string | null | undefined,
  fin: string | null | undefined
): number | null {
  if (!inicio || !fin) return null;
  const a = parseAnyDate(inicio);
  const b = parseAnyDate(fin);
  const meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return meses * DIAS_POR_MES + (b.getDate() - a.getDate()) + 1;
}

/**
 * Suma días de prórroga a un plazo y lo devuelve en el formato del negocio.
 *
 * Lee con `termToDays` (que respeta la unidad de cada grupo) y formatea con
 * `formatTerm`: el resultado sale en meses y días sea cual sea la unidad de origen.
 * Antes conservaba la unidad del plazo pactado, y un contrato en días seguía
 * mostrando su nuevo plazo en días.
 */
export function addDaysToTerm(initialTerm: string | null | undefined, extraDays: number | null | undefined): string {
  return formatTerm(termToDays(initialTerm) + (Number(extraDays) || 0));
}

/** Puntos de separación visuales para NIT/CC, agrupando de a 3 desde el último dígito: 80732423 → 80.732.423. */
export function formatDocument(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Fecha y hora de ejecución legible: "24 de mayo de 2024 - 10:45 a. m.". */
export function formatExecutionDate(d: Date = new Date()): string {
  const date = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  return `${date} - ${time}`;
}
