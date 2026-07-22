// lib/fmt.js  ·  formateo compartido (cliente y servidor)

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** '2026-07-21' -> '21 jul 2026'. Evita el corrimiento de zona horaria. */
export function fecha(valor, largo = false) {
  if (!valor) return '—';
  const [a, m, d] = String(valor).slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return '—';
  const mes = MESES[m - 1];
  return largo ? `${d} de ${mes} de ${a}` : `${d} ${mes.slice(0, 3)} ${a}`;
}

/** '2026-07-21T15:04:00Z' -> '21 jul 2026, 10:04' (hora de Ecuador). */
export function fechaHora(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-EC', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Guayaquil',
  });
}

/** 1234.5 -> '$ 1.234,50' */
export function money(valor) {
  const n = Number(valor || 0);
  return '$ ' + n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 7.5 -> '7,5'  ·  15 -> '15' */
export function dias(valor) {
  const n = Number(valor || 0);
  return (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', ',');
}

/** '2026-07' -> 'julio 2026' */
export function periodo(valor) {
  if (!valor) return '—';
  const [a, m] = String(valor).split('-');
  const mes = MESES[Number(m) - 1];
  return mes ? `${mes} ${a}` : valor;
}

/** Periodo del mes en curso, formato '2026-07'. */
export function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

/** Fecha de hoy en 'YYYY-MM-DD' segun el reloj local, no UTC. */
export function hoyISO() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

/** Dias calendario entre dos fechas, inclusivo. */
export function diasEntre(desde, hasta) {
  if (!desde || !hasta) return 0;
  const a = new Date(desde + 'T00:00:00');
  const b = new Date(hasta + 'T00:00:00');
  const n = Math.round((b - a) / 86400000) + 1;
  return n > 0 ? n : 0;
}

export const nombreCompleto = (e) => (e ? `${e.nombres || ''} ${e.apellidos || ''}`.trim() : '');

export const iniciales = (e) =>
  ((e?.nombres?.[0] || '') + (e?.apellidos?.[0] || '')).toUpperCase() || '?';
