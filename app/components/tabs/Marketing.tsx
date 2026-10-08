'use client';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Gasto, Pedido } from '@/lib/types';
import { canalesConGasto, claveDe, clavesDe, div, porCanal, selGasto, serieDimension, variacion, venta, ventaNeta, type Gran } from '@/lib/calc';
import { conclusiones } from '@/lib/conclusiones';
import { eur, etiquetaPeriodo, num, pct, x, PALETA_NEUTRA } from '@/lib/format';
import type { Ctx } from '../ctx';
import { Callout, Card, Kpi, Section, Seg, Table, Tip, AX, GRID, KpiBoard, KpiGroup } from '../ui';

const COLOR: Record<string, string> = {};
const colorCanal = (c: string, i: number) => COLOR[c] ?? PALETA_NEUTRA[i % PALETA_NEUTRA.length];

// Indicadores de marketing de una selección de pedidos y de gasto
function mk(P: Pedido[], G: Gasto[], pago: Set<string>) {
  const pp = P.filter((p) => pago.has(p.canal));
  const inversion = G.filter((g) => pago.has(g.canal)).reduce((s, g) => s + g.gasto_eur, 0);
  const ventasPago = pp.reduce((s, p) => s + venta(p), 0);
  const netaPago = pp.reduce((s, p) => s + (p.estado === 'cancelled' ? 0 : ventaNeta(p)), 0);
  const total = P.reduce((s, p) => s + venta(p), 0);
  const nuevos = pp.filter((p) => p.nuevo_cliente).length;
  return { inversion, ventasPago, iec: div(netaPago, inversion), cpa: div(inversion, pp.filter((p) => p.estado !== 'cancelled').length), cac: div(inversion, nuevos), pctPago: div(ventasPago, total), pedidosPago: pp.length };
}

