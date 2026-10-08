import type { Data, Estado, Filtros, Gasto, Linea, Pedido } from './types';
import { addDays, mesesEnRango, parseISO, weekStart } from './dates';

export const ESTADOS: Estado[] = ['delivered', 'pending', 'refunded', 'cancelled'];
export const SIN_CODIGO = 'Sin código';
export const CATEGORIAS = ['Ropa', 'Calzado', 'Accesorios', 'Deporte'];
export const PAISES = [{ value: 'ES', label: 'España' }, { value: 'DE', label: 'Alemania' }];

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
export const div = (a: number, b: number) => (b ? a / b : NaN);
const group = <T,>(a: T[], key: (t: T) => string | number) => {
  const m = new Map<string | number, T[]>();
  a.forEach((t) => { const k = key(t); const l = m.get(k); if (l) l.push(t); else m.set(k, [t]); });
  return m;
};
// Venta de un pedido: los cancelados no son venta (cuentan 0). Venta neta = venta − reembolso.
export const venta = (p: Pedido) => (p.estado === 'cancelled' ? 0 : p.subtotal_eur);
export const ventaNeta = (p: Pedido) => venta(p) - (p.reembolso_eur ?? 0);
// Sensibilidad: venta neta si el código hubiera aplicado su descuento (el mayor del pedido). No figura en los importes.
export const ventaNetaConDto = (p: Pedido) => ventaNeta(p) * (1 - (p.descuento_pct ?? 0) / 100);
export const codigosDe = (p: Pedido) => (p.codigos ? p.codigos.split(' + ') : [SIN_CODIGO]);

// Índice de líneas por pedido (se calcula una vez por conjunto de datos)
const idx = new WeakMap<Data, Map<number, Linea[]>>();
const lineasPorPedido = (d: Data) => {
  let m = idx.get(d);
  if (!m) { m = new Map(); d.lineas.forEach((l) => { const x = m!.get(l.pedido_id); if (x) x.push(l); else m!.set(l.pedido_id, [l]); }); idx.set(d, m); }
  return m;
};

// ---------------------------------------------------------------- rangos y selección
export function rangoDatos(d: Data) {
  const f = d.pedidos.map((p) => p.fecha);
  return { min: f.reduce((a, b) => (b < a ? b : a)), max: f.reduce((a, b) => (b > a ? b : a)) };
}
export const canalesDe = (d: Data) => {
  const c = new Map<string, number>();
  d.pedidos.forEach((p) => c.set(p.canal, (c.get(p.canal) ?? 0) + 1));
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
};
// Canales de pago = los que tienen alguna fila de inversión en la base (no hay lista fija).
export const canalesConGasto = (d: Data) => new Set(d.gasto.map((g) => g.canal));

export function enFiltro(p: Pedido, f: Filtros) {
  return !p.excluido && p.fecha >= f.desde && p.fecha <= f.hasta &&
    f.paises.includes(p.pais) && f.canales.includes(p.canal) && f.estados.includes(p.estado) &&
    codigosDe(p).some((c) => f.codigos.includes(c));
}
// Con filtro de categoría parcial, el pedido pasa a valer solo sus líneas de esas categorías.
export function selPedidos(d: Data, f: Filtros): Pedido[] {
  const base = d.pedidos.filter((p) => enFiltro(p, f));
  if (f.categorias.length >= CATEGORIAS.length) return base;
  const li = lineasPorPedido(d);
  const out: Pedido[] = [];
  base.forEach((p) => {
    const L = (li.get(p.id) ?? []).filter((l) => f.categorias.includes(l.categoria));
    const v = sum(L.map((l) => l.importe_eur));
    if (v > 0) out.push({ ...p, subtotal_eur: v, unidades: sum(L.map((l) => l.cantidad)) });
  });
  return out;
}
export function selGasto(d: Data, f: Filtros): Gasto[] {
  return d.gasto.filter((g) => g.fecha >= f.desde && g.fecha <= f.hasta && f.canales.includes(g.canal));
}
export const meses = (d: Data) => [...new Set(d.pedidos.map((p) => p.fecha.slice(0, 7)))].sort();
export const nDias = (desde: string, hasta: string) => Math.round((parseISO(hasta).getTime() - parseISO(desde).getTime()) / 86400000) + 1;

// ---------------------------------------------------------------- periodo anterior
// Periodo de igual duración inmediatamente anterior. Solo existe si empieza dentro de los datos.
export function periodoAnterior(d: Data, f: Filtros): { desde: string; hasta: string } | null {
  const n = nDias(f.desde, f.hasta);
  const desde = addDays(f.desde, -n), hasta = addDays(f.desde, -1);
  return desde >= rangoDatos(d).min ? { desde, hasta } : null;
}
export const variacion = (actual: number, anterior: number) => (anterior ? (actual - anterior) / Math.abs(anterior) : NaN);

