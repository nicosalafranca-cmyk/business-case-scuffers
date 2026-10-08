import type { Data, Filtros, Pedido } from '@/lib/types';
import type { Kpis } from '@/lib/calc';

// Contexto común que reciben todas las pestañas: datos, filtros, pedidos seleccionados y, si existe, el periodo anterior.
export type Ctx = {
  d: Data; f: Filtros; P: Pedido[]; k: Kpis;
  ant: { desde: string; hasta: string } | null; Pant: Pedido[] | null; kp: Kpis | null;
  dias: number; meses: string[];
};
