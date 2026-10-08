'use client';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { descuentos, kpis, lineasDe, porCodigo, porProducto, variacion } from '@/lib/calc';
import { eur, num, pct } from '@/lib/format';
import type { Ctx } from '../ctx';
import { Card, Kpi, Section, Table, Tip, AX, GRID, KpiBoard, KpiGroup } from '../ui';

export default function Promociones({ c }: { c: Ctx }) {
  const { d, f, P, Pant, k } = c;
  const con = kpis(P.filter((p) => p.codigos)), sin = kpis(P.filter((p) => !p.codigos));
  const conA = Pant ? kpis(Pant.filter((p) => p.codigos)) : null, sinA = Pant ? kpis(Pant.filter((p) => !p.codigos)) : null;
  const dobles = P.filter((p) => p.codigos?.includes(' + ')).length;
  const doblesA = Pant ? Pant.filter((p) => p.codigos?.includes(' + ')).length : null;
  const codigos = porCodigo(P);
  // Nota de dirección 7 (ingreso por código): cruzar pedidos con códigos cuenta dos veces los pedidos con dos códigos.
  const cruce = codigos.filter((r) => r.codigo !== 'Sin código').reduce((s, r) => s + r.ventasNetas, 0);
  const L = lineasDe(d, P, f.categorias);
  const dsc = descuentos(L);
  const dscA = Pant ? descuentos(lineasDe(d, Pant, f.categorias)) : null;
  const dv = (a: number, b?: number | null) => (b != null && Pant ? variacion(a, b) : null);
  const prods = porProducto(L, d).filter((p) => p.ventas > 0 && isFinite(p.descuento) && p.descuento > 0.0005).sort((a, b) => b.descuento - a.descuento);

  return (
    <>
      <Section title="Códigos promocionales" sub="Cruza cada pedido con los códigos que usó. Un pedido con varios códigos cuenta en cada uno, por lo que la suma por código supera el total.">
        <KpiBoard>
          <KpiGroup title="Uso de códigos" w={12}>
            <Kpi m="pct_codigo" tone="dark" value={pct(k.pedidos ? con.pedidos / k.pedidos : NaN)} detail={`${num(con.pedidos)} de ${num(k.pedidos)} pedidos usan al menos un código.`} delta={Pant && c.kp && conA ? dv(k.pedidos ? con.pedidos / k.pedidos : NaN, c.kp.pedidos ? conA.pedidos / c.kp.pedidos : NaN) : null} />
            <Kpi m="ventas_codigo" value={eur(con.ventas)} delta={dv(con.ventas, conA?.ventas)} />
            <Kpi m="ticket_codigo" value={eur(con.ticket, 2)} delta={dv(con.ticket, conA?.ticket)} />
            <Kpi m="ticket_sin_codigo" value={eur(sin.ticket, 2)} delta={dv(sin.ticket, sinA?.ticket)} />
            <Kpi m="dos_codigos" tone="accent" value={num(dobles)} delta={dv(dobles, doblesA)} />
          </KpiGroup>
        </KpiBoard>
        <div style={{ marginTop: 12 }}>
          <Card title="Ingreso por código: por qué no está bien medido" info={<p className="i-def">Venta neta de los pedidos que usan cada código. Es la métrica que pide la nota de dirección, con dos problemas: cuenta dos veces los pedidos con dos códigos y suma ventas a precio lleno, porque ningún pedido refleja el descuento del código.</p>}>
            <p className="i-def">Cruzando pedidos con códigos, la suma por código es <b>{eur(cruce)}</b>; contando cada pedido una vez son <b>{eur(con.ventasNetas)}</b> (+{pct(con.ventasNetas ? cruce / con.ventasNetas - 1 : NaN)} por los {num(dobles)} pedidos con dos códigos). Además, los importes no reflejan ningún descuento: la tarifa cobrada es la misma con y sin código. No indica si el código generó la venta.</p>
          </Card>
        </div>
        <div className="grid g-2" style={{ marginTop: 12 }}>
          <Card title="Venta neta por código">
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={codigos} layout="vertical" margin={{ left: 10, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} tick={AX} tickFormatter={(v) => num(v / 1000, 0) + 'k'} />
                  <YAxis type="category" dataKey="codigo" tickLine={false} axisLine={false} fontSize={11} width={150} tick={AX} />
                  <Tooltip content={<Tip fmt={(v: number) => eur(v)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Bar dataKey="ventasNetas" name="Venta neta" radius={3}>{codigos.map((r) => <Cell key={r.codigo} fill={r.codigo === 'Sin código' ? '#c6c9c7' : '#5b9a7b'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Detalle por código">
            <Table rows={codigos} initialSort="ventas" cols={[
              { key: 'codigo', label: 'Código', left: true, render: (r) => <b>{r.codigo}</b>, sort: (r) => r.codigo },
              { key: 'pedidos', label: 'Pedidos', render: (r) => num(r.pedidos), sort: (r) => r.pedidos },
              { key: 'ventas', label: 'Ventas', render: (r) => eur(r.ventas), sort: (r) => r.ventas },
              { key: 'neta', label: 'Venta neta', render: (r) => eur(r.ventasNetas), sort: (r) => r.ventasNetas },
              { key: 'ticket', label: 'Ticket', render: (r) => eur(r.ticket, 2), sort: (r) => r.ticket },
              { key: 'devolucion', label: '% con devolución', render: (r) => pct(r.devolucion), sort: (r) => r.devolucion },
              { key: 'cancel', label: '% cancelados', render: (r) => pct(r.tasaCancel), sort: (r) => r.tasaCancel },
            ]} />
          </Card>
        </div>
      </Section>

      <Section title="Descuento sobre tarifa" sub="Diferencia entre el precio de catálogo y el precio al que se ha vendido cada línea.">
        <KpiBoard>
          <KpiGroup title="Descuento" w={12}>
            <Kpi m="descuento_medio" tone="dark" value={pct(dsc.pct)} delta={dv(dsc.pct, dscA?.pct)} />
            <Kpi m="valor_descuento" value={eur(dsc.valor)} delta={dv(dsc.valor, dscA?.valor)} />
            <Kpi m="pct_lineas_descuento" value={pct(dsc.pctLineas)} detail={`${num(dsc.lineasConDescuento)} de ${num(dsc.lineas)} líneas.`} delta={dv(dsc.pctLineas, dscA?.pctLineas)} />
          </KpiGroup>
        </KpiBoard>
        <div style={{ marginTop: 12 }}>
          <Card title="Productos vendidos por debajo de tarifa" note="Solo productos con descuento medio superior a cero en la selección.">
            <Table rows={prods} initialSort="descuento" limit={10} cols={[
              { key: 'producto', label: 'Producto', left: true, render: (r) => <b>{r.producto}</b>, sort: (r) => r.producto },
              { key: 'categoria', label: 'Categoría', left: true, render: (r) => r.categoria, sort: (r) => r.categoria },
              { key: 'tarifa', label: 'Tarifa', render: (r) => eur(r.tarifa_eur, 2), sort: (r) => r.tarifa_eur },
              { key: 'unidades', label: 'Uds', render: (r) => num(r.unidades), sort: (r) => r.unidades },
              { key: 'ventas', label: 'Ventas', render: (r) => eur(r.ventas), sort: (r) => r.ventas },
              { key: 'descuento', label: 'Dto. medio', render: (r) => pct(r.descuento), sort: (r) => r.descuento },
            ]} />
          </Card>
        </div>
      </Section>
    </>
  );
}