// ---------------------------------------------------------------- devoluciones
// PEDIDOS: total = estado refunded (el reembolso iguala el subtotal) · parcial = delivered con fila en refunds.
// PRODUCTOS: total = todas las unidades del pedido · parcial = unidades que casan con el reembolso.
// Las tasas se calculan sobre lo que llegó al cliente (pedidos delivered o refunded y sus unidades).
export function devoluciones(P: Pedido[]) {
  const base = P.filter((p) => p.estado === 'delivered' || p.estado === 'refunded');
  const total = base.filter((p) => p.tipo_devolucion === 'total');
  const parcial = base.filter((p) => p.tipo_devolucion === 'parcial');
  const uds = sum(base.map((p) => p.unidades));
  const udsTotal = sum(total.map((p) => p.unidades_devueltas ?? 0));
  const udsParcial = sum(parcial.map((p) => p.unidades_devueltas ?? 0));
  return {
    pedidosBase: base.length, pedidosTotal: total.length, pedidosParcial: parcial.length,
    pedidosConDevolucion: total.length + parcial.length,
    tasaPedidos: div(total.length + parcial.length, base.length),
    tasaPedidosTotal: div(total.length, base.length), tasaPedidosParcial: div(parcial.length, base.length),
    unidadesBase: uds, unidadesDevueltas: udsTotal + udsParcial, unidadesTotal: udsTotal, unidadesParcial: udsParcial,
    tasaProductos: div(udsTotal + udsParcial, uds),
    importe: sum(P.map((p) => p.reembolso_eur ?? 0)),
  };
}

export const compradoresDe = (P: Pedido[]) => new Set(P.filter((p) => p.estado !== 'cancelled').map((p) => p.customer_id)).size;

// Pedidos y ventas se cuentan sin cancelados; las tasas de cancelación usan todos los pedidos de la selección.
export function kpis(P: Pedido[]) {
  const V = P.filter((p) => p.estado !== 'cancelled');
  const ventas = sum(V.map((p) => p.subtotal_eur));
  const dv = devoluciones(P);
  const unidades = sum(V.map((p) => p.unidades));
  const canc = P.filter((p) => p.estado === 'cancelled').length;
  const pend = P.filter((p) => p.estado === 'pending').length;
  const nuevosVentas = sum(V.filter((p) => p.nuevo_cliente).map(ventaNeta));
  return {
    ventas, pedidos: V.length, ticket: div(ventas, V.length), unidades,
    upt: div(unidades, V.length), precioMedio: div(ventas, unidades),
    facturacion: sum(V.map((p) => p.total_eur)), impuestos: sum(V.map((p) => p.iva_eur)), envios: sum(V.map((p) => p.envio_eur)),
    envioMedio: div(sum(V.map((p) => p.envio_eur)), V.length),
    envioGratis: div(V.filter((p) => p.envio_eur === 0).length, V.length),
    ventasCanceladas: sum(P.filter((p) => p.estado === 'cancelled').map((p) => p.subtotal_eur)),
    ventasNetasConDto: sum(V.map(ventaNetaConDto)),
    pctRecompra: div(sum(V.map(ventaNeta)) - nuevosVentas, sum(V.map(ventaNeta))),
    clientes: new Set(P.map((p) => p.customer_id)).size, compradores: compradoresDe(P),
    nuevos: P.filter((p) => p.nuevo_cliente).length,
    cancelados: canc, tasaCancel: div(canc, P.length), pendientes: pend, pedidosTodos: P.length,
    devolucion: dv.tasaPedidos, dev: dv, reembolsos: dv.importe, ventasNetas: ventas - dv.importe,
    pedidosDevueltos: dv.pedidosConDevolucion,
  };
}
export type Kpis = ReturnType<typeof kpis>;

export function porDimension(P: Pedido[], key: (p: Pedido) => string) {
  return [...group(P, key).entries()].map(([k, R]) => ({ k: String(k), ...kpis(R) })).sort((a, b) => b.ventas - a.ventas);
}

