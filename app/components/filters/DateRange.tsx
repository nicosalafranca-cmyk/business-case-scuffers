'use client';
import { useEffect, useMemo, useState } from 'react';
import { addDays, addMonths, clamp, fmtES, isoWeek, monthEnd, monthStart, parseES, parseISO, quarterEnd, quarterStart, weekStart } from '@/lib/dates';
import { useOutside } from './MultiSelect';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

type Preset = { label: string; range: [string, string] } | 'sep';

function Month({ first, start, end, hover, min, max, onPick, onHover, nav }: {
  first: string; start: string | null; end: string | null; hover: string | null; min: string; max: string;
  onPick: (d: string) => void; onHover: (d: string | null) => void; nav: { left?: boolean; right?: boolean; go: (n: number) => void };
}) {
  const d0 = parseISO(first);
  const lead = (d0.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  // rango de previsualización mientras se elige el segundo día
  const a = start, b = end ?? hover;
  const lo = a && b ? (a < b ? a : b) : a, hi = a && b ? (a < b ? b : a) : a;

  return (
    <div className="cal">
      <div className="cal-head">
        <span className="cal-nav">{nav.left && <><button onClick={() => nav.go(-12)} aria-label="Año anterior">«</button><button onClick={() => nav.go(-1)} aria-label="Mes anterior">‹</button></>}</span>
        <span>{MESES[d0.getUTCMonth()][0].toUpperCase() + MESES[d0.getUTCMonth()].slice(1)} {d0.getUTCFullYear()}</span>
        <span className="cal-nav" style={{ justifyContent: 'flex-end' }}>{nav.right && <><button onClick={() => nav.go(1)} aria-label="Mes siguiente">›</button><button onClick={() => nav.go(12)} aria-label="Año siguiente">»</button></>}</span>
      </div>
      <div className="cal-grid">
        <span className="dow">S</span>{DOW.map((x) => <span className="dow" key={x}>{x}</span>)}
        {rows.map((r, i) => {
          const firstDay = r.find(Boolean) as string | undefined;
          return [
            <span className="wk" key={'w' + i}>{firstDay ? isoWeek(firstDay) : ''}</span>,
            ...r.map((c, j) => {
              if (!c) return <span key={`${i}-${j}`} />;
              const off = c < min || c > max;
              const inr = lo && hi && c > lo && c < hi;
              const st = lo === c && hi !== lo, en = hi === c && hi !== lo, one = lo === c && hi === lo;
              return (
                <div key={c} className={`day ${off ? 'off' : ''} ${inr ? 'inr' : ''} ${st || one ? 'st' : ''} ${en || one ? 'en' : ''}`}
                  onClick={() => !off && onPick(c)} onMouseEnter={() => !off && onHover(c)}>
                  <span>{+c.slice(8)}</span>
                </div>
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}

export default function DateRange({ desde, hasta, min, max, onChange }: { desde: string; hasta: string; min: string; max: string; onChange: (d: string, h: string) => void }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<string | null>(desde);
  const [e, setE] = useState<string | null>(hasta);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState(monthStart(desde));
  const [ti, setTi] = useState({ a: fmtES(desde), b: fmtES(hasta) });
  const ref = useOutside(open, () => setOpen(false));

  // al abrir, parte del rango aplicado
  useEffect(() => { if (open) { setS(desde); setE(hasta); setView(monthStart(desde)); setHover(null); } }, [open, desde, hasta]);
  useEffect(() => { setTi({ a: s ? fmtES(s) : '', b: e ? fmtES(e) : '' }); }, [s, e]);

  const presets: Preset[] = useMemo(() => {
    const c = (a: string, b: string): [string, string] => [clamp(a, min, max), clamp(b, min, max)];
    const wk = weekStart(max), pm = addMonths(max, -1), pq = addMonths(quarterStart(max), -3);
    return [
      { label: 'Último día', range: c(max, max) },
      'sep',
      { label: 'Últimos 7 días', range: c(addDays(max, -6), max) },
      { label: 'Últimos 30 días', range: c(addDays(max, -29), max) },
      { label: 'Últimos 90 días', range: c(addDays(max, -89), max) },
      'sep',
      { label: 'Esta semana', range: c(wk, max) },
      { label: 'Semana pasada', range: c(addDays(wk, -7), addDays(wk, -1)) },
      'sep',
      { label: 'Este mes', range: c(monthStart(max), max) },
      { label: 'Mes pasado', range: c(monthStart(pm), monthEnd(pm)) },
      'sep',
      { label: 'Este trimestre', range: c(quarterStart(max), max) },
      { label: 'Trimestre pasado', range: c(pq, quarterEnd(pq)) },
      'sep',
      { label: 'Todo el periodo', range: [min, max] },
    ];
  }, [min, max]);

  const pick = (d: string) => {
    if (!s || e) { setS(d); setE(null); }
    else if (d < s) { setE(s); setS(d); }
    else setE(d);
  };
  const apply = () => { if (s) { const a = s, b = e ?? s; onChange(a < b ? a : b, a < b ? b : a); setOpen(false); } };
  const isAll = desde === min && hasta === max;
  const days = s && (e ?? s) ? Math.round((parseISO(e ?? s).getTime() - parseISO(s).getTime()) / 86400000) + 1 : 0;
  const parse = (t: string, which: 'a' | 'b') => {
    const iso = parseES(t);
    if (!iso || iso < min || iso > max) return;
    if (which === 'a') { setS(iso); setView(monthStart(iso)); if (e && iso > e) setE(null); } else { setE(iso); if (s && iso < s) setS(iso); }
  };
  const bad = (t: string) => t.length > 0 && (!parseES(t) || parseES(t)! < min || parseES(t)! > max);

  return (
    <div className="f-item" ref={ref}>
      <span className="f-lab">Fechas</span>
      <button className={`f-btn ${!isAll ? 'active' : ''}`} style={{ minWidth: 230 }} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{fmtES(desde)} – {fmtES(hasta)}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M2 6.5h12M5.5 1.8v2.4M10.5 1.8v2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      </button>
      {open && (
        <div className="pop dr">
          <div className="dr-presets">
            {presets.map((p, i) => p === 'sep' ? <hr key={i} /> : (
              <button key={p.label} className={s === p.range[0] && (e ?? s) === p.range[1] ? 'on' : ''} onClick={() => { setS(p.range[0]); setE(p.range[1]); setView(monthStart(p.range[0])); }}>{p.label}</button>
            ))}
          </div>
          <div className="dr-main">
            <div className="dr-inputs">
              <input className={bad(ti.a) ? 'bad' : ''} value={ti.a} placeholder="dd/mm/aaaa" onChange={(x) => { setTi({ ...ti, a: x.target.value }); parse(x.target.value, 'a'); }} />
              <span>—</span>
              <input className={bad(ti.b) ? 'bad' : ''} value={ti.b} placeholder="dd/mm/aaaa" onChange={(x) => { setTi({ ...ti, b: x.target.value }); parse(x.target.value, 'b'); }} />
            </div>
            <div className="dr-months" onMouseLeave={() => setHover(null)}>
              <Month first={view} start={s} end={e} hover={hover} min={min} max={max} onPick={pick} onHover={setHover} nav={{ left: true, go: (n) => setView(addMonths(view, n)) }} />
              <Month first={addMonths(view, 1)} start={s} end={e} hover={hover} min={min} max={max} onPick={pick} onHover={setHover} nav={{ right: true, go: (n) => setView(addMonths(view, n)) }} />
            </div>
            <div className="dr-foot">
              <span>{days ? `${days} ${days === 1 ? 'día' : 'días'}` : 'Elige el primer día'} · datos del {fmtES(min)} al {fmtES(max)}</span>
              <span className="btns">
                <button className="btn" onClick={() => setOpen(false)}>Cancelar</button>
                <button className="btn pri" onClick={apply} disabled={!s}>Aplicar</button>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
