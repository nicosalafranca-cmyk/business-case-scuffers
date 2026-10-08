import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Scuffers · Business Overview',
  description: 'Ventas, canales de adquisición y producto del primer semestre.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
