// Cifras de las conclusiones del README (C1 a C10) y del gasto actual por canal, calculadas con los mismos datos que el
// resto del panel (sql/panel). Cada bloque reproduce una query de /sql, citada en su comentario, con los mismos periodos
// fijos: no dependen de los filtros. La pestaña Marketing usa C5, C6 y C7, y verificacion/verificar.mts compara cada
// cifra con lo que devuelve su query.
import type { Data, Linea, Pedido } from './types';
import { addDays } from './dates';

export const H1_INI = '2026-01-01';
export const H1_FIN = '2026-06-30';
export const MOTIVOS_TALLA = ['Talla incorrecta', 'Cambio de talla no disponible'];

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const avg = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
const div = (a: number, b: number) => (b ? a / b : NaN);
// Mediana con interpolación, como percentile_cont(0.5) de Postgres
const mediana = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  if (!s.length) return NaN;
  const h = (s.length - 1) / 2;
  return (s[Math.floor(h)] + s[Math.ceil(h)]) / 2;
};
const dias = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000);
const entre = (f: string, a: string, b: string) => f >= a && f <= b;
export const neto = (p: Pedido) => p.subtotal_eur - (p.reembolso_eur ?? 0);

export function conclusiones(d: Data) {
  const V = d.pedidos.filter((p) => !p.excluido);
  const ventas = V.filter((p) => p.estado !== 'cancelled');
  const enH1 = (p: { fecha: string }) => p.fecha <= H1_FIN;
  const VH1 = ventas.filter(enH1);
  const fechaPedido = new Map(V.map((p) => [p.id, p.fecha]));
  const pedido = new Map(V.map((p) => [p.id, p]));
  const canalesPago = new Set(d.gasto.map((g) => g.canal));

  // Pedidos de venta de cada persona y su primer pedido (captación)
  const porPersona = new Map<number, Pedido[]>();
  ventas.forEach((p) => { const l = porPersona.get(p.customer_id); if (l) l.push(p); else porPersona.set(p.customer_id, [p]); });
  porPersona.forEach((l) => l.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id)));
  const nuevos = ventas.filter((p) => p.nuevo_cliente);
  const primero = new Map(nuevos.map((p) => [p.customer_id, p]));
  const valorA = (n: Pedido, nDias: number) => sum((porPersona.get(n.customer_id) ?? []).filter((p) => p.fecha <= addDays(n.fecha, nDias)).map(neto));

  // ------------------------------------------------------------- C1 · c01_venta_neta_h1.sql
  const cabecera = (P: Pedido[], todos: Pedido[], meses: number | null) => {
    const venta = sum(P.map((p) => p.subtotal_eur)), devuelto = sum(P.map((p) => p.reembolso_eur ?? 0));
    const canc = todos.filter((p) => p.estado === 'cancelled'), pend = todos.filter((p) => p.estado === 'pending');
    return {
      pedidos: P.length, venta, devuelto, ventaNeta: venta - devuelto, ventaNetaMes: meses ? (venta - devuelto) / meses : NaN,
      ticket: div(venta, P.length), compradores: new Set(P.map((p) => p.customer_id)).size,
      cancelados: canc.length, ventaCancelada: sum(canc.map((p) => p.subtotal_eur)),
      pendientes: pend.length, ventaPendiente: sum(pend.map((p) => p.subtotal_eur)),
    };
  };
  const todosH1 = d.pedidos.filter(enH1);  // c01b_puente_ventas.sql: del subtotal de todos los pedidos a la venta neta
  const h1 = cabecera(VH1, V.filter(enH1), 6);
  const puente = {
    subtotalTodos: sum(todosH1.map((p) => p.subtotal_eur)), pedidosTodos: todosH1.length,
    bajas: todosH1.filter((p) => p.motivo_exclusion?.startsWith('Pedido dado de baja')).length,
    eurBajas: sum(todosH1.filter((p) => p.motivo_exclusion?.startsWith('Pedido dado de baja')).map((p) => p.subtotal_eur)),
    prueba: todosH1.filter((p) => p.motivo_exclusion?.startsWith('Pedido de prueba')).length,
    eurPrueba: sum(todosH1.filter((p) => p.motivo_exclusion?.startsWith('Pedido de prueba')).map((p) => p.subtotal_eur)),
    pedidosConDevolucion: VH1.filter((p) => (p.reembolso_eur ?? 0) > 0).length,
    ivaEnvio: sum(VH1.map((p) => p.iva_eur + p.envio_eur)),
  };
  const c1 = { h1, puente, pctBajoSubtotal: 1 - h1.ventaNeta / puente.subtotalTodos, julio: cabecera(ventas.filter((p) => !enH1(p)), V.filter((p) => !enH1(p)), null) };

  // ------------------------------------------------------------- C2 · c02_evolucion_mensual.sql
  const listaMeses = [...new Set(ventas.map((p) => p.fecha.slice(0, 7)))].sort();
  const mesCaptacion = new Map(nuevos.map((p) => [p.customer_id, p.fecha.slice(0, 7)]));
  const meses = listaMeses.map((mes) => {
    const P = ventas.filter((p) => p.fecha.slice(0, 7) === mes);
    const N = nuevos.filter((p) => p.fecha.slice(0, 7) === mes);
    const ventaNeta = sum(P.map(neto));
    return {
      mes, pedidos: P.length, ventaNeta, compradores: new Set(P.map((p) => p.customer_id)).size,
      pctVentaClientesPrevios: div(sum(P.filter((p) => mesCaptacion.get(p.customer_id) !== mes).map(neto)), ventaNeta),
      nuevos: N.length, organico: N.filter((p) => p.canal === 'Organic').length,
      pago: N.filter((p) => canalesPago.has(p.canal)).length,
      newsletterDirecto: N.filter((p) => p.canal === 'Newsletter' || p.canal === 'Direct').length,
    };
  });
  const fm = meses.filter((m) => m.mes >= '2026-02' && m.mes <= '2026-05');
  const c2 = {
    meses,
    mediaFebMay: { ventaNeta: avg(fm.map((m) => m.ventaNeta)), nuevos: avg(fm.map((m) => m.nuevos)), organico: avg(fm.map((m) => m.organico)), pago: avg(fm.map((m) => m.pago)), newsletterDirecto: avg(fm.map((m) => m.newsletterDirecto)) },
  };

  // ------------------------------------------------------------- C3 · c03_alemania.sql y c03b_concentracion.sql
  const cli = new Map<string, { persona: number; pais: string; pedidos: number; neto: number }>();
  VH1.forEach((p) => {
    const k = `${p.customer_id}|${p.pais_cliente}`;
    const x = cli.get(k) ?? { persona: p.customer_id, pais: p.pais_cliente, pedidos: 0, neto: 0 };
    x.pedidos++; x.neto += neto(p); cli.set(k, x);
  });
  const ranking = [...cli.values()].sort((a, b) => b.neto - a.neto);
  const top = (n: number) => new Set(ranking.slice(0, n));
  const t10 = top(10), t20 = top(20);
  const netoH1 = sum(ranking.map((r) => r.neto));
  const captadosFebAbr = nuevos.filter((n) => entre(n.fecha, '2026-02-01', '2026-04-13'));
  const valor90Pais: Record<string, number> = {};
  const paises = [...new Set(ranking.map((r) => r.pais))].sort();
  const porPais = paises.map((pais) => {
    const R = ranking.filter((r) => r.pais === pais);
    const C = captadosFebAbr.filter((n) => n.pais_cliente === pais);
    valor90Pais[pais] = avg(C.map((n) => valorA(n, 90)));
    return {
      pais, compradores: R.length, pctCompradores: div(R.length, ranking.length), ventaNeta: sum(R.map((r) => r.neto)),
      pctVentaNeta: div(sum(R.map((r) => r.neto)), netoH1), pedidosPorComprador: avg(R.map((r) => r.pedidos)),
      ventaNetaPorComprador: div(sum(R.map((r) => r.neto)), R.length), enTop20: R.filter((r) => t20.has(r)).length,
      captadosFebAbr: C.length, ventaNeta90d: valor90Pais[pais],
    };
  });
  const c3 = {
    porPais, compradores: ranking.length,
    pctTop10: div(sum(ranking.filter((r) => t10.has(r)).map((r) => r.neto)), netoH1),
    pctTop20: div(sum(ranking.filter((r) => t20.has(r)).map((r) => r.neto)), netoH1),
    pctAlemaniaPorEnvio: div(sum(VH1.filter((p) => p.pais === 'DE').map(neto)), sum(VH1.map(neto))),
  };

  // ------------------------------------------------------------- C4 · c04_recompra_cohortes.sql y c04b_valor_90_dias.sql
  const repite = (n: Pedido, nDias: number) => (porPersona.get(n.customer_id) ?? []).some((p) => p.id !== n.id && p.fecha <= addDays(n.fecha, nDias));
  const conVentana = nuevos.filter((n) => n.fecha <= '2026-06-12');
  const etiqueta = (n: Pedido) => n.fecha.slice(0, 7) + (n.fecha >= '2026-06-01' ? ' (1-12)' : '');
  const cohortes = [...new Set(conVentana.map(etiqueta))].sort().map((cohorte) => {
    const C = conVentana.filter((n) => etiqueta(n) === cohorte), E = C.filter((n) => n.pais_cliente === 'ES');
    return {
      cohorte, clientes: C.length, repiten30: C.filter((n) => repite(n, 30)).length, pctRepite30: div(C.filter((n) => repite(n, 30)).length, C.length),
      clientesES: E.length, pctRepite30ES: div(E.filter((n) => repite(n, 30)).length, E.length),
    };
  });
  const segundo = nuevos.map((n) => (porPersona.get(n.customer_id) ?? []).find((p) => p.id !== n.id)).map((p, i) => (p ? dias(nuevos[i].fecha, p.fecha) : null)).filter((x): x is number => x != null);
  const c4 = {
    cohortes,
    valor90Enero: avg(nuevos.filter((n) => n.fecha < '2026-02-01').map((n) => valorA(n, 90))),
    clientesEnero: nuevos.filter((n) => n.fecha < '2026-02-01').length,
    valor90FebAbr: avg(captadosFebAbr.map((n) => valorA(n, 90))), clientesFebAbr: captadosFebAbr.length,
    medianaDias2o: mediana(segundo), pct2oEn7Dias: div(segundo.filter((x) => x <= 7).length, segundo.length), repiten: segundo.length,
  };

  // ------------------------------------------------------------- C5 · c05_canales_coste_y_valor.sql
  const MJ = (f: string) => entre(f, '2026-03-01', H1_FIN);
  const gastoMJ = (c: string) => sum(d.gasto.filter((g) => g.canal === c && MJ(g.fecha)).map((g) => g.gasto_eur));
  const canales = [...canalesPago].map((canal) => {
    const N = nuevos.filter((n) => n.canal === canal && MJ(n.fecha));
    const P = ventas.filter((p) => p.canal === canal && MJ(p.fecha));
    const gasto = gastoMJ(canal), valor = sum(N.map((n) => valor90Pais[n.pais_cliente] ?? 0)), netoP = sum(P.map(neto));
    return {
      canal, gasto, nuevos: N.length, nuevosDE: N.filter((n) => n.pais_cliente === 'DE').length,
      costeClienteNuevo: div(gasto, N.length), valor90ClienteNuevo: div(valor, N.length), retorno: div(valor, gasto),
      iec: div(netoP, gasto), pctVentaRecompra: div(sum(P.filter((p) => !p.nuevo_cliente).map(neto)), netoP),
      ticket: avg(P.map((p) => p.subtotal_eur)), pctPedidosAlemania: div(P.filter((p) => p.pais === 'DE').length, P.length),
    };
  }).filter((r) => r.nuevos > 0).sort((a, b) => a.costeClienteNuevo - b.costeClienteNuevo);
  const c5 = { canales };

  // ------------------------------------------------------------- C6 · c06_atribucion_recompra.sql
  const cuota = new Map<string, number>();
  VH1.forEach((p) => cuota.set(p.canal, (cuota.get(p.canal) ?? 0) + 1));
  cuota.forEach((v, k) => cuota.set(k, v / VH1.length));
  const rep = VH1.filter((p) => !p.nuevo_cliente).map((p) => ({ canal: p.canal, captacion: primero.get(p.customer_id)!.canal }));
  const resumenRep = (R: typeof rep) => ({ pedidos: R.length, porSuCanal: R.filter((r) => r.canal === r.captacion).length, pct: div(R.filter((r) => r.canal === r.captacion).length, R.length), azar: avg(R.map((r) => cuota.get(r.captacion) ?? 0)) });
  const c6 = { todos: resumenRep(rep), porCanal: [...new Set(rep.map((r) => r.captacion))].map((c) => ({ canal: c, ...resumenRep(rep.filter((r) => r.captacion === c)) })).sort((a, b) => b.pedidos - a.pedidos) };

  // ------------------------------------------------------------- C7 · c07_tiktok_tramos.sql
  const TT = 'TikTok Ads';
  const tramo = (nombre: string, ini: string, fin: string) => {  // [ini, fin)
    const n = dias(ini, fin), en = (f: string) => f >= ini && f < fin;
    const gasto = sum(d.gasto.filter((g) => g.canal === TT && en(g.fecha)).map((g) => g.gasto_eur));
    const P = ventas.filter((p) => p.canal === TT && en(p.fecha)), N = nuevos.filter((p) => p.canal === TT && en(p.fecha));
    return {
      tramo: nombre, dias: n, gasto, gastoDia: gasto / n, gasto30: (30 * gasto) / n, pedidos30: (30 * P.length) / n,
      nuevos: N.length, nuevos30: (30 * N.length) / n, costeClienteNuevo: div(gasto, N.length),
      pctVentaRecompra: div(sum(P.filter((p) => !p.nuevo_cliente).map(neto)), sum(P.map(neto))),
    };
  };
  const tramos = [tramo('1) 1-ene a 15-feb', '2026-01-01', '2026-02-16'), tramo('2) 16 a 28-feb, recorte', '2026-02-16', '2026-03-01'), tramo('3) 1-mar a 30-jun', '2026-03-01', '2026-07-01')];
  const [t1, , t3] = tramos;
  const c7 = { tramos, gastoExtra30: Math.round(t1.gasto30) - Math.round(t3.gasto30), nuevosExtra30: t1.nuevos30 - t3.nuevos30, costeClienteAdicional: (t1.gasto30 - t3.gasto30) / (t1.nuevos30 - t3.nuevos30) };

  // ------------------------------------------------------------- C8 · c08_categorias_deporte.sql
  const lineasVenta = (desde: string, hasta: string) => d.lineas.filter((l) => { const p = pedido.get(l.pedido_id); return p && p.estado !== 'cancelled' && entre(p.fecha, desde, hasta); });
  const LMJ = lineasVenta('2026-05-01', H1_FIN);
  const totalMJ = sum(LMJ.map((l) => l.importe_eur));
  const categorias = [...new Set(LMJ.map((l) => l.categoria))].map((categoria) => {
    const L = LMJ.filter((l) => l.categoria === categoria);
    const refs = new Set(L.map((l) => l.producto_id)).size, venta = sum(L.map((l) => l.importe_eur)), uds = sum(L.map((l) => l.cantidad));
    return {
      categoria, referencias: refs, referenciasInactivas: new Set(L.filter((l) => !l.activo).map((l) => l.producto_id)).size,
      unidades: uds, venta, pctVenta: div(venta, totalMJ), ventaPorReferencia: venta / refs, unidadesPorReferencia: uds / refs,
      ventaMayo: sum(L.filter((l) => (fechaPedido.get(l.pedido_id) ?? '') < '2026-06-01').map((l) => l.importe_eur)),
      ventaJunio: sum(L.filter((l) => (fechaPedido.get(l.pedido_id) ?? '') >= '2026-06-01').map((l) => l.importe_eur)),
      pctVentaInactivas: div(sum(L.filter((l) => !l.activo).map((l) => l.importe_eur)), venta),
    };
  }).sort((a, b) => b.ventaPorReferencia - a.ventaPorReferencia);
  const c8 = { categorias };

  // ------------------------------------------------------------- C9 · c09_devolucion_y_nota.sql y c09b_devolucion_global.sql
  const base9 = VH1.filter((p) => p.estado === 'delivered' || p.estado === 'refunded');
  const ids9 = new Set(base9.map((p) => p.id));
  const L9 = d.lineas.filter((l) => ids9.has(l.pedido_id));
  const devueltas = (l: Linea) => {
    const p = pedido.get(l.pedido_id)!;
    if (p.estado === 'refunded') return l.cantidad;
    const r = Math.round((p.reembolso_eur ?? 0) * 100);
    let k = 0;
    for (let i = 1; i <= l.cantidad; i++) if (Math.round(l.precio_eur * 100) * i === r) k = i;
    return k;
  };
  const resenas = new Map<number, number[]>();
  d.resenas.forEach((r) => { const l = resenas.get(r.producto_id); if (l) l.push(r.rating); else resenas.set(r.producto_id, [r.rating]); });
  const productos9 = d.productos.filter((pr) => (resenas.get(pr.id)?.length ?? 0) >= 10).map((pr) => {
    const L = L9.filter((l) => l.producto_id === pr.id), dev = sum(L.map(devueltas));
    return {
      producto: pr.producto, nota: avg(resenas.get(pr.id)!), resenas: resenas.get(pr.id)!.length, unidades: sum(L.map((l) => l.cantidad)),
      devueltas: dev, pctDevolucion: div(dev, sum(L.map((l) => l.cantidad))),
      devueltasPorTalla: sum(L.filter((l) => MOTIVOS_TALLA.includes(pedido.get(l.pedido_id)!.motivo_reembolso ?? '')).map(devueltas)),
    };
  }).sort((a, b) => b.nota - a.nota);
  const c9 = {
    productos: productos9,
    pedidosBase: base9.length, totales: base9.filter((p) => p.estado === 'refunded').length,
    parciales: base9.filter((p) => p.estado === 'delivered' && (p.reembolso_eur ?? 0) > 0).length,
    pctPedidos: div(base9.filter((p) => (p.reembolso_eur ?? 0) > 0).length, base9.length),
    pctSoloRefunded: div(base9.filter((p) => p.estado === 'refunded').length, base9.length),
    unidadesBase: sum(L9.map((l) => l.cantidad)), unidadesDevueltas: sum(L9.map(devueltas)),
    pctUnidades: div(sum(L9.map(devueltas)), sum(L9.map((l) => l.cantidad))),
    pedidosPorTalla: base9.filter((p) => MOTIVOS_TALLA.includes(p.motivo_reembolso ?? '')).length,
  };

  // ------------------------------------------------------------- C10 · c10_codigos.sql y c10b_codigos_una_vez.sql
  const usos = VH1.flatMap((p) => (p.codigos ? p.codigos.split(' + ').map((codigo) => ({ codigo, p })) : []));
  const resumenUsos = (U: typeof usos) => ({
    usos: U.length, ingresoCruce: sum(U.map((u) => neto(u.p))), enPrimerPedido: U.filter((u) => u.p.nuevo_cliente).length,
    enRepeticion: U.filter((u) => !u.p.nuevo_cliente).length, fueraDeMarzo: U.filter((u) => u.p.fecha.slice(5, 7) !== '03').length,
    mesesConUso: new Set(U.map((u) => u.p.fecha.slice(5, 7))).size,
  });
  const conCodigo = VH1.filter((p) => p.codigos), sinCodigo = VH1.filter((p) => !p.codigos);
  const idsCon = new Set(conCodigo.map((p) => p.id));
  const LH1 = d.lineas.filter((l) => { const p = pedido.get(l.pedido_id); return p && p.estado !== 'cancelled' && enH1(p); });
  const bajoTarifa = (L: Linea[]) => 1 - sum(L.map((l) => l.importe_eur)) / sum(L.map((l) => l.cantidad * (l.tarifa_eur ?? 0)));
  const c10 = {
    codigos: [...new Set(usos.map((u) => u.codigo))].sort().map((codigo) => ({ codigo, ...resumenUsos(usos.filter((u) => u.codigo === codigo)) })),
    total: resumenUsos(usos),
    pedidosConCodigo: conCodigo.length, pedidosConDosCodigos: conCodigo.filter((p) => p.codigos!.includes(' + ')).length,
    pctPedidosConCodigo: div(conCodigo.length, VH1.length), ingresoUnaVez: sum(conCodigo.map(neto)),
    ticketConCodigo: avg(conCodigo.map((p) => p.subtotal_eur)), ticketSinCodigo: avg(sinCodigo.map((p) => p.subtotal_eur)),
    bajoTarifaConCodigo: bajoTarifa(LH1.filter((l) => idsCon.has(l.pedido_id))), bajoTarifaSinCodigo: bajoTarifa(LH1.filter((l) => !idsCon.has(l.pedido_id))),
  };

  // ------------------------------------------------------------- Plan · p1_gasto_actual.sql
  const gastoCanal = [...canalesPago].sort().map((canal) => {
    const G = d.gasto.filter((g) => g.canal === canal);
    const h1 = sum(G.filter((g) => g.fecha <= H1_FIN).map((g) => g.gasto_eur)), mj = sum(G.filter((g) => MJ(g.fecha)).map((g) => g.gasto_eur));
    return { canal, h1, marJun: mj, mesMarJun: mj / 4 };
  });
  const totH1 = sum(gastoCanal.map((g) => g.h1)), totMJ = sum(gastoCanal.map((g) => g.marJun));
  const plan = { gasto: gastoCanal, totalH1: totH1, totalMarJun: totMJ, totalMesMarJun: totMJ / 4, pctVentaNetaH1: div(totH1, c1.h1.ventaNeta) };

  return { c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, plan };
}
export type Conclusiones = ReturnType<typeof conclusiones>;
