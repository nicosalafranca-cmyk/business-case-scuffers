'use client';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { descuentos, div, lineasDe, porCategoria, porProducto, resenasStats, selPedidos, serieDimension, topShare, variacion, type Gran } from '@/lib/calc';
import { eur, etiquetaPeriodo, mesLabel, num, pct, PALETA_NEUTRA } from '@/lib/format';
import type { Ctx } from '../ctx';
import { Card, Kpi, Section, Seg, Table, Tip, AX, GRID, KpiBoard, KpiGroup } from '../ui';

const COL: Record<string, string> = { Ropa: '#1a1c1b', Calzado: '#6e7471', Accesorios: '#b9bdbb', Deporte: '#5b9a7b', 'Sin catálogo': '#e1e3e2' };
const colorCat = (c: string, i: number) => COL[c] ?? PALETA_NEUTRA[i % PALETA_NEUTRA.length];

export default function Producto({ c }: { c: Ctx }) {
  const { d, f, P, Pant, dias } = c;
  const [gran, setGran] = useState<Gran | null>(null);
  const auto: Gran = dias <= 45 ? 'day' : dias <= 200 ? 'week' : 'month'; // por defecto, la granularidad se adapta al periodo
  const g: Gran = dias > 120 && (gran ?? auto) === 'day' ? 'week' : (gran ?? auto);
  const L = lineasDe(d, P, f.categorias);
  const Lant = Pant ? lineasDe(d, Pant, f.categorias) : null;
  const cats = porCategoria(L);
  const prods = porProducto(L, d).filter((p) => f.categorias.includes(p.categoria));
  const vendidos = prods.filter((p) => p.ventas > 0);
  const total = L.reduce((s, l) => s + l.importe_eur, 0);
  const unidades = L.reduce((s, l) => s + l.cantidad, 0);
  const dsc = descuentos(L);
  const rs = resenasStats(d, f);
  const nTop = Math.max(1, Math.ceil(vendidos.length * 0.2));
  const pareto = topShare(vendidos.map((p) => p.ventas), nTop);
  const top = vendidos.slice(0, 10);
  const dispersion = vendidos.filter((p) => p.valoracion != null && p.resenas >= 10).map((p) => ({ x: p.valoracion, y: p.ventas, z: p.unidades, name: p.producto, cat: p.categoria }));
  const dvt = Lant ? variacion(total, Lant.reduce((s, l) => s + l.importe_eur, 0)) : null;
  const dvu = Lant ? variacion(unidades, Lant.reduce((s, l) => s + l.cantidad, 0)) : null;

  const fecha = new Map(P.map((p) => [p.id, p.fecha]));
  const evo = serieDimension(L.map((l) => ({ fecha: fecha.get(l.pedido_id) as string, k: l.categoria, v: l.importe_eur })), g, f.desde, f.hasta);
  const evoRows = evo.rows.map((r) => ({ ...r, label: etiquetaPeriodo(g, r.clave as string) }));
  const catList = [...new Set(L.map((l) => l.categoria))];
  // Comparación entre categorías solo en mayo–junio: Deporte se da de alta el 1 de mayo (el enunciado dice «desde principios de año»).
  const Lmj = lineasDe(d, selPedidos(d, { ...f, desde: '2026-05-01', hasta: '2026-06-30' }), f.categorias);
  const catsMJ = porCategoria(Lmj).map((r) => {
    const refs = new Set(Lmj.filter((l) => l.categoria === r.categoria).map((l) => l.producto_id)).size;
    const inact = Lmj.filter((l) => l.categoria === r.categoria && !l.activo);
    return { ...r, refs, porRef: div(r.ventas, refs), udsRef: div(r.unidades, refs), refsInact: new Set(inact.map((l) => l.producto_id)).size, pctInact: div(inact.reduce((s, l) => s + l.importe_eur, 0), r.ventas) };
  });

  return (
    <>
      <Section title="Indicadores de producto" sub="Calculados desde las líneas de pedido de la selección.">
        <KpiBoard>
          <KpiGroup title="Ventas y precio" w={12}>
            <Kpi m="ventas_producto" tone="dark" value={eur(total)} delta={dvt} />
            <Kpi m="unidades" value={num(unidades)} delta={dvu} />
            <Kpi m="precio_medio" value={eur(unidades ? total / unidades : NaN, 2)} />
            <Kpi m="descuento_medio" value={pct(dsc.pct)} detail={`${eur(dsc.valor)} frente al precio de catálogo.`} />
          </KpiGroup>
          <KpiGroup title="Catálogo" w={5}>
            <Kpi m="productos_con_ventas" value={`${num(vendidos.length)} / ${num(prods.length)}`} detail="Productos con ventas sobre el total del catálogo seleccionado." />
            <Kpi m="concentracion_productos" value={pct(pareto)} detail={`Peso de los ${num(nTop)} productos más vendidos (el 20 % de los que han vendido).`} />
          </KpiGroup>
          <KpiGroup title="Opiniones" w={7}>
            <Kpi m="valoracion" tone="accent" value={isFinite(rs.media) ? `${num(rs.media, 2)} / 5` : '—'} detail="Reseñas publicadas dentro del periodo seleccionado." />
            <Kpi m="resenas" value={num(rs.n)} />
            <Kpi m="pct_positivas" value={pct(rs.positivas)} />
          </KpiGroup>
        </KpiBoard>
      </Section>

      <Section title="Categorías desde que existe Deporte (mayo y junio)" sub="Las fichas propias de Deporte se dan de alta el 1 de mayo, aunque el enunciado dice que las cuatro categorías están en catálogo desde principios de año. Zapatillas Trail Urbanas, que vende desde enero, se cuenta en Deporte. Con el semestre entero parece residual, así que aquí se comparan solo mayo y junio, sea cual sea el periodo seleccionado (el resto de filtros sí se aplica). La mitad de la venta de Deporte sale de dos fichas marcadas como inactivas que siguen vendiendo.">
        <Card info={<p className="i-def">Líneas de todas las fichas, activas o no, en pedidos no cancelados del 1 de mayo al 30 de junio, antes de devoluciones. Venta por referencia = venta entre las referencias con venta en ese tramo. Zapatillas Trail Urbanas cuenta en Deporte (en la base está en Accesorios).</p>}>
          <Table rows={catsMJ} initialSort="porRef" cols={[
            { key: 'categoria', label: 'Categoría', left: true, render: (r) => <b>{r.categoria}</b>, sort: (r) => r.categoria },
            { key: 'ventas', label: 'Ventas', render: (r) => eur(r.ventas), sort: (r) => r.ventas },
            { key: 'share', label: '% ventas', render: (r) => pct(r.share), sort: (r) => r.share },
            { key: 'refs', label: 'Referencias', render: (r) => num(r.refs), sort: (r) => r.refs },
            { key: 'porRef', label: 'Venta por referencia', render: (r) => <b>{eur(r.porRef)}</b>, sort: (r) => r.porRef },
            { key: 'udsRef', label: 'Uds por referencia', render: (r) => num(r.udsRef, 1), sort: (r) => r.udsRef },
            { key: 'precio', label: 'Precio medio', render: (r) => eur(r.precioMedio, 2), sort: (r) => r.precioMedio },
            { key: 'inact', label: '% de fichas inactivas', render: (r) => (r.refsInact ? <span className="tag red">{pct(r.pctInact)} · {num(r.refsInact)} fichas</span> : '—'), sort: (r) => r.pctInact },
          ]} />
        </Card>
      </Section>

      <Section title="Categorías" action={<Seg value={g} onChange={(v) => setGran(v as Gran)} options={[{ v: 'day', l: 'Día', off: dias > 120 }, { v: 'week', l: 'Semana' }, { v: 'month', l: 'Mes' }]} />}>
        <div className="grid g-2">
          <Card title="Ventas por categoría">
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={cats} layout="vertical" margin={{ left: 10, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => num(v / 1000, 0) + 'k'} />
                  <YAxis type="category" dataKey="categoria" tickLine={false} axisLine={false} fontSize={11} width={90} tick={AX} />
                  <Tooltip content={<Tip fmt={(v: number) => eur(v)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Bar dataKey="ventas" name="Ventas" radius={3}>{cats.map((r, i) => <Cell key={r.categoria} fill={colorCat(r.categoria, i)} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Detalle por categoría">
            <Table rows={cats} initialSort="ventas" cols={[
              { key: 'categoria', label: 'Categoría', left: true, render: (r) => <b>{r.categoria}</b>, sort: (r) => r.categoria },
              { key: 'ventas', label: 'Ventas', render: (r) => eur(r.ventas), sort: (r) => r.ventas },
              { key: 'share', label: '% ventas', render: (r) => pct(r.share), sort: (r) => r.share },
              { key: 'unidades', label: 'Uds', render: (r) => num(r.unidades), sort: (r) => r.unidades },
              { key: 'precio', label: 'Precio medio', render: (r) => eur(r.precioMedio, 2), sort: (r) => r.precioMedio },
              { key: 'pedidos', label: 'Pedidos', render: (r) => num(r.pedidos), sort: (r) => r.pedidos },
            ]} />
          </Card>
        </div>
        <div style={{ marginTop: 12 }}>
          <Card title="Ventas por categoría en el tiempo">
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={evoRows} barCategoryGap={g === 'day' ? 1 : '22%'}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={AX} minTickGap={14} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => (v >= 1000 ? num(v / 1000, 0) + 'k' : v)} />
                  <Tooltip content={<Tip fmt={(v: number) => eur(v)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  {evo.grupos.map((gname) => <Bar key={gname} dataKey={gname} stackId="a" fill={gname === 'Otros' ? '#e1e3e2' : colorCat(gname, catList.indexOf(gname))} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Productos">
        <div className="grid g-2">
          <Card title="Top 10 por ventas" info={<p className="i-def">Los 10 productos con más ventas en la selección. Los productos inactivos en el catálogo se marcan con borde de aviso.</p>}>
            <div className="chart tall">
              <ResponsiveContainer>
                <BarChart data={top} layout="vertical" margin={{ left: 20, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => num(v / 1000, 1) + 'k'} />
                  <YAxis type="category" dataKey="producto" tickLine={false} axisLine={false} fontSize={11} width={140} tick={AX} />
                  <Tooltip content={<Tip fmt={(v: number) => eur(v)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Bar dataKey="ventas" name="Ventas" radius={3}>{top.map((p, i) => <Cell key={p.id} fill={colorCat(p.categoria, i)} stroke={p.activo ? 'none' : '#c98468'} strokeWidth={p.activo ? 0 : 2} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Ventas frente a valoración" info={<p className="i-def">Cada punto es un producto. Arriba a la derecha: vende mucho y gusta. Abajo a la derecha: gusta pero vende poco. Arriba a la izquierda: vende, pero decepciona. El tamaño del punto son las unidades vendidas. La valoración es la media de las reseñas del primer semestre, solo con 10 o más. La nota no anticipa la devolución (conclusión C9).</p>}>
            <div className="chart tall">
              <ResponsiveContainer>
                <ScatterChart margin={{ left: 0, right: 16, top: 8 }}>
                  <CartesianGrid stroke={GRID} />
                  <XAxis type="number" dataKey="x" name="Valoración" domain={[1, 5]} tickLine={false} fontSize={11} tick={AX} />
                  <YAxis type="number" dataKey="y" name="Ventas" tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => num(v / 1000, 0) + 'k'} />
                  <ZAxis type="number" dataKey="z" range={[50, 320]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }: any) => active && payload?.length ? (
                    <div className="tt"><b>{payload[0].payload.name}</b><div className="r"><span>Valoración</span><span>{num(payload[0].payload.x, 2)}</span></div><div className="r"><span>Ventas</span><span>{eur(payload[0].payload.y)}</span></div><div className="r"><span>Unidades</span><span>{num(payload[0].payload.z)}</span></div></div>) : null} />
                  <Scatter data={dispersion}>{dispersion.map((p, i) => <Cell key={i} fill={colorCat(p.cat, i)} fillOpacity={0.85} />)}</Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <div style={{ marginTop: 12 }}>
          <Card title="Catálogo completo" note="Descuento medio = cuánto por debajo de la tarifa de catálogo se ha vendido, de media. La valoración y las reseñas son del primer semestre. Las fichas inactivas siguen vendiendo y su venta cuenta.">
            <Table rows={prods} initialSort="ventas" limit={12} cols={[
              { key: 'producto', label: 'Producto', left: true, render: (r) => <b>{r.producto}</b>, sort: (r) => r.producto },
              { key: 'categoria', label: 'Categoría', left: true, render: (r) => r.categoria, sort: (r) => r.categoria },
              { key: 'activo', label: 'Estado', render: (r) => <span className={`tag ${r.activo ? '' : 'red'}`}>{r.activo ? 'activo' : 'inactivo'}</span>, sort: (r) => (r.activo ? 1 : 0) },
              { key: 'tarifa', label: 'Tarifa', render: (r) => eur(r.tarifa_eur, 2), sort: (r) => r.tarifa_eur },
              { key: 'unidades', label: 'Uds', render: (r) => num(r.unidades), sort: (r) => r.unidades },
              { key: 'ventas', label: 'Ventas', render: (r) => eur(r.ventas), sort: (r) => r.ventas },
              { key: 'descuento', label: 'Dto. medio', render: (r) => pct(r.descuento), sort: (r) => r.descuento },
              { key: 'valoracion', label: 'Valoración', render: (r) => (r.valoracion != null && r.resenas >= 10 ? num(r.valoracion, 2) : r.valoracion != null ? <span className="muted" title="Menos de 10 reseñas: la media no es comparable">{num(r.valoracion, 2)}*</span> : '—'), sort: (r) => (r.resenas >= 10 ? r.valoracion ?? NaN : NaN) },
              { key: 'resenas', label: 'Reseñas', render: (r) => num(r.resenas), sort: (r) => r.resenas },
            ]} />
          </Card>
        </div>
      </Section>

      <Section title="Opiniones" sub="Reseñas publicadas dentro del periodo seleccionado.">
        <div className="grid g-2">
          <Card title="Distribución de valoraciones">
            <div className="chart short">
              <ResponsiveContainer>
                <BarChart data={rs.dist}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="estrellas" tickLine={false} axisLine={false} fontSize={11} tick={AX} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tick={AX} allowDecimals={false} />
                  <Tooltip content={<Tip fmt={(v: number) => num(v) + ' reseñas'} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Bar dataKey="n" name="Reseñas" fill="#2c302e" radius={3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Valoración media por mes">
            <Table rows={rs.porMes} cols={[
              { key: 'mes', label: 'Mes', left: true, render: (r) => mesLabel(r.mes), sort: (r) => r.mes },
              { key: 'n', label: 'Reseñas', render: (r) => num(r.n), sort: (r) => r.n },
              { key: 'media', label: 'Valoración media', render: (r) => (isFinite(r.media) ? num(r.media, 2) : '—'), sort: (r) => r.media },
            ]} />
          </Card>
        </div>
      </Section>
    </>
  );
}
