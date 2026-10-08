'use client';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ESTADOS, devoluciones, devolucionesPorMotivo, porDimension, serieDimension, variacion, type Gran, type Kpis } from '@/lib/calc';
import { ESTADO_COLOR, ESTADO_LABEL, eur, etiquetaPeriodo, num, pct } from '@/lib/format';
import type { Ctx } from '../ctx';
import { Card, Kpi, Section, Seg, Table, Tip, AX, GRID, KpiBoard, KpiGroup } from '../ui';

export default function Operaciones({ c }: { c: Ctx }) {
  const { P, k, kp, f, dias } = c;
  const [gran, setGran] = useState<Gran | null>(null);
  const auto: Gran = dias <= 45 ? 'day' : dias <= 200 ? 'week' : 'month'; // por defecto, la granularidad se adapta al periodo
  const g: Gran = dias > 120 && (gran ?? auto) === 'day' ? 'week' : (gran ?? auto);
  const dv = (s: (x: Kpis) => number) => (kp ? variacion(s(k), s(kp)) : null);
  const dvr = k.dev;
  const estados = serieDimension(P.map((p) => ({ fecha: p.fecha, k: ESTADO_LABEL[p.estado], v: 1 })), g, f.desde, f.hasta);
  const estRows = estados.rows.map((r) => ({ ...r, label: etiquetaPeriodo(g, r.clave as string) }));
  const colorEstado = (lab: string) => ESTADOS.map((e) => [ESTADO_LABEL[e], ESTADO_COLOR[e]] as const).find((x) => x[0] === lab)?.[1] ?? '#c6c9c7';
  const motivos = devolucionesPorMotivo(P);
  const grupos = [
    ...porDimension(P, (p) => p.canal).map((r) => ({ g: r.k, tipo: 'Canal', r, dv: devoluciones(P.filter((p) => p.canal === r.k)) })),
    ...porDimension(P, (p) => p.pais).map((r) => ({ g: r.k === 'ES' ? 'España' : r.k === 'DE' ? 'Alemania' : r.k, tipo: 'País', r, dv: devoluciones(P.filter((p) => p.pais === r.k)) })),
  ];
  const cuenta = (e: string) => P.filter((p) => p.estado === e).length;

  return (
    <>
      <Section title="Estado de los pedidos" sub="Reparto de los pedidos de la selección según su estado.">
        <KpiBoard>
          <KpiGroup title="Estado" w={7}>
            <Kpi m="entregados" tone="dark" value={num(cuenta('delivered'))} detail={`${pct(k.pedidos ? cuenta('delivered') / k.pedidos : NaN)} de los pedidos.`} />
            <Kpi m="pendientes" value={num(k.pendientes)} detail={`${pct(k.pedidos ? k.pendientes / k.pedidos : NaN)} de los pedidos.`} delta={kp ? variacion(k.pendientes, kp.pendientes) : null} invert />
            <Kpi m="cancelacion" value={pct(k.tasaCancel)} detail={`${num(k.cancelados)} pedidos cancelados.`} delta={dv((x) => x.tasaCancel)} invert />
          </KpiGroup>
          <KpiGroup title="Envío" w={5}>
            <Kpi m="envio_gratis" value={pct(k.envioGratis)} delta={dv((x) => x.envioGratis)} />
            <Kpi m="coste_envio" value={eur(k.envioMedio, 2)} delta={dv((x) => x.envioMedio)} />
          </KpiGroup>
        </KpiBoard>
      </Section>

      <Section title="Devoluciones" sub="Un pedido devuelto es el pedido entero. Un pedido con devolución parcial se entregó y el cliente devolvió algunos productos. Las tasas se calculan sobre pedidos y unidades entregados o devueltos.">
        <KpiBoard>
          <KpiGroup title="Pedidos" w={6}>
            <Kpi m="dev_pedidos" tone="accent" value={pct(dvr.tasaPedidos)} delta={dv((x) => x.dev.tasaPedidos)} invert detail={`${num(dvr.pedidosConDevolucion)} de ${num(dvr.pedidosBase)} pedidos.`} />
            <Kpi m="dev_total" value={num(dvr.pedidosTotal)} detail={`${pct(dvr.tasaPedidosTotal)} de los pedidos entregados o devueltos.`} delta={dv((x) => x.dev.pedidosTotal)} invert />
            <Kpi m="dev_parcial" value={num(dvr.pedidosParcial)} detail={`${pct(dvr.tasaPedidosParcial)} de los pedidos entregados o devueltos.`} delta={dv((x) => x.dev.pedidosParcial)} invert />
          </KpiGroup>
          <KpiGroup title="Productos e importe" w={6}>
            <Kpi m="dev_productos" value={pct(dvr.tasaProductos)} delta={dv((x) => x.dev.tasaProductos)} invert detail={`${num(dvr.unidadesDevueltas)} de ${num(dvr.unidadesBase)} unidades. ${num(dvr.unidadesTotal)} de pedidos totales y ${num(dvr.unidadesParcial)} de parciales.`} />
            <Kpi m="reembolsado" value={eur(dvr.importe)} delta={dv((x) => x.reembolsos)} invert />
            <Kpi m="ventas_netas" tone="dark" value={eur(k.ventasNetas)} delta={dv((x) => x.ventasNetas)} />
          </KpiGroup>
        </KpiBoard>
        <div className="grid g-2" style={{ marginTop: 12 }}>
          <Card title="Motivos de devolución" info={<p className="i-def">Número de pedidos por motivo registrado, separado entre devolución total (pedido entero) y parcial (algunos productos).</p>}>
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={motivos} layout="vertical" margin={{ left: 10, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} tick={AX} allowDecimals={false} />
                  <YAxis type="category" dataKey="motivo" tickLine={false} axisLine={false} fontSize={11} width={170} tick={AX} />
                  <Tooltip content={<Tip fmt={(v: number) => num(v) + ' pedidos'} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="total" name="Pedido devuelto (total)" stackId="a" fill="#c98468" />
                  <Bar dataKey="parcial" name="Devolución parcial" stackId="a" fill="#d0b27a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Pedidos por estado en el tiempo" info={<p className="i-def">Número de pedidos de cada periodo según su estado.</p>}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <Seg value={g} onChange={(v) => setGran(v as Gran)} options={[{ v: 'day', l: 'Día', off: dias > 120 }, { v: 'week', l: 'Semana' }, { v: 'month', l: 'Mes' }]} />
            </div>
            <div className="chart short">
              <ResponsiveContainer>
                <BarChart data={estRows} barCategoryGap={g === 'day' ? 1 : '22%'}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={AX} minTickGap={14} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tick={AX} allowDecimals={false} />
                  <Tooltip content={<Tip fmt={(v: number) => num(v)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  {estados.grupos.map((gname) => <Bar key={gname} dataKey={gname} stackId="a" fill={colorEstado(gname)} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <div style={{ marginTop: 12 }}>
          <Card title="Cancelaciones y devoluciones por canal y país" note="Dos tasas de devolución distintas: pedidos con alguna devolución y productos devueltos.">
            <Table rows={grupos} initialSort="tp" cols={[
              { key: 'g', label: 'Grupo', left: true, render: (r) => <><b>{r.g}</b> <span className="tag">{r.tipo}</span></>, sort: (r) => r.g },
              { key: 'pedidos', label: 'Pedidos', render: (r) => num(r.r.pedidos), sort: (r) => r.r.pedidos },
              { key: 'canc', label: '% cancelados', render: (r) => pct(r.r.tasaCancel), sort: (r) => r.r.tasaCancel },
              { key: 'tp', label: '% pedidos con devolución', render: (r) => pct(r.dv.tasaPedidos), sort: (r) => r.dv.tasaPedidos },
              { key: 'tt', label: 'Totales / parciales', render: (r) => `${r.dv.pedidosTotal} / ${r.dv.pedidosParcial}`, sort: (r) => r.dv.pedidosConDevolucion },
              { key: 'pu', label: '% productos devueltos', render: (r) => pct(r.dv.tasaProductos), sort: (r) => r.dv.tasaProductos },
              { key: 'reemb', label: 'Reembolsado', render: (r) => eur(r.dv.importe), sort: (r) => r.dv.importe },
            ]} />
          </Card>
        </div>
      </Section>
    </>
  );
}
