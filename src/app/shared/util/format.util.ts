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
const DIAS_POR_MES = 30;

/** Extrae el número de meses de un plazo con formato "NUEVE ( 9 ) MESES". */
function parseMonthsTerm(term: string | null | undefined): number {
  return Number((term ?? '').match(/\(\s*(-?\d+)\s*\)/)?.[1]) || 0;
}

/**
 * Suma días de prórroga a un plazo inicial ("NUEVE ( 9 ) MESES") y devuelve el nuevo
 * plazo en el mismo formato, aplicando la regla de mes = 30 días.
 */
export function addDaysToTerm(initialTerm: string | null | undefined, extraDays: number | null | undefined): string {
  const totalDays = parseMonthsTerm(initialTerm) * DIAS_POR_MES + (Number(extraDays) || 0);
  const months = Math.floor(totalDays / DIAS_POR_MES);
  const days = totalDays % DIAS_POR_MES;

  const monthsPart = `${numberToWords(months)} ( ${months} ) ${months === 1 ? 'MES' : 'MESES'}`;
  return days === 0 ? monthsPart : `${monthsPart} Y ${numberToWords(days)} ( ${days} ) ${days === 1 ? 'DÍA' : 'DÍAS'}`;
}

/** Puntos de separación visuales para NIT/CC: 80732423 → 807.324.23. */
export function formatDocument(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '').match(/.{1,3}/g)?.join('.') ?? '';
}

/** Fecha y hora de ejecución legible: "24 de mayo de 2024 - 10:45 a. m.". */
export function formatExecutionDate(d: Date = new Date()): string {
  const date = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  return `${date} - ${time}`;
}
