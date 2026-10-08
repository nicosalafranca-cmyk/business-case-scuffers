'use client';
import { Children, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import Info from './Info';
import { M } from '@/lib/metrics';
import { num } from '@/lib/format';

export const GRID = 'rgba(11,12,12,.07)';
export const AX = { fill: '#7a847e' };

export function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string; off?: boolean }[] }) {
  return (
    <div className="seg">
      {options.map((o) => <button key={o.v} className={value === o.v ? 'on' : ''} disabled={o.off} style={o.off ? { opacity: .35, cursor: 'not-allowed' } : undefined} onClick={() => onChange(o.v)}>{o.l}</button>)}
    </div>
  );
}

export function Section({ title, sub, children, action }: { title: string; sub?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="section">
      <div className="sec-head">
        <div><h2>{title}</h2>{sub && <p className="sub">{sub}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

// Contenido del pop-up de información: definición y fórmula salen del glosario (lib/metrics.ts).
function Definicion({ id, detail }: { id?: string; detail?: ReactNode }) {
  const m = id ? M[id] : undefined;
  return (
    <>
      {m && <p className="i-def">{m.def}</p>}
      {m && <p className="i-form"><span>Fórmula</span>{m.formula}</p>}
      {detail && <p className="i-det">{detail}</p>}
    </>
  );
}

export function Delta({ value, invert }: { value?: number | null; invert?: boolean }) {
  if (value == null || !isFinite(value)) return null;
  const up = value > 0, flat = Math.abs(value) < 0.0005;
  const good = flat ? null : invert ? !up : up;
  return (
    <span className={`delta ${good == null ? '' : good ? 'good' : 'bad'}`}>
      {flat ? '=' : up ? '▲' : '▼'} {num(Math.abs(value) * 100, 1)} % <i>vs anterior</i>
    </span>
  );
}

// Indicador. `m` enlaza con el glosario: etiqueta, definición y fórmula salen de ahí.
export function Kpi({ m, value, detail, delta, invert, tone, split, label, wide }: {
  m?: string; value: string; detail?: ReactNode; delta?: number | null; invert?: boolean; tone?: 'dark' | 'accent'; split?: ReactNode; label?: string; wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const name = label ?? (m ? M[m]?.nombre : '');
  return (
    <div className={`card kpi ${tone ?? ''} ${wide ? 'wide' : ''} ${open ? 'pop-open' : ''}`}>
      <div className="kpi-head">
        <div className="lab">{name}</div>
        <Info onOpen={setOpen} title={name}><Definicion id={m} detail={detail} /></Info>
      </div>
      <div className="val">{value}</div>
      <div className="kpi-foot">
        <Delta value={delta} invert={invert} />
        {split && <div className="split">{split}</div>}
      </div>
    </div>
  );
}

// Tablero de indicadores: varios grupos con título; cada grupo reúne indicadores que se leen juntos.
export function KpiBoard({ children }: { children: ReactNode }) {
  return <div className="kboard">{children}</div>;
}
export function KpiGroup({ title, w = 6, hero, cols, children }: { title: string; w?: 3 | 4 | 5 | 6 | 7 | 8 | 12; hero?: boolean; cols?: number; children: ReactNode }) {
  const n = Children.count(children);
  // Forma regular: con «hero», el primer indicador ocupa varias filas y el resto se apila a su lado.
  const c = cols ?? (w >= 12 ? Math.min(n, 5) : n <= 3 ? n : n === 4 ? 2 : 3);
  const style = { '--cols': c, '--rs': Math.max(1, n - 1) } as CSSProperties;
  return (
    <div className={`kgroup w${w}`}>
      <div className="kg-title">{title}</div>
      <div className={`kg-grid ${hero ? 'feat' : ''}`} style={style}>{children}</div>
    </div>
  );
}

export function Card({ title, note, children, tone, info }: { title?: string; note?: ReactNode; children: ReactNode; tone?: 'dark' | 'accent'; info?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`card ${tone ?? ''} ${open ? 'pop-open' : ''}`}>
      {(title || info) && (
        <div className="card-title">
          {title && <h3>{title}</h3>}
          {info && <Info onOpen={setOpen} title={title ?? 'Información'}>{info}</Info>}
        </div>
      )}
      {note && <p className="note">{note}</p>}
      {children}
    </div>
  );
}

export function Callout({ kind = 'ok', title, children }: { kind?: 'ok' | 'warn'; title: string; children: ReactNode }) {
  return (
    <div className={`callout ${kind}`}>
      <b>{title}</b>
      <div>{children}</div>
    </div>
  );
}

// Lista de barras horizontales compacta: etiqueta, barra proporcional y valor.
export function BarList({ items, color = '#1a1c1b' }: { items: { label: string; value: string; share: number; sub?: string }[]; color?: string }) {
  const max = Math.max(0.0001, ...items.map((i) => (isFinite(i.share) ? i.share : 0)));
  if (!items.length) return <div className="empty">Sin datos para esta selección</div>;
  return (
    <div className="barlist">
      {items.map((i) => (
        <div className="bl-row" key={i.label}>
          <div className="bl-top"><span className="bl-l">{i.label}</span><span className="bl-v">{i.value}{i.sub && <i>{i.sub}</i>}</span></div>
          <div className="bl-bar"><span style={{ width: `${(Math.max(0, i.share) / max) * 100}%`, background: color }} /></div>
        </div>
      ))}
    </div>
  );
}

export type Col<T> = { key: string; label: string; render: (r: T) => ReactNode; sort?: (r: T) => number | string; left?: boolean };

export function Table<T>({ cols, rows, initialSort, limit }: { cols: Col<T>[]; rows: T[]; initialSort?: string; limit?: number }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(initialSort ? { key: initialSort, dir: -1 } : null);
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const c = cols.find((c) => c.key === sort.key);
    if (!c?.sort) return rows;
    return [...rows].sort((a, b) => {
      const va = c.sort!(a), vb = c.sort!(b);
      const na = typeof va === 'number' && !isFinite(va), nb = typeof vb === 'number' && !isFinite(vb);
      if (na || nb) return na === nb ? 0 : na ? 1 : -1; // NaN siempre al final
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [rows, sort, cols]);
  const shown = limit && !all ? sorted.slice(0, limit) : sorted;
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={c.left ? 'l' : ''} onClick={() => c.sort && setSort((s) => ({ key: c.key, dir: s?.key === c.key ? ((-s.dir) as 1 | -1) : -1 }))}>
                {c.label}{sort?.key === c.key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c.key} className={c.left ? 'l' : ''}>{c.render(r)}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {limit && rows.length > limit && (
        <button className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setAll(!all)}>{all ? 'Ver menos' : `Ver las ${rows.length} filas`}</button>
      )}
    </div>
  );
}

export function Tip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      <b>{label}</b>
      {payload.filter((p: any) => p.value != null && p.name !== '_').map((p: any) => (
        <div className="r" key={p.dataKey + p.name}>
          <span><span style={{ color: p.color || p.fill }}>●</span> {p.name}</span>
          <span>{fmt ? fmt(p.value, p) : p.value}</span>
        </div>
      ))}
    </div>
  );
}
