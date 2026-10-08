'use client';
import type { Data, Filtros, Pedido } from '@/lib/types';
import { CATEGORIAS, ESTADOS, PAISES, SIN_CODIGO, canalesDe, rangoDatos, venta } from '@/lib/calc';
import { ESTADO_COLOR, ESTADO_LABEL, eur, num } from '@/lib/format';
import DateRange from './filters/DateRange';
import MultiSelect from './filters/MultiSelect';
import { useMemo } from 'react';

export function defaultFiltros(d: Data): Filtros {
  const r = rangoDatos(d);
  // Periodo por defecto: primer semestre cerrado (1-ene a 30-jun). Julio llega parcial y se puede añadir con el filtro de fechas.
  return {
    desde: r.min, hasta: r.max > H1_FIN ? H1_FIN : r.max, paises: PAISES.map((p) => p.value), canales: canalesDe(d), estados: [...ESTADOS],
    categorias: [...CATEGORIAS], codigos: codigosOpciones(d),
  };
}
export const H1_FIN = '2026-06-30';
export const codigosOpciones = (d: Data) => [SIN_CODIGO, ...new Set(d.pedidos.flatMap((p) => (p.codigos ? p.codigos.split(' + ') : [])))].sort((a, b) => (a === SIN_CODIGO ? -1 : b === SIN_CODIGO ? 1 : a.localeCompare(b)));

export default function FilterBar({ d, f, setF, P }: { d: Data; f: Filtros; setF: (f: Filtros) => void; P: Pedido[] }) {
  const base = useMemo(() => defaultFiltros(d), [d]);
  const r = rangoDatos(d);
  const canales = useMemo(() => {
    const n = new Map<string, number>();
    d.pedidos.filter((p) => !p.excluido).forEach((p) => n.set(p.canal, (n.get(p.canal) ?? 0) + 1));
    return base.canales.map((c) => ({ value: c, label: c, hint: `${n.get(c) ?? 0}` }));
  }, [d, base.canales]);
  const cod = useMemo(() => {
    const n = new Map<string, number>();
    d.pedidos.filter((p) => !p.excluido).forEach((p) => (p.codigos ? p.codigos.split(' + ') : [SIN_CODIGO]).forEach((c) => n.set(c, (n.get(c) ?? 0) + 1)));
    return base.codigos.map((c) => ({ value: c, label: c, hint: `${n.get(c) ?? 0}` }));
  }, [d, base.codigos]);
  const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
  const isDefault = f.desde === base.desde && f.hasta === base.hasta && same(f.paises, base.paises) && same(f.canales, base.canales) && same(f.estados, base.estados) && same(f.categorias, base.categorias) && same(f.codigos, base.codigos);
  const ventas = P.reduce((s, p) => s + venta(p), 0);
  const pedidos = P.filter((p) => p.estado !== 'cancelled').length;

  return (
    <div className="filters-wrap">
      <div className="filters">
        <DateRange desde={f.desde} hasta={f.hasta} min={r.min} max={r.max} onChange={(a, b) => setF({ ...f, desde: a, hasta: b })} />
        <MultiSelect label="País" noun="países" options={PAISES} selected={f.paises} onChange={(v) => setF({ ...f, paises: v })} allText="Todos" />
        <MultiSelect label="Canal" noun="canales" options={canales} selected={f.canales} onChange={(v) => setF({ ...f, canales: v })} allText="Todos" />
        <MultiSelect label="Estado" noun="estados" options={ESTADOS.map((e) => ({ value: e, label: ESTADO_LABEL[e], color: ESTADO_COLOR[e] }))} selected={f.estados} onChange={(v) => setF({ ...f, estados: v as Filtros['estados'] })} allText="Todos" />
        <MultiSelect label="Categoría" noun="categorías" options={CATEGORIAS.map((c) => ({ value: c, label: c }))} selected={f.categorias} onChange={(v) => setF({ ...f, categorias: v })} allText="Todas" />
        <MultiSelect label="Código promo" noun="códigos" options={cod} selected={f.codigos} onChange={(v) => setF({ ...f, codigos: v })} allText="Todos" />
        <span className="f-spacer" />
        <span className="f-count"><b>{num(pedidos)}</b> pedidos · <b>{eur(ventas)}</b></span>
        {!isDefault && <button className="btn-ghost" onClick={() => setF(base)}>Limpiar filtros</button>}
      </div>
    </div>
  );
}
