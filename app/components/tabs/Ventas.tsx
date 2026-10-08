'use client';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { codigosDe, div, lineasDe, serieComparada, serieDimension, serieTemporal, variacion, type Gran, type Item, type Kpis } from '@/lib/calc';
import { fmtES } from '@/lib/dates';
import { ESTADO_LABEL, PALETA_NEUTRA, eur, etiquetaPeriodo, num, pct } from '@/lib/format';
import type { Ctx } from '../ctx';
import { Card, Kpi, Section, Seg, Table, Tip, AX, GRID, KpiBoard, KpiGroup } from '../ui';

type Dim = 'pais' | 'canal' | 'categoria' | 'estado' | 'codigo';
const DIMS: { v: Dim; l: string }[] = [{ v: 'pais', l: 'País' }, { v: 'canal', l: 'Canal' }, { v: 'categoria', l: 'Categoría' }, { v: 'estado', l: 'Estado' }, { v: 'codigo', l: 'Código' }];
const PAIS: Record<string, string> = { ES: 'España', DE: 'Alemania' };

type Fila = { k: string; ventas: number; pedidos: number; unidades: number };
function agregar(items: { k: string; id: number; v: number; u: number }[]): Map<string, Fila> {
  const m = new Map<string, { f: Fila; ids: Set<number> }>();
  items.forEach((i) => {
    let x = m.get(i.k);
    if (!x) { x = { f: { k: i.k, ventas: 0, pedidos: 0, unidades: 0 }, ids: new Set() }; m.set(i.k, x); }
    x.f.ventas += i.v; x.f.unidades += i.u; x.ids.add(i.id);
  });
  return new Map([...m.entries()].map(([k, x]) => [k, { ...x.f, pedidos: x.ids.size }]));
}

