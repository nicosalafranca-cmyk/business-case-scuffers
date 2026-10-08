// customer_id = persona (cuentas con el mismo usuario de email unificadas) · cuenta_id = cuenta original del pedido
export type Pedido = {
  id: number; customer_id: number; cuenta_id: number; canal: string; pais: 'ES' | 'DE'; pais_cliente: string; descuento_pct: number; estado: 'delivered' | 'pending' | 'cancelled' | 'refunded';
  fecha: string; subtotal_eur: number; envio_eur: number; iva_eur: number; total_eur: number;
  motivo_exclusion: string | null; excluido: boolean; codigos: string | null;
  reembolso_eur: number | null; fecha_reembolso: string | null; motivo_reembolso: string | null; nuevo_cliente: boolean;
  unidades: number; unidades_devueltas: number | null; tipo_devolucion: 'total' | 'parcial' | null;
};
export type Linea = {
  id: number; pedido_id: number; producto_id: number; producto: string; categoria: string; activo: boolean;
  cantidad: number; precio_eur: number; importe_eur: number; tarifa_eur: number | null;
};
export type Gasto = { canal: string; fecha: string; gasto_eur: number };
export type Producto = { id: number; producto: string; categoria: string; tarifa_eur: number; alta: string; activo: boolean; resenas: number; valoracion: number | null };
export type Resena = { producto_id: number; rating: number; fecha: string };
export type Cliente = { id: number; pais: string; alta: string };
export type Data = { pedidos: Pedido[]; lineas: Linea[]; gasto: Gasto[]; productos: Producto[]; resenas: Resena[]; clientes: Cliente[]; generado: string };
export type Estado = Pedido['estado'];
// Cada dimensión es una lista de valores seleccionados. Seleccionar todo = lista completa.
export type Filtros = {
  desde: string; hasta: string; // días, ISO
  paises: string[]; canales: string[]; estados: Estado[]; categorias: string[]; codigos: string[];
};
