'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Data, Filtros } from '@/lib/types';
import { kpis, nDias, periodoAnterior, rangoDatos, selPedidos } from '@/lib/calc';
import { fmtES, mesesEnRango } from '@/lib/dates';
import type { Ctx } from './ctx';
import FilterBar, { defaultFiltros } from './FilterBar';
import Resumen from './tabs/Resumen';
import Ventas from './tabs/Ventas';
import Marketing from './tabs/Marketing';
import Producto from './tabs/Producto';
import Clientes from './tabs/Clientes';
import Operaciones from './tabs/Operaciones';
import Promociones from './tabs/Promociones';
import Metricas from './tabs/Metricas';
import Portada from './Portada';

const TABS: { id: string; label: string; sub: string }[] = [
  { id: 'resumen', label: 'Resumen', sub: 'Estado general del negocio en el periodo seleccionado y su variación frente al periodo anterior.' },
  { id: 'ventas', label: 'Ventas', sub: 'Ingresos, pedidos y ticket: evolución, comparativa con el periodo anterior y desglose por cualquier dimensión.' },
  { id: 'marketing', label: 'Marketing', sub: 'Qué cuesta captar un cliente en cada canal, cuánto vende ese cliente después y cómo leer la venta atribuida a cada canal.' },
  { id: 'producto', label: 'Producto', sub: 'Rendimiento del catálogo: ventas, precio, descuento y valoración.' },
  { id: 'clientes', label: 'Clientes', sub: 'Registrados, compradores, nuevos y recurrentes.' },
  { id: 'operaciones', label: 'Operaciones', sub: 'Estados de pedido, cancelaciones, envíos y devoluciones.' },
  { id: 'promociones', label: 'Promociones', sub: 'Uso y rendimiento de los códigos promocionales y del descuento sobre tarifa.' },
  { id: 'glosario', label: 'Glosario', sub: 'Definición, fórmula y origen de cada indicador del panel.' },
];

export default function Dashboard() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState('resumen');
  const [f, setF] = useState<Filtros | null>(null);
  // Portada: se muestra al entrar sin pestaña en la URL. Con un enlace directo (#marketing…) se entra al panel.
  const [intro, setIntro] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/data', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setD(j);
        setF(defaultFiltros(j));
      })
      .catch((e) => setErr(String(e.message || e)));
    const h = window.location.hash.replace('#', '');
    if (TABS.some((t) => t.id === h)) setTab(h);
    setIntro(!TABS.some((t) => t.id === h));
  }, []);

  const c: Ctx | null = useMemo(() => {
    if (!d || !f) return null;
    const P = selPedidos(d, f);
    const ant = periodoAnterior(d, f);
    const Pant = ant ? selPedidos(d, { ...f, ...ant }) : null;
    return { d, f, P, k: kpis(P), ant, Pant, kp: Pant ? kpis(Pant) : null, dias: nDias(f.desde, f.hasta), meses: mesesEnRango(f.desde, f.hasta) };
  }, [d, f]);

  const goTab = (id: string) => { setTab(id); history.replaceState(null, '', '#' + id); window.scrollTo({ top: 0 }); };
  const verPortada = () => { history.replaceState(null, '', window.location.pathname); setIntro(true); window.scrollTo({ top: 0 }); };

  if (intro === null) return null;
  if (intro) return <Portada onEnter={(id) => { setIntro(false); goTab(id); }} />;
  if (err) return <div className="loading">No se han podido cargar los datos.<p className="sub">{err}</p></div>;
  if (!d || !f || !c) return <div className="loading">Cargando datos…</div>;

  const r = rangoDatos(d);
  const def = TABS.find((t) => t.id === tab)!;
  const parcial = f.hasta === r.max && r.max.slice(8) < '28';

  return (
    <>
      <header>
        <div className="topbar">
          <button className="logo-btn" onClick={verPortada} aria-label="Volver a la portada" title="Volver a la portada">
            <img src="/logo.svg" alt="Scuffers" className="logo" />
          </button>
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={`tab ${t.id === tab ? 'on' : ''}`} onClick={() => goTab(t.id)}>{t.label}</button>
            ))}
          </nav>
          <div className="meta"><span className="dot" /> Datos del {fmtES(r.min)} al {fmtES(r.max)}</div>
        </div>
        <div className="hero">
          <h1>{def.label}</h1>
          <p>{def.sub}</p>
        </div>
      </header>

      {tab !== 'glosario' && <FilterBar d={d} f={f} setF={setF} P={c.P} />}

      <main>
        {tab === 'resumen' && <Resumen c={c} />}
        {tab === 'ventas' && <Ventas c={c} />}
        {tab === 'marketing' && <Marketing c={c} />}
        {tab === 'producto' && <Producto c={c} />}
        {tab === 'clientes' && <Clientes c={c} />}
        {tab === 'operaciones' && <Operaciones c={c} />}
        {tab === 'promociones' && <Promociones c={c} />}
        {tab === 'glosario' && <Metricas />}
      </main>

      <footer className="foot">
        Ventas = subtotal de producto, sin impuestos ni envío, de los pedidos no cancelados (entregados, pendientes y devueltos), con todas las fichas del catálogo, activas o no. Venta neta = ventas − devoluciones. Quedan fuera los pedidos dados de baja y los de prueba. Un cliente es una persona: las cuentas con el mismo usuario de email se unifican.
        {' '}Periodo por defecto: primer semestre (enero a junio). Julio llega parcial.
        {' '}Pulsa la «i» de cualquier indicador para ver su definición y fórmula. El glosario completo está en la pestaña Glosario.
        {parcial && <> El último periodo llega solo hasta el {fmtES(r.max)}.</>}
        {f.categorias.length < 4 && <> Con filtro de categoría, las ventas son solo las de esas categorías; devoluciones e inversión no se reparten por categoría.</>}
      </footer>
    </>
  );
}
