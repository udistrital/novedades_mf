/** Convierte una fecha ISO (yyyy-mm-dd de un <input type="date">) a dd/mm/yyyy. */
export function toDisplayDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Formatea un valor numérico como pesos colombianos: $1.451.000.000. */
export function formatCop(value: number | null | undefined): string {
  const n = Number(value) || 0;
  return `$${n.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
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
