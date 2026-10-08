export const eur = (n: number | null | undefined, d = 0) =>
  n == null || !isFinite(n) ? '—' : n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' as any });
export const num = (n: number | null | undefined, d = 0) =>
  n == null || !isFinite(n) ? '—' : n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' as any });
export const pct = (n: number | null | undefined, d = 1) =>
  n == null || !isFinite(n) ? '—' : (n * 100).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' as any }) + ' %';
export const x = (n: number | null | undefined, d = 1) =>
  n == null || !isFinite(n) ? '—' : num(n, d) + '×';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const mesLabel = (ym: string) => `${MESES[+ym.slice(5, 7) - 1]} ${ym.slice(2, 4)}`;
export const ESTADO_LABEL: Record<string, string> = { delivered: 'Entregado', pending: 'Pendiente', refunded: 'Devuelto (total)', cancelled: 'Cancelado' };
export const ESTADO_COLOR: Record<string, string> = { delivered: '#1a1c1b', pending: '#b9bdbb', refunded: '#c98468', cancelled: '#e1e3e2' };
// Etiqueta corta de un periodo de una serie temporal (día, semana o mes)
export const etiquetaPeriodo = (gran: 'day' | 'week' | 'month', clave: string) =>
  gran === 'month' ? mesLabel(clave) : `${clave.slice(8)}/${clave.slice(5, 7)}`;
export const PALETA_NEUTRA = ['#1a1c1b', '#5b9a7b', '#7c8a95', '#9aa09d', '#c98468', '#c6c9c7', '#555b58', '#e1e3e2'];
