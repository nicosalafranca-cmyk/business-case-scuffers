// Utilidades de fechas ISO (YYYY-MM-DD) en UTC, sin zonas horarias.
export const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const toISO = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => { const d = parseISO(s); d.setUTCDate(d.getUTCDate() + n); return toISO(d); };
export const addMonths = (s: string, n: number) => { const d = parseISO(s); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); return toISO(d); };
export const monthStart = (s: string) => s.slice(0, 7) + '-01';
export const monthEnd = (s: string) => { const d = parseISO(monthStart(s)); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return toISO(d); };
// lunes de la semana
export const weekStart = (s: string) => { const d = parseISO(s); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return toISO(d); };
export const weekEnd = (s: string) => addDays(weekStart(s), 6);
export const quarterStart = (s: string) => { const d = parseISO(s); d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3, 1); return toISO(d); };
export const quarterEnd = (s: string) => monthEnd(addMonths(quarterStart(s), 2));
export function isoWeek(s: string) {
  const d = parseISO(s);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
}
export const fmtES = (s: string) => s.split('-').reverse().join('/');
export function parseES(t: string): string | null {
  const m = t.trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  if (d.getUTCMonth() !== +m[2] - 1) return null;
  return toISO(d);
}
export const clamp = (s: string, min: string, max: string) => (s < min ? min : s > max ? max : s);
export function mesesEnRango(desde: string, hasta: string) {
  const out: string[] = [];
  let m = monthStart(desde);
  while (m <= hasta) { out.push(m.slice(0, 7)); m = addMonths(m, 1); }
  return out;
}
