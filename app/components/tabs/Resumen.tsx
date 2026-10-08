'use client';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ESTADOS, div, lineasDe, porCategoria, porDimension, recompra, serieTemporal, variacion, type Gran, type Kpis } from '@/lib/calc';
import { fmtES } from '@/lib/dates';
import { ESTADO_COLOR, ESTADO_LABEL, eur, etiquetaPeriodo, num, pct } from '@/lib/format';
import type { Ctx } from '../ctx';
import { BarList, Card, Kpi, Section, Seg, Tip, AX, GRID, KpiBoard, KpiGroup } from '../ui';

export default function Resumen({ c }: { c: Ctx }) {
  const { d, f, P, k, kp, dias } = c;
  const [gran, setGran] = useState<Gran | null>(null);
  const auto: Gran = dias <= 45 ? 'day' : dias <= 200 ? 'week' : 'month'; // por defecto, la granularidad se adapta al periodo
  const g: Gran = dias > 120 && (gran ?? auto) === 'day' ? 'week' : (gran ?? auto);
  const dv = (s: (x: Kpis) => number) => (kp ? variacion(s(k), s(kp)) : null);
  const serie = serieTemporal(P, g, f.desde, f.hasta).map((x) => ({ ...x, label: etiquetaPeriodo(g, x.clave as string) }));
  const rc = recompra(P), rca = c.Pant ? recompra(c.Pant) : null;
  const porEstado = porDimension(P, (p) => p.estado);
  const porPais = porDimension(P, (p) => p.pais);
  const porCanal = porDimension(P, (p) => p.canal);
  const cats = porCategoria(lineasDe(d, P, f.categorias));
  const lista = (rows: { label: string; ventas: number }[]) =>
    rows.slice(0, 6).map((r) => ({ label: r.label, value: eur(r.ventas), share: k.ventas ? r.ventas / k.ventas : 0, sub: ` · ${pct(k.ventas ? r.ventas / k.ventas : NaN, 0)}` }));

  return (
    <>
      <Section title="Indicadores clave" sub={`${fmtES(f.desde)} – ${fmtES(f.hasta)} · ${dias} ${dias === 1 ? 'día' : 'días'}${kp ? ' · variación frente al periodo anterior de igual duración' : ''}`}>
        <KpiBoard>
          <KpiGroup title="Ingresos" w={6} hero>
            <Kpi m="ventas_netas" tone="dark" wide value={eur(k.ventasNetas)} delta={dv((x) => x.ventasNetas)}
              detail={`Ventas ${eur(k.ventas)} − devoluciones ${eur(k.reembolsos)}. Si los códigos hubieran aplicado su descuento: ${eur(k.ventasNetasConDto)}.`}
              split={<>{ESTADOS.filter((e) => e !== 'cancelled').map((e) => { const x = porEstado.find((y) => y.k === e); return x ? <span key={e}>{ESTADO_LABEL[e]} {eur(x.ventas)}</span> : null; })}<span>Cancelados (no son venta) {eur(k.ventasCanceladas)}</span></>} />
            <Kpi m="ventas" value={eur(k.ventas)} delta={dv((x) => x.ventas)} />
            <Kpi m="ticket" value={eur(k.ticket, 2)} delta={dv((x) => x.ticket)} />
          </KpiGroup>
          <KpiGroup title="Pedidos" w={6}>
            <Kpi m="pedidos" value={num(k.pedidos)} delta={dv((x) => x.pedidos)} />
            <Kpi m="unidades" value={num(k.unidades)} delta={dv((x) => x.unidades)} />
            <Kpi m="upt" value={num(k.upt, 2)} delta={dv((x) => x.upt)} />
            <Kpi m="ventas_dia" value={eur(div(k.ventas, dias), 0)} delta={kp ? variacion(div(k.ventas, dias), div(kp.ventas, dias)) : null} />
          </KpiGroup>
          <KpiGroup title="Clientes" w={6}>
            <Kpi m="compradores" value={num(k.compradores)} delta={dv((x) => x.compradores)} />
            <Kpi m="nuevos" value={num(k.nuevos)} delta={dv((x) => x.nuevos)} />
            <Kpi m="recompra" value={pct(rc.tasa)} delta={rca ? variacion(rc.tasa, rca.tasa) : null} />
            <Kpi m="gasto_comprador" value={eur(rc.ventasPorComprador)} delta={rca ? variacion(rc.ventasPorComprador, rca.ventasPorComprador) : null} />
          </KpiGroup>
          <KpiGroup title="Devoluciones" w={6} hero>
            <Kpi m="dev_pedidos" tone="accent" wide value={pct(k.dev.tasaPedidos)} delta={dv((x) => x.dev.tasaPedidos)} invert
              detail={`${num(k.dev.pedidosConDevolucion)} de ${num(k.dev.pedidosBase)} pedidos entregados o devueltos.`}
              split={<><span>Totales {num(k.dev.pedidosTotal)}</span><span>Parciales {num(k.dev.pedidosParcial)}</span></>} />
            <Kpi m="dev_productos" value={pct(k.dev.tasaProductos)} delta={dv((x) => x.dev.tasaProductos)} invert detail={`${num(k.dev.unidadesDevueltas)} de ${num(k.dev.unidadesBase)} unidades.`} />
            <Kpi m="reembolsado" value={eur(k.reembolsos)} delta={dv((x) => x.reembolsos)} invert />
          </KpiGroup>
        </KpiBoard>
      </Section>

      <Section title="Evolución" action={<Seg value={g} onChange={(v) => setGran(v as Gran)} options={[{ v: 'day', l: 'Día', off: dias > 120 }, { v: 'week', l: 'Semana' }, { v: 'month', l: 'Mes' }]} />}>
        <div className="grid g-2">
          <Card title="Ventas por estado" info={<p className="i-def">Ventas de cada periodo separadas por el estado del pedido. Los cancelados no son venta y no aparecen. Permite ver cuánto del ingreso está entregado y cuánto sigue pendiente, cancelado o devuelto.</p>}>
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={serie} barCategoryGap={g === 'day' ? 1 : '22%'}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={AX} minTickGap={14} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => (v >= 1000 ? num(v / 1000, 0) + 'k' : v)} />
                  <Tooltip content={<Tip fmt={(v: number) => eur(v)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  {ESTADOS.filter((e) => e !== 'cancelled').map((e) => <Bar key={e} dataKey={e} name={ESTADO_LABEL[e]} stackId="a" fill={ESTADO_COLOR[e]} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Pedidos y ticket medio" info={<p className="i-def">Barras: número de pedidos de cada periodo (eje izquierdo). Línea: ticket medio, ventas entre pedidos (eje derecho).</p>}>
            <div className="chart">
              <ResponsiveContainer>
                <ComposedChart data={serie}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={AX} minTickGap={14} />
                  <YAxis yAxisId="l" tickLine={false} axisLine={false} fontSize={11} tick={AX} />
                  <YAxis yAxisId="r" orientation="right" domain={[0, 'auto']} tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => eur(v)} />
                  <Tooltip content={<Tip fmt={(v: number, p: any) => (p.dataKey === 'ticket' ? eur(v, 2) : num(v))} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="l" dataKey="pedidos" name="Pedidos" fill="#d5d8d6" />
                  <Line yAxisId="r" dataKey="ticket" name="Ticket medio" stroke="#0b0c0c" strokeWidth={2} dot={g === 'day' ? false : { r: 3, fill: '#0b0c0c' }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Distribución de ventas" sub="Peso de cada grupo en las ventas del periodo. El detalle completo, con comparativa, está en la pestaña Ventas.">
        <div className="grid g-3">
          <Card title="Por país"><BarList items={lista(porPais.map((r) => ({ label: r.k === 'ES' ? 'España' : r.k === 'DE' ? 'Alemania' : r.k, ventas: r.ventas })))} /></Card>
          <Card title="Por canal"><BarList items={lista(porCanal.map((r) => ({ label: r.k, ventas: r.ventas })))} /></Card>
          <Card title="Por categoría"><BarList items={lista(cats.map((r) => ({ label: r.categoria, ventas: r.ventas })))} /></Card>
        </div>
      </Section>
    </>
  );
}
