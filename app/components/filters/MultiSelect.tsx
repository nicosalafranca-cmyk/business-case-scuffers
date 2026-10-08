'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

export type Opt = { value: string; label: string; hint?: string; color?: string };

export function Check({ state }: { state: 'on' | 'off' | 'mid' }) {
  return (
    <span className={`chk ${state === 'on' ? 'on' : state === 'mid' ? 'mid' : ''}`}>
      {state === 'on' && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2 5 8.7 9.5 3.7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      {state === 'mid' && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 6h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>}
    </span>
  );
}

export function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open, close]);
  return ref;
}

export default function MultiSelect({ label, options, selected, onChange, allText = 'Todos', noun }: {
  label: string; options: Opt[]; selected: string[]; onChange: (v: string[]) => void; allText?: string; noun?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useOutside(open, () => setOpen(false));
  const all = selected.length === options.length;
  const none = selected.length === 0;
  const text = all ? allText : none ? 'Ninguno' : selected.length === 1 ? options.find((o) => o.value === selected[0])?.label ?? '1' : `${selected.length} ${noun ?? 'seleccionados'}`;
  const shown = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())), [options, q]);
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div className="f-item" ref={ref}>
      <span className="f-lab">{label}</span>
      <button className={`f-btn ${!all ? 'active' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{text}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="m2 3.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="pop ms">
          {options.length > 7 && <input className="ms-search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />}
          <div className="ms-row ms-all" onClick={() => onChange(all ? [] : options.map((o) => o.value))}>
            <Check state={all ? 'on' : none ? 'off' : 'mid'} /> Seleccionar todo
          </div>
          <div className="ms-list">
            {shown.map((o) => (
              <div className="ms-row" key={o.value} onClick={() => toggle(o.value)}>
                <Check state={selected.includes(o.value) ? 'on' : 'off'} />
                {o.color && <i style={{ width: 9, height: 9, borderRadius: '50%', background: o.color, display: 'inline-block' }} />}
                <span>{o.label}</span>
                {o.hint && <span className="ms-hint">{o.hint}</span>}
                <span className="only" onClick={(e) => { e.stopPropagation(); onChange([o.value]); }}>solo</span>
              </div>
            ))}
            {!shown.length && <div className="empty">Sin resultados</div>}
          </div>
        </div>
      )}
    </div>
  );
}