export default function Ventas({ c }: { c: Ctx }) {
  const { d, f, P, Pant, k, kp, ant, dias } = c;
  const [gran, setGran] = useState<Gran | null>(null);
  const auto: Gran = dias <= 45 ? 'day' : dias <= 200 ? 'week' : 'month';
  const [dim, setDim] = useState<Dim>('pais');
  const g: Gran = dias > 120 && (gran ?? auto) === 'day' ? 'week' : (gran ?? auto);
  const dv = (s: (x: Kpis) => number) => (kp ? variacion(s(k), s(kp)) : null);

  // Elementos (fecha, grupo, valor) para la dimensión elegida
  const items = useMemo(() => {
    const clave = (p: { pais: string; canal: string; estado: string }, p0: any): string[] =>
      dim === 'pais' ? [PAIS[p.pais] ?? p.pais] : dim === 'canal' ? [p.canal] : dim === 'estado' ? [ESTADO_LABEL[p.estado] ?? p.estado] : codigosDe(p0);
    const build = (PP: typeof P) => {
      if (dim === 'categoria') {
        const fecha = new Map(PP.map((p) => [p.id, p.fecha]));
        return lineasDe(d, PP, f.categorias).map((l) => ({ k: l.categoria, id: l.pedido_id, fecha: fecha.get(l.pedido_id) as string, v: l.importe_eur, u: l.cantidad }));
      }
      return PP.flatMap((p) => clave(p, p).map((k) => ({ k, id: p.id, fecha: p.fecha, v: p.estado === 'cancelled' ? 0 : p.subtotal_eur, u: p.estado === 'cancelled' ? 0 : p.unidades })));
    };
    return { act: build(P), ant: Pant ? build(Pant) : null };
  }, [d, f.categorias, P, Pant, dim]);

  const actual = agregar(items.act), previo = items.ant ? agregar(items.ant) : null;
  const filas = [...actual.values()].map((x) => ({ ...x, ticket: div(x.ventas, x.pedidos), share: div(x.ventas, k.ventas), delta: previo ? variacion(x.ventas, previo.get(x.k)?.ventas ?? 0) : NaN })).sort((a, b) => b.ventas - a.ventas);

  const gComp: Gran = g === 'month' ? 'week' : g;
  const comp = ant && Pant ? serieComparada(P, Pant, f, ant, gComp).map((r) => ({ ...r, label: r.claveActual ? etiquetaPeriodo(gComp, r.claveActual) : '' })) : null;
  const serie = serieTemporal(P, g, f.desde, f.hasta).map((x) => ({ ...x, label: etiquetaPeriodo(g, x.clave as string) }));
  const stack = serieDimension(items.act.map((i) => ({ fecha: i.fecha, k: i.k, v: i.v })) as Item[], g, f.desde, f.hasta);
  const stackRows = stack.rows.map((r) => ({ ...r, label: etiquetaPeriodo(g, r.clave as string) }));

  return (
    <>
      <Section title="Indicadores de ventas" sub={`${fmtES(f.desde)} – ${fmtES(f.hasta)} · ${dias} ${dias === 1 ? 'día' : 'días'}`}>
        <KpiBoard>
          <KpiGroup title="Ingresos" w={7} hero>
            <Kpi m="ventas" tone="dark" wide value={eur(k.ventas)} delta={dv((x) => x.ventas)} />
            <Kpi m="ventas_netas" value={eur(k.ventasNetas)} delta={dv((x) => x.ventasNetas)} />
            <Kpi m="facturacion" value={eur(k.facturacion)} delta={dv((x) => x.facturacion)} />
          </KpiGroup>
          <KpiGroup title="Pedidos" w={5}>
            <Kpi m="pedidos" value={num(k.pedidos)} delta={dv((x) => x.pedidos)} />
            <Kpi m="ticket" value={eur(k.ticket, 2)} delta={dv((x) => x.ticket)} />
            <Kpi m="unidades" value={num(k.unidades)} delta={dv((x) => x.unidades)} />
            <Kpi m="upt" value={num(k.upt, 2)} delta={dv((x) => x.upt)} />
          </KpiGroup>
          <KpiGroup title="Precio y ritmo" w={6}>
            <Kpi m="precio_medio" value={eur(k.precioMedio, 2)} delta={dv((x) => x.precioMedio)} />
            <Kpi m="ventas_dia" value={eur(div(k.ventas, dias), 0)} delta={kp && c.ant ? variacion(div(k.ventas, dias), div(kp.ventas, dias)) : null} />
          </KpiGroup>
          <KpiGroup title="Impuestos y envío" w={6}>
            <Kpi m="impuestos" value={eur(k.impuestos)} delta={dv((x) => x.impuestos)} />
            <Kpi m="envios" value={eur(k.envios)} delta={dv((x) => x.envios)} />
          </KpiGroup>
        </KpiBoard>
      </Section>

      <Section title="Evolución" action={<Seg value={g} onChange={(v) => setGran(v as Gran)} options={[{ v: 'day', l: 'Día', off: dias > 120 }, { v: 'week', l: 'Semana' }, { v: 'month', l: 'Mes' }]} />}>
        <div className="grid g-2">
          {comp ? (
            <Card title="Ventas frente al periodo anterior" info={<p className="i-def">Ventas de cada tramo del periodo seleccionado (línea oscura) frente al mismo tramo del periodo anterior de igual duración (línea gris). Los tramos se alinean por posición: primer día con primer día, etc.</p>}>
              <div className="chart">
                <ResponsiveContainer>
                  <LineChart data={comp}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={AX} minTickGap={14} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => (v >= 1000 ? num(v / 1000, 0) + 'k' : v)} />
                    <Tooltip content={<Tip fmt={(v: number) => eur(v)} />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Line dataKey="actual" name="Periodo seleccionado" stroke="#0b0c0c" strokeWidth={2} dot={false} connectNulls />
                    <Line dataKey="anterior" name="Periodo anterior" stroke="#9aa09d" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : (
            <Card title="Ventas por periodo" info={<p className="i-def">Ventas de cada periodo. Para ver la comparativa con el periodo anterior, elige un rango que no empiece en el primer día con datos.</p>}>
              <div className="chart">
                <ResponsiveContainer>
                  <BarChart data={serie}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={AX} minTickGap={14} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => (v >= 1000 ? num(v / 1000, 0) + 'k' : v)} />
                    <Tooltip content={<Tip fmt={(v: number) => eur(v)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                    <Bar dataKey="ventas" name="Ventas" fill="#2c302e" radius={3} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          <Card title={`Ventas por ${DIMS.find((x) => x.v === dim)!.l.toLowerCase()}`} info={<p className="i-def">Ventas de cada periodo apiladas por la dimensión elegida (cámbiala en el desglose de abajo). Se muestran los 6 grupos mayores y el resto como «Otros».</p>}>
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={stackRows} barCategoryGap={g === 'day' ? 1 : '22%'}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={AX} minTickGap={14} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => (v >= 1000 ? num(v / 1000, 0) + 'k' : v)} />
                  <Tooltip content={<Tip fmt={(v: number) => eur(v)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  {stack.grupos.map((gname, i) => <Bar key={gname} dataKey={gname} stackId="a" fill={PALETA_NEUTRA[i % PALETA_NEUTRA.length]} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Desglose" sub={dim === 'codigo' ? 'Un pedido con varios códigos cuenta en cada uno, por lo que la suma supera el total.' : 'Ventas, pedidos, ticket y unidades por grupo, con su variación frente al periodo anterior.'}
        action={<Seg value={dim} onChange={(v) => setDim(v as Dim)} options={DIMS.map((x) => ({ v: x.v, l: x.l }))} />}>
        <Card>
          <Table rows={filas} initialSort="ventas" cols={[
            { key: 'k', label: DIMS.find((x) => x.v === dim)!.l, left: true, render: (r) => <b>{r.k}</b>, sort: (r) => r.k },
            { key: 'ventas', label: 'Ventas', render: (r) => eur(r.ventas), sort: (r) => r.ventas },
            { key: 'share', label: '% ventas', render: (r) => pct(r.share), sort: (r) => r.share },
            { key: 'delta', label: 'vs anterior', render: (r) => (isFinite(r.delta) ? <span className={r.delta >= 0 ? 'pos' : 'neg'}>{r.delta >= 0 ? '▲' : '▼'} {num(Math.abs(r.delta) * 100, 1)} %</span> : '—'), sort: (r) => r.delta },
            { key: 'pedidos', label: 'Pedidos', render: (r) => num(r.pedidos), sort: (r) => r.pedidos },
            { key: 'ticket', label: 'Ticket', render: (r) => eur(r.ticket, 2), sort: (r) => r.ticket },
            { key: 'unidades', label: 'Unidades', render: (r) => num(r.unidades), sort: (r) => r.unidades },
          ]} />
        </Card>
      </Section>
    </>
  );
}
