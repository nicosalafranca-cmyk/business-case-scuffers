'use client';

// Portada del panel: solo de entrada, sin datos. Usa el mismo lenguaje visual que el panel.
const SECCIONES = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'producto', label: 'Producto' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'operaciones', label: 'Operaciones' },
  { id: 'promociones', label: 'Promociones' },
  { id: 'glosario', label: 'Glosario' },
];

export default function Portada({ onEnter }: { onEnter: (tab: string) => void }) {
  return (
    <div className="portada">
      <main className="pt-main">
        <h1 className="pt-title">
          <img src="/wordmark.svg" alt="Scuffers" className="pt-logo" />
          <span className="pt-stage">
            <img src="/swoosh.svg" alt="" className="pt-swoosh" aria-hidden="true" />
            <span className="pt-big">Business overview</span>
          </span>
        </h1>
        <div className="pt-actions">
          <button className="pt-cta" onClick={() => onEnter('resumen')}>
            Entrar al panel <span aria-hidden="true">→</span>
          </button>
          <nav className="pt-links" aria-label="Ir a una sección">
            {SECCIONES.map((s) => <button key={s.id} onClick={() => onEnter(s.id)}>{s.label}</button>)}
          </nav>
        </div>
      </main>

      <footer className="pt-foot">
        <span>Scuffers · Business overview</span>
        <span>La definición de cada indicador está en el Glosario</span>
      </footer>
    </div>
  );
}