export default function Marketing({ c }: { c: Ctx }) {
  const { d, f, P, Pant, ant, dias } = c;
  const [gran, setGran] = useState<Gran | null>(null);
  const auto: Gran = dias <= 45 ? 'day' : dias <= 200 ? 'week' : 'month'; // por defecto, la granularidad se adapta al periodo
  const g: Gran = dias > 120 && (gran ?? auto) === 'day' ? 'week' : (gran ?? auto);
  const pago = canalesConGasto(d);
  const G = selGasto(d, f);
  const canales = porCanal(P, G, pago);
  const m = mk(P, G, pago);
  const mp = ant && Pant ? mk(Pant, selGasto(d, { ...f, ...ant }), pago) : null;
  const dv = (a: number, b?: number) => (mp && b != null ? variacion(a, b) : null);
  const conPago = canales.filter((r) => r.conGasto);
  // Comparación de canales para decidir: marzo a junio, fija (lib/conclusiones.ts, igual que sql/c05, c06 y c07).
  const k = useMemo(() => conclusiones(d), [d]);
  const tt = k.c5.canales.find((r) => r.canal === 'TikTok Ads');
  const [t1, , t3] = k.c7.tramos;
  const ranking = [...conPago].filter((r) => isFinite(r.iec)).sort((a, b) => b.iec - a.iec);
  const cuotas = conPago.map((r) => ({ canal: r.canal, 'Cuota de inversión': r.cuotaGasto, 'Cuota de ventas': r.cuotaVentas }));
  const colorDe = (canal: string) => colorCanal(canal, canales.findIndex((r) => r.canal === canal));

  // Inversión y ventas atribuidas por periodo
  const claves = clavesDe(g, f.desde, f.hasta);
  const evo = claves.map((cl) => ({
    label: etiquetaPeriodo(g, cl),
    inversion: G.filter((x_) => pago.has(x_.canal) && claveDe(g, x_.fecha) === cl).reduce((s, x_) => s + x_.gasto_eur, 0),
    ventas: P.filter((p) => pago.has(p.canal) && claveDe(g, p.fecha) === cl).reduce((s, p) => s + venta(p), 0),
  }));
  const apilado = serieDimension(P.map((p) => ({ fecha: p.fecha, k: p.canal, v: venta(p) })), g, f.desde, f.hasta, 8);
  const apiladoRows = apilado.rows.map((r) => ({ ...r, label: etiquetaPeriodo(g, r.clave as string) }));

  return (
    <>
      <Section title="Qué cuesta captar un cliente y cuánto vale (marzo a junio)" sub="Dirección solo da por comparables los canales desde marzo, por el cambio del modelo de atribución. Esta tabla no depende de los filtros. Es la base de la propuesta de reparto del presupuesto de H2, con las cautelas que se indican debajo.">
        <Card info={<><p className="i-def">Coste por cliente nuevo = gasto del canal ÷ personas cuyo primer pedido llegó por ese canal, del 1 de marzo al 30 de junio.</p><p className="i-def">Venta neta a 90 días = lo que vende de media en sus primeros 90 días un cliente nuevo de su país (captados del 1 de febrero al 13 de abril, los últimos con 90 días observables): {eur(k.c3.porPais.find((r) => r.pais === 'DE')?.ventaNeta90d)} en Alemania y {eur(k.c3.porPais.find((r) => r.pais === 'ES')?.ventaNeta90d)} en España.</p><p className="i-def">Retorno de captación = esa venta a 90 días ÷ coste del cliente. El IEC (venta neta atribuida ÷ gasto) se muestra como referencia: casi toda esa venta es recompra.</p></>}>
          <Table rows={k.c5.canales} cols={[
            { key: 'canal', label: 'Canal', left: true, sort: (r) => r.canal, render: (r) => <b>{r.canal}</b> },
            { key: 'gasto', label: 'Gasto', sort: (r) => r.gasto, render: (r) => eur(r.gasto) },
            { key: 'nuevos', label: 'Clientes nuevos', sort: (r) => r.nuevos, render: (r) => num(r.nuevos) },
            { key: 'de', label: 'De ellos, alemanes', sort: (r) => r.nuevosDE, render: (r) => num(r.nuevosDE) },
            { key: 'cac', label: 'Coste por cliente nuevo', sort: (r) => r.costeClienteNuevo, render: (r) => <b>{eur(r.costeClienteNuevo)}</b> },
            { key: 'v90', label: 'Venta neta a 90 días', sort: (r) => r.valor90ClienteNuevo, render: (r) => eur(r.valor90ClienteNuevo) },
            { key: 'ret', label: 'Retorno de captación', sort: (r) => r.retorno, render: (r) => <b>{x(r.retorno, 1)}</b> },
            { key: 'iec', label: 'IEC (referencia)', sort: (r) => r.iec, render: (r) => x(r.iec, 1) },
            { key: 'rec', label: '% venta de recompra', sort: (r) => r.pctVentaRecompra, render: (r) => pct(r.pctVentaRecompra) },
          ]} />
          <p className="i-def" style={{ marginTop: 8 }}>Las muestras son pequeñas: Instagram capta 1 cliente nuevo en cuatro meses y Meta y TikTok, {num(k.c5.canales.find((r) => r.canal === 'Meta Ads')?.nuevos)} cada uno. El orden orienta, pero no permite extrapolar costes. TikTok aparece como el más barato porque gastó solo {eur(k.plan.gasto.find((r) => r.canal === 'TikTok Ads')?.mesMarJun)} al mes tras su recorte, y ese coste difícilmente se mantendría con más inversión.</p>
        </Card>
        <div className="grid g-2" style={{ marginTop: 12 }}>
          <Callout kind="warn" title="A tener en cuenta: la venta atribuida">
            Solo el <b>{pct(k.c6.todos.pct)}</b> de los pedidos repetidos de H1 entra por el canal que captó al cliente, y al azar saldría un {pct(k.c6.todos.azar)}. El canal de un pedido refleja por dónde volvió a entrar el cliente más que quién lo trajo, así que el IEC y el ticket de cada canal no son una buena guía para repartir el presupuesto.
          </Callout>
          <Callout kind="warn" title="A tener en cuenta: TikTok">
            Su gasto bajó de {eur(t1.gastoDia, 2)} a {eur(t3.gastoDia, 2)} al día, de forma escalonada entre el 16 y el 28 de febrero. Con {eur(k.plan.gasto.find((r) => r.canal === 'TikTok Ads')?.mesMarJun)} al mes su IEC es de {x(tt?.iec, 1)} porque el {pct(t3.pctVentaRecompra)} de su venta es recompra. Cuando gastaba {eur(t1.gasto30)} cada 30 días, cada cliente nuevo de más costaba unos {eur(k.c7.costeClienteAdicional)}. Convendría confirmar este gasto con las facturas de TikTok Ads.
          </Callout>
        </div>
      </Section>

      <Section title="Canales de pago" sub={`Canales con inversión registrada: ${[...pago].join(', ') || 'ninguno'}.`}>
        <KpiBoard>
          <KpiGroup title="Inversión" w={4}>
            <Kpi m="inversion" tone="dark" value={eur(m.inversion)} delta={dv(m.inversion, mp?.inversion)} />
            <Kpi m="ventas_pago" value={eur(m.ventasPago)} delta={dv(m.ventasPago, mp?.ventasPago)} />
          </KpiGroup>
          <KpiGroup title="Retorno" w={4}>
            <Kpi m="iec" tone="accent" value={x(m.iec, 1)} delta={dv(m.iec, mp?.iec)} />
            <Kpi m="pct_ventas_pago" value={pct(m.pctPago)} delta={dv(m.pctPago, mp?.pctPago)} />
          </KpiGroup>
          <KpiGroup title="Coste de adquisición" w={4}>
            <Kpi m="cpa" value={eur(m.cpa, 2)} delta={dv(m.cpa, mp?.cpa)} invert />
            <Kpi m="cac" value={eur(m.cac, 2)} delta={dv(m.cac, mp?.cac)} invert />
          </KpiGroup>
        </KpiBoard>
      </Section>

      <Section title="Venta atribuida por canal" sub="Según los filtros. Haz clic en una columna para ordenar. Los canales sin inversión no tienen retorno por euro: se muestran con sus ventas. La venta atribuida incluye la recompra de clientes captados por otros canales.">
        <Card>
          <Table rows={canales} initialSort="ventas" cols={[
            { key: 'canal', label: 'Canal', left: true, sort: (r) => r.canal, render: (r) => <><b>{r.canal}</b> {!r.conGasto && <span className="tag">sin inversión</span>}</> },
            { key: 'ventas', label: 'Ventas', sort: (r) => r.ventas, render: (r) => eur(r.ventas) },
            { key: 'shareVentas', label: '% ventas', sort: (r) => r.shareVentas, render: (r) => pct(r.shareVentas) },
            { key: 'pedidos', label: 'Pedidos', sort: (r) => r.pedidos, render: (r) => num(r.pedidos) },
            { key: 'ticket', label: 'Ticket', sort: (r) => r.ticket, render: (r) => eur(r.ticket, 2) },
            { key: 'nuevos', label: 'Nuevos', sort: (r) => r.nuevos, render: (r) => num(r.nuevos) },
            { key: 'gasto', label: 'Inversión', sort: (r) => (r.conGasto ? r.gasto : -1), render: (r) => (r.conGasto ? eur(r.gasto) : '—') },
            { key: 'iec', label: 'IEC', sort: (r) => r.iec, render: (r) => (isFinite(r.iec) ? x(r.iec, 1) : '—') },
            { key: 'cpa', label: 'CPA', sort: (r) => r.cpa, render: (r) => eur(r.cpa, 2) },
            { key: 'cac', label: 'CAC', sort: (r) => r.cac, render: (r) => eur(r.cac, 2) },
            { key: 'cg', label: '% inversión', sort: (r) => r.cuotaGasto, render: (r) => pct(r.cuotaGasto) },
            { key: 'cv', label: '% ventas pago', sort: (r) => r.cuotaVentas, render: (r) => pct(r.cuotaVentas) },
            { key: 'dev', label: '% devolución', sort: (r) => r.devolucion, render: (r) => pct(r.devolucion) },
          ]} />
        </Card>
      </Section>

      <Section title="Venta atribuida frente a inversión" sub="Según los filtros. Ayuda a ver el peso de cada canal en la venta, pero no conviene usarlo para repartir el presupuesto: la venta atribuida es, sobre todo, recompra de clientes que captó otro canal.">
        <div className="grid g-2">
          <Card title="IEC por canal" info={<p className="i-def">Venta neta atribuida a cada canal de pago por cada euro invertido (Índice de Eficiencia de Canal, nota de dirección 1). Es un retorno medio y mezcla recompra: no indica qué canal capta mejor ni qué rendiría el siguiente euro.</p>}>
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={ranking} layout="vertical" margin={{ left: 10, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => v + '×'} />
                  <YAxis type="category" dataKey="canal" tickLine={false} axisLine={false} fontSize={11} width={100} tick={AX} />
                  <Tooltip content={<Tip fmt={(v: number) => x(v, 1)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Bar dataKey="iec" name="IEC" radius={3}>{ranking.map((r) => <Cell key={r.canal} fill={colorDe(r.canal)} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Cuota de inversión y de ventas" info={<p className="i-def">Peso de cada canal de pago en la inversión total y en las ventas atribuidas a los canales de pago. Que la barra de ventas supere a la de inversión no significa que el canal capte mejor: casi toda la venta atribuida es recompra.</p>}>
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={cuotas}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="canal" tickLine={false} axisLine={false} fontSize={11} tick={AX} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => Math.round(v * 100) + '%'} />
                  <Tooltip content={<Tip fmt={(v: number) => pct(v)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Cuota de inversión" fill="#b9bdbb" radius={3} />
                  <Bar dataKey="Cuota de ventas" fill="#5b9a7b" radius={3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Evolución" action={<Seg value={g} onChange={(v) => setGran(v as Gran)} options={[{ v: 'day', l: 'Día', off: dias > 120 }, { v: 'week', l: 'Semana' }, { v: 'month', l: 'Mes' }]} />}>
        <div className="grid g-2">
          <Card title="Inversión y ventas de canales de pago" info={<p className="i-def">Barras: inversión de cada periodo (eje izquierdo). Línea: ventas atribuidas a canales de pago (eje derecho).</p>}>
            <div className="chart">
              <ResponsiveContainer>
                <ComposedChart data={evo}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={AX} minTickGap={14} />
                  <YAxis yAxisId="l" tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => eur(v)} />
                  <YAxis yAxisId="r" orientation="right" tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => (v >= 1000 ? num(v / 1000, 0) + 'k' : v)} />
                  <Tooltip content={<Tip fmt={(v: number) => eur(v)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="l" dataKey="inversion" name="Inversión" fill="#d5d8d6" />
                  <Line yAxisId="r" dataKey="ventas" name="Ventas atribuidas" stroke="#0b0c0c" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Ventas por canal" info={<p className="i-def">Ventas de cada periodo apiladas por canal de adquisición, incluidos los canales sin inversión.</p>}>
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={apiladoRows} barCategoryGap={g === 'day' ? 1 : '22%'}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={AX} minTickGap={14} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => (v >= 1000 ? num(v / 1000, 0) + 'k' : v)} />
                  <Tooltip content={<Tip fmt={(v: number) => eur(v)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  {apilado.grupos.map((gname) => <Bar key={gname} dataKey={gname} stackId="a" fill={gname === 'Otros' ? '#e1e3e2' : colorDe(gname)} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </Section>
    </>
  );
}