// ---------------------------------------------------------------- marketing
export function porCanal(P: Pedido[], G: Gasto[], conGastoSet: Set<string>) {
  const pago = P.filter((p) => conGastoSet.has(p.canal));
  const totalPago = sum(pago.map(venta));
  const totalVentas = sum(P.map(venta));
  const gastoTot = sum(G.map((g) => g.gasto_eur));
  const canales = [...new Set([...P.map((p) => p.canal), ...G.map((g) => g.canal)])];
  return canales.map((c) => {
    const R = P.filter((p) => p.canal === c);
    const k = kpis(R);
    const gasto = sum(G.filter((g) => g.canal === c).map((g) => g.gasto_eur));
    const conGasto = conGastoSet.has(c);
    return {
      canal: c, ...k, gasto, conGasto,
      roas: conGasto ? div(k.ventas, gasto) : NaN,
      iec: conGasto ? div(k.ventasNetas, gasto) : NaN, // Índice de Eficiencia de Canal: venta neta atribuida ÷ inversión
      cpa: conGasto ? div(gasto, k.pedidos) : NaN,
      cac: conGasto ? div(gasto, k.nuevos) : NaN,
      shareVentas: div(k.ventas, totalVentas),
      cuotaVentas: conGasto ? div(k.ventas, totalPago) : NaN,
      cuotaGasto: conGasto ? div(gasto, gastoTot) : NaN,
    };
  }).sort((a, b) => b.ventas - a.ventas);
}

// ---------------------------------------------------------------- líneas, categorías y productos
// Líneas vendidas: las de pedidos no cancelados.
export function lineasDe(d: Data, P: Pedido[], categorias?: string[]): Linea[] {
  const ids = new Set(P.filter((p) => p.estado !== 'cancelled').map((p) => p.id));
  return d.lineas.filter((l) => ids.has(l.pedido_id) && (!categorias || categorias.includes(l.categoria)));
}

export function porCategoria(L: Linea[]) {
  const total = sum(L.map((l) => l.importe_eur));
  return [...group(L, (l) => l.categoria).entries()].map(([categoria, R]) => {
    const ventas = sum(R.map((l) => l.importe_eur)), unidades = sum(R.map((l) => l.cantidad));
    return { categoria: String(categoria), ventas, unidades, pedidos: new Set(R.map((l) => l.pedido_id)).size, share: div(ventas, total), precioMedio: div(ventas, unidades) };
  }).sort((a, b) => b.ventas - a.ventas);
}

export function porProducto(L: Linea[], d: Data) {
  const m = group(L, (l) => l.producto_id);
  return d.productos.map((p) => {
    const R = m.get(p.id) ?? [];
    const ventas = sum(R.map((l) => l.importe_eur));
    const bruto = sum(R.map((l) => l.cantidad * p.tarifa_eur));
    return {
      ...p, ventas, unidades: sum(R.map((l) => l.cantidad)), pedidos: new Set(R.map((l) => l.pedido_id)).size,
      descuento: bruto ? 1 - ventas / bruto : NaN, // % medio bajo la tarifa de catálogo
    };
  }).sort((a, b) => b.ventas - a.ventas);
}

// Descuento sobre tarifa a nivel de línea (solo líneas con tarifa conocida)
export function descuentos(L: Linea[]) {
  const C = L.filter((l) => l.tarifa_eur != null);
  const bruto = sum(C.map((l) => l.cantidad * (l.tarifa_eur as number)));
  const neto = sum(C.map((l) => l.importe_eur));
  const con = C.filter((l) => l.precio_eur < (l.tarifa_eur as number) - 1e-9).length;
  return { bruto, neto, valor: bruto - neto, pct: bruto ? (bruto - neto) / bruto : NaN, lineasConDescuento: con, lineas: C.length, pctLineas: div(con, C.length) };
}

// Concentración: peso de las N mejores partidas en el total
export function topShare(valores: number[], n: number) {
  const v = valores.filter((x) => x > 0).sort((a, b) => b - a);
  return div(sum(v.slice(0, n)), sum(v));
}

// ---------------------------------------------------------------- promociones
// Un pedido con dos códigos cuenta en ambos (por eso la suma por código no es el total).
export function porCodigo(P: Pedido[]) {
  const m = new Map<string, Pedido[]>();
  P.forEach((p) => codigosDe(p).forEach((c) => { const l = m.get(c); if (l) l.push(p); else m.set(c, [p]); }));
  return [...m.entries()].map(([codigo, R]) => ({ codigo, ...kpis(R) })).sort((a, b) => b.ventas - a.ventas);
}

export function devolucionesPorMotivo(P: Pedido[]) {
  const R = P.filter((p) => p.tipo_devolucion);
  return [...group(R, (p) => p.motivo_reembolso || 'Sin motivo').entries()]
    .map(([motivo, X]) => ({
      motivo: String(motivo), n: X.length,
      total: X.filter((p) => p.tipo_devolucion === 'total').length, parcial: X.filter((p) => p.tipo_devolucion === 'parcial').length,
      unidades: sum(X.map((p) => p.unidades_devueltas ?? 0)), importe: sum(X.map((p) => p.reembolso_eur ?? 0)),
    }))
    .sort((a, b) => b.n - a.n);
}

