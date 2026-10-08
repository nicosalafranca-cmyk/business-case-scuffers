'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

// Botón circular de cristal con una «i». Al pulsarlo (o pasar el ratón) sale un pop-up con la explicación.
export default function Info({ children, title = 'Cómo se calcula', onOpen }: { children: ReactNode; title?: string; onOpen?: (open: boolean) => void }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const open = pinned || hover;

  useEffect(() => { onOpen?.(open); }, [open, onOpen]);
  useEffect(() => {
    if (!pinned) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setPinned(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinned(false); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [pinned]);

  return (
    <span className="info-wrap" ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button type="button" className="info-btn" aria-label={title} aria-expanded={open} onClick={() => setPinned(!pinned)}>i</button>
      {open && <span className="info-pop" role="tooltip"><b>{title}</b>{children}</span>}
    </span>
  );
}
