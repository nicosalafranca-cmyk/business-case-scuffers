'use client';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { clientesPorMes, clientesStats, distribucionPedidosPorCliente, porDimension, recompra, variacion } from '@/lib/calc';
import { fmtES } from '@/lib/dates';
import { eur, mesLabel, num, pct } from '@/lib/format';
import type { Ctx } from '../ctx';
import { Card, Kpi, Section, Table, Tip, AX, GRID, KpiBoard, KpiGroup } from '../ui';

const nombre = (p: string) => (p === 'ES' ? 'España' : p === 'DE' ? 'Alemania' : p);

export default function Clientes({ c }: { c: Ctx }) {
  const { d, f, P, Pant, k, kp, meses } = c;
  const cl = clientesStats(d, f, P);
  const r = recompra(P);
  const ra = Pant ? recompra(Pant) : null;
  const altas = cl.porMes(meses).map((x) => ({ ...x, label: mesLabel(x.mes) }));
  const cm = clientesPorMes(P, meses).map((x) => ({ ...x, label: mesLabel(x.mes) }));
  const dist = distribucionPedidosPorCliente(P);
  const pais = porDimension(P, (p) => p.pais_cliente);
  const netaTot = pais.reduce((s, x) => s + x.ventasNetas, 0);
  const dv = (a: number, b?: number) => (ra && b != null ? variacion(a, b) : null);

  return (
    <>
      <Section title="Base de clientes" sub={`Registrados hasta el ${fmtES(f.hasta)} según el país declarado en el registro.`}>
        <KpiBoard>
          <KpiGroup title="Registrados" w={12}>
            <Kpi m="registrados" tone="dark" value={num(cl.registrados)} />
            <Kpi m="altas" value={num(cl.altas)} />
            <Kpi m="conversion" tone="accent" value={pct(cl.conversion)} detail={`${num(cl.compradoresHist)} de ${num(cl.registrados)} registrados han comprado; ${num(cl.sinCompra)} no.`} />
            <Kpi m="tiempo_primera" value={`${num(cl.diasMediana)} días`} detail={`Media: ${num(cl.diasMedios, 1)} días. ${pct(cl.hastaSemana, 0)} compra en la primera semana.`} />
          </KpiGroup>
        </KpiBoard>
        <div className="grid g-2" style={{ marginTop: 12 }}>
          <Card title="Altas por mes y cuántas han comprado" info={<p className="i-def">Cada barra es el mes de alta de los clientes. La parte oscura son los que han comprado alguna vez; la clara, los que no. Los registrados más recientes han tenido menos tiempo para comprar.</p>}>
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={altas}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={AX} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tick={AX} allowDecimals={false} />
                  <Tooltip content={<Tip fmt={(v: number) => num(v)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="compradores" name="Han comprado" stackId="a" fill="#1a1c1b" />
                  <Bar dataKey="sinCompra" name="Sin compra" stackId="a" fill="#d5d8d6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Tiempo hasta la primera compra" info={<p className="i-def">Días entre el alta y el primer pedido válido, entre los registrados que han comprado.</p>}>
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={cl.dist}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="tramo" tickLine={false} axisLine={false} fontSize={11} tick={AX} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tick={AX} allowDecimals={false} />
                  <Tooltip content={<Tip fmt={(v: number) => num(v) + ' clientes'} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Bar dataKey="clientes" name="Clientes" fill="#2c302e" radius={3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <div style={{ marginTop: 12 }}>
          <Card title="Registrados y compradores por país" note="País declarado en el registro.">
            <Table rows={cl.porPais} initialSort="registrados" cols={[
              { key: 'pais', label: 'País', left: true, render: (x) => <b>{nombre(x.pais)}</b> },
              { key: 'registrados', label: 'Registrados', render: (x) => num(x.registrados), sort: (x) => x.registrados },
              { key: 'compradores', label: 'Han comprado', render: (x) => num(x.compradores), sort: (x) => x.compradores },
              { key: 'conversion', label: 'Conversión', render: (x) => pct(x.conversion), sort: (x) => x.conversion },
            ]} />
          </Card>
        </div>
      </Section>

      <Section title="Compradores" sub="Dentro de la selección actual. Los pedidos cancelados no cuentan.">
        <KpiBoard>
          <KpiGroup title="Compradores" w={12}>
            <Kpi m="compradores" tone="dark" value={num(r.total)} delta={dv(r.total, ra?.total)} />
            <Kpi m="nuevos" value={num(k.nuevos)} delta={kp ? variacion(k.nuevos, kp.nuevos) : null} />
            <Kpi m="recurrentes" value={num(r.recurrentes)} delta={dv(r.recurrentes, ra?.recurrentes)} />
            <Kpi m="recompra" value={pct(r.tasa)} delta={dv(r.tasa, ra?.tasa)} />
          </KpiGroup>
          <KpiGroup title="Valor y frecuencia" w={12}>
            <Kpi m="pedidos_comprador" value={num(r.pedidosPorCliente, 2)} delta={dv(r.pedidosPorCliente, ra?.pedidosPorCliente)} />
            <Kpi m="gasto_comprador" value={eur(r.ventasPorComprador)} delta={dv(r.ventasPorComprador, ra?.ventasPorComprador)} />
            <Kpi m="concentracion_clientes" tone="accent" value={pct(r.concentracionTop10)} delta={dv(r.concentracionTop10, ra?.concentracionTop10)} invert />
          </KpiGroup>
        </KpiBoard>
        <div className="grid g-2" style={{ marginTop: 12 }}>
          <Card title="Pedidos por mes: nuevos y recurrentes" info={<p className="i-def">Pedidos no cancelados de cada mes, separados entre clientes nuevos (su primer pedido) y recurrentes.</p>}>
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={cm}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={AX} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tick={AX} />
                  <Tooltip content={<Tip fmt={(v: number) => num(v)} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="nuevos" name="Clientes nuevos" stackId="a" fill="#5b9a7b" />
                  <Bar dataKey="recurrentes" name="Recurrentes" stackId="a" fill="#1a1c1b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Pedidos por comprador" info={<p className="i-def">Número de compradores según cuántos pedidos no cancelados han hecho en la selección.</p>}>
            <div className="chart">
              <ResponsiveContainer>
                <BarChart data={dist}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="pedidos" tickLine={false} axisLine={false} fontSize={11} tick={AX} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tick={AX} />
                  <Tooltip content={<Tip fmt={(v: number) => num(v) + ' compradores'} />} cursor={{ fill: 'rgba(11,12,12,.05)' }} />
                  <Bar dataKey="clientes" name="Compradores" fill="#2c302e" radius={3} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <div style={{ marginTop: 12 }}>
          <Card title="Compradores por país de registro" note="Cada cliente cuenta en su país de registro, aunque algún pedido se envíe al otro país. Las vistas de ventas por país usan el país de envío del pedido.">
            <Table rows={pais} initialSort="ventas" cols={[
              { key: 'k', label: 'País', left: true, render: (x) => <b>{nombre(x.k)}</b> },
              { key: 'compradores', label: 'Compradores', render: (x) => num(x.compradores), sort: (x) => x.compradores },
              { key: 'nuevos', label: 'Nuevos', render: (x) => num(x.nuevos), sort: (x) => x.nuevos },
              { key: 'pedidos', label: 'Pedidos', render: (x) => num(x.pedidos), sort: (x) => x.pedidos },
              { key: 'ventas', label: 'Ventas', render: (x) => eur(x.ventas), sort: (x) => x.ventas },
              { key: 'neta', label: 'Venta neta', render: (x) => eur(x.ventasNetas), sort: (x) => x.ventasNetas },
              { key: 'pneta', label: '% venta neta', render: (x) => pct(netaTot ? x.ventasNetas / netaTot : NaN), sort: (x) => x.ventasNetas },
              { key: 'npc', label: 'Neta/comprador', render: (x) => eur(x.ventasNetas / x.compradores), sort: (x) => x.ventasNetas / x.compradores },
              { key: 'ticket', label: 'Ticket', render: (x) => eur(x.ticket, 2), sort: (x) => x.ticket },
              { key: 'ppc', label: 'Pedidos/comprador', render: (x) => num(x.pedidos / x.compradores, 2), sort: (x) => x.pedidos / x.compradores },
            ]} />
          </Card>
        </div>
      </Section>
    </>
  );
}