// ---------------------------------------------------------------- clientes
export function clientesPorMes(P: Pedido[], listaMeses: string[]) {
  return listaMeses.map((m) => {
    const R = P.filter((p) => p.fecha.slice(0, 7) === m && p.estado !== 'cancelled');
    return { mes: m, nuevos: R.filter((p) => p.nuevo_cliente).length, recurrentes: R.filter((p) => !p.nuevo_cliente).length };
  });
}

// Recompra: compradores con >=2 pedidos no cancelados dentro de la selección
export function recompra(P: Pedido[]) {
  const c = new Map<number, number>();
  const v = new Map<number, number>();
  P.filter((p) => p.estado !== 'cancelled').forEach((p) => { c.set(p.customer_id, (c.get(p.customer_id) ?? 0) + 1); v.set(p.customer_id, (v.get(p.customer_id) ?? 0) + ventaNeta(p)); });
  const total = c.size, rec = [...c.values()].filter((n) => n >= 2).length;
  const ventasCompradores = sum([...v.values()]);
  return {
    total, recurrentes: rec, tasa: div(rec, total), pedidosPorCliente: div(sum([...c.values()]), total),
    ventasPorComprador: div(ventasCompradores, total), concentracionTop10: topShare([...v.values()], 10),
  };
}

export function distribucionPedidosPorCliente(P: Pedido[]) {
  const c = new Map<number, number>();
  P.filter((p) => p.estado !== 'cancelled').forEach((p) => c.set(p.customer_id, (c.get(p.customer_id) ?? 0) + 1));
  const b = new Map<string, number>();
  c.forEach((n) => { const k = n >= 5 ? '5+' : String(n); b.set(k, (b.get(k) ?? 0) + 1); });
  return ['1', '2', '3', '4', '5+'].map((k) => ({ pedidos: k, clientes: b.get(k) ?? 0 }));
}

// Registrado = fila en customers (alta <= fin del periodo, país declarado). Comprador = cliente con >= 1 pedido
// válido y no cancelado. Primera compra = su primer pedido válido no cancelado en toda la base.
export function clientesStats(d: Data, f: Filtros, P: Pedido[]) {
  const primera = new Map<number, string>();
  d.pedidos.filter((p) => !p.excluido && p.estado !== 'cancelled').forEach((p) => {
    const x = primera.get(p.customer_id);
    if (!x || p.fecha < x) primera.set(p.customer_id, p.fecha);
  });
  const reg = (d.clientes ?? []).filter((c) => f.paises.includes(c.pais) && c.alta <= f.hasta);
  const altas = reg.filter((c) => c.alta >= f.desde);
  const compraron = (c: { id: number }) => { const x = primera.get(c.id); return x !== undefined && x <= f.hasta; };
  const dias = reg.filter(compraron).map((c) => Math.max(0, Math.round((parseISO(primera.get(c.id)!).getTime() - parseISO(c.alta).getTime()) / 86400000)));
  dias.sort((a, b) => a - b);
  const bucket = (n: number) => (n === 0 ? 'Mismo día' : n <= 7 ? '1 a 7 días' : n <= 30 ? '8 a 30 días' : n <= 90 ? '31 a 90 días' : 'Más de 90 días');
  const orden = ['Mismo día', '1 a 7 días', '8 a 30 días', '31 a 90 días', 'Más de 90 días'];
  const dist = orden.map((k) => ({ tramo: k, clientes: dias.filter((n) => bucket(n) === k).length }));
  const nComp = reg.filter(compraron).length;
  return {
    registrados: reg.length, altas: altas.length,
    compradoresHist: nComp, sinCompra: reg.length - nComp,
    conversion: div(nComp, reg.length),
    compradoresPeriodo: compradoresDe(P),
    diasMedios: dias.length ? sum(dias) / dias.length : NaN,
    diasMediana: dias.length ? dias[Math.floor(dias.length / 2)] : NaN,
    hastaSemana: div(dias.filter((n) => n <= 7).length, dias.length),
    dist,
    porMes: (listaMeses: string[]) => listaMeses.map((m) => {
      const a = reg.filter((c) => c.alta.slice(0, 7) === m);
      const c = a.filter(compraron).length;
      return { mes: m, altas: a.length, compradores: c, sinCompra: a.length - c };
    }),
    porPais: f.paises.map((pc) => {
      const r = reg.filter((c) => c.pais === pc);
      return { pais: pc, registrados: r.length, compradores: r.filter(compraron).length, conversion: div(r.filter(compraron).length, r.length) };
    }),
  };
}

