'use client';
import { useState } from 'react';
import { GRUPOS, M } from '@/lib/metrics';
import { Card, Section } from '../ui';

const CONVENCIONES: [string, string][] = [
  ['Ventas', 'Siempre es el subtotal de producto: sin impuestos ni envío. La facturación total y los impuestos se muestran por separado.'],
  ['Estados de pedido', 'Entregado, pendiente, devuelto (pedido entero) y cancelado. Los cancelados no son venta: solo cuentan en las tasas de cancelación. El filtro de estado se aplica a todo el panel.'],
  ['Pedidos válidos', 'Los pedidos marcados como no válidos en la capa de datos (por ejemplo, borrados o con datos incoherentes) no entran en ninguna cifra.'],
  ['Periodo anterior', 'Periodo de igual duración inmediatamente anterior al seleccionado. La variación solo aparece si hay datos para ese periodo.'],
  ['Moneda y unidades', 'Importes en euros. Las unidades son productos individuales, no pedidos.'],
  ['Filtros', 'Fechas, país, canal, estado, categoría y código promocional se combinan entre sí. Con un filtro de categoría parcial, las ventas pasan a ser solo las de esas categorías; las devoluciones y la inversión no se reparten por categoría.'],
  ['Comparaciones entre canales', 'Los canales de pago son los que tienen inversión registrada. El retorno por euro solo existe para ellos.'],
];

export default function Metricas() {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const lista = Object.entries(M).filter(([, m]) => !t || `${m.nombre} ${m.def} ${m.formula} ${m.fuente}`.toLowerCase().includes(t));

  return (
    <>
      <Section title="Convenciones">
        <Card>
          <div className="conv">
            {CONVENCIONES.map(([a, b]) => <div key={a}><b>{a}</b><span>{b}</span></div>)}
          </div>
        </Card>
      </Section>

      <Section title="Glosario de métricas" sub={`${lista.length} de ${Object.keys(M).length} indicadores. Cada fila indica qué mide, cómo se calcula, de qué datos sale y dónde verla.`}
        action={<input className="search" placeholder="Buscar métrica…" value={q} onChange={(e) => setQ(e.target.value)} />}>
        {GRUPOS.map((g) => {
          const rows = lista.filter(([, m]) => m.grupo === g);
          if (!rows.length) return null;
          return (
            <div key={g} style={{ marginBottom: 12 }}>
              <Card title={g}>
                <div className="tbl-wrap">
                  <table className="gl">
                    <thead><tr><th className="l">Métrica</th><th className="l">Qué mide</th><th className="l">Cómo se calcula</th><th className="l">Origen</th><th className="l">Dónde verla</th></tr></thead>
                    <tbody>
                      {rows.map(([id, m]) => (
                        <tr key={id}>
                          <td className="l"><b>{m.nombre}</b></td>
                          <td className="l wrap">{m.def}</td>
                          <td className="l wrap"><code>{m.formula}</code></td>
                          <td className="l wrap">{m.fuente}</td>
                          <td className="l wrap">{m.donde}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          );
        })}
      </Section>
    </>
  );
}