// ---------------------------------------------------------------- reseñas
export function resenasStats(d: Data, f: Filtros) {
  const cat = new Map(d.productos.map((p) => [p.id, p.categoria]));
  const R = d.resenas.filter((r) => r.fecha >= f.desde && r.fecha <= f.hasta && f.categorias.includes(cat.get(r.producto_id) ?? ''));
  const dist = [1, 2, 3, 4, 5].map((n) => ({ estrellas: `${n} ★`, n: R.filter((r) => r.rating === n).length }));
  const porMes = mesesEnRango(f.desde, f.hasta).map((m) => {
    const X = R.filter((r) => r.fecha.slice(0, 7) === m);
    return { mes: m, n: X.length, media: X.length ? sum(X.map((r) => r.rating)) / X.length : NaN };
  });
  return { n: R.length, media: R.length ? sum(R.map((r) => r.rating)) / R.length : NaN, positivas: div(R.filter((r) => r.rating >= 4).length, R.length), dist, porMes };
}

// ---------------------------------------------------------------- series temporales
export type Gran = 'day' | 'week' | 'month';
export const claveDe = (gran: Gran, fecha: string) => (gran === 'day' ? fecha : gran === 'week' ? weekStart(fecha) : fecha.slice(0, 7));
export function clavesDe(gran: Gran, desde: string, hasta: string) {
  const keys: string[] = [];
  if (gran === 'month') mesesEnRango(desde, hasta).forEach((m) => keys.push(m));
  else {
    let c = gran === 'week' ? weekStart(desde) : desde;
    while (c <= hasta) { keys.push(c); c = addDays(c, gran === 'week' ? 7 : 1); }
  }
  return keys;
}

// Ventas, pedidos y ticket por periodo, con ventas separadas por estado.
export function serieTemporal(P: Pedido[], gran: Gran, desde: string, hasta: string) {
  const g = group(P, (p) => claveDe(gran, p.fecha));
  return clavesDe(gran, desde, hasta).map((k) => {
    const R = g.get(k) ?? [];
    const V = R.filter((p) => p.estado !== 'cancelled');
    const row: Record<string, number | string> = { clave: k, pedidos: V.length, ventas: sum(V.map((p) => p.subtotal_eur)), neta: sum(V.map(ventaNeta)) };
    for (const e of ESTADOS) row[e] = sum(R.filter((p) => p.estado === e).map((p) => p.subtotal_eur));
    row.ticket = V.length ? (row.ventas as number) / V.length : NaN;
    return row;
  });
}

// Periodo actual frente al anterior, alineados por posición (día 1 con día 1, etc.).
export function serieComparada(P: Pedido[], Pant: Pedido[], f: Filtros, ant: { desde: string; hasta: string }, gran: Gran) {
  const a = serieTemporal(P, gran, f.desde, f.hasta), b = serieTemporal(Pant, gran, ant.desde, ant.hasta);
  const n = Math.max(a.length, b.length);
  return Array.from({ length: n }, (_, i) => ({
    i, actual: a[i] ? (a[i].ventas as number) : null, anterior: b[i] ? (b[i].ventas as number) : null,
    claveActual: a[i]?.clave as string | undefined, claveAnterior: b[i]?.clave as string | undefined,
  }));
}

// Serie apilada por una dimensión cualquiera. `items` = (fecha, grupo, valor).
export type Item = { fecha: string; k: string; v: number };
export function serieDimension(items: Item[], gran: Gran, desde: string, hasta: string, maxGrupos = 6) {
  const tot = new Map<string, number>();
  items.forEach((i) => tot.set(i.k, (tot.get(i.k) ?? 0) + i.v));
  const top = [...tot.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const keep = top.slice(0, maxGrupos), hayOtros = top.length > maxGrupos;
  const g = group(items, (i) => claveDe(gran, i.fecha));
  const rows = clavesDe(gran, desde, hasta).map((c) => {
    const row: Record<string, number | string> = { clave: c };
    keep.forEach((k) => (row[k] = 0));
    if (hayOtros) row['Otros'] = 0;
    (g.get(c) ?? []).forEach((i) => { const k = keep.includes(i.k) ? i.k : 'Otros'; row[k] = (row[k] as number) + i.v; });
    return row;
  });
  return { rows, grupos: hayOtros ? [...keep, 'Otros'] : keep };
}
