import { SQL } from '@/lib/sql.generated';

export const revalidate = 3600; // los datos se refrescan como máximo cada hora

const URL_ = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

async function run(q: string) {
  const r = await fetch(`${URL_}/rest/v1/rpc/run_sql`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, quien: 'dashboard' }),
    next: { revalidate: 3600 },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

export async function GET() {
  try {
    const [pedidos, lineas, gasto, productos, resenas, clientes] = await Promise.all([
      run(SQL.pedidos), run(SQL.lineas), run(SQL.gasto), run(SQL.productos), run(SQL.resenas), run(SQL.clientes),
    ]);
    return Response.json({ pedidos, lineas, gasto, productos, resenas, clientes, generado: new Date().toISOString() });
  } catch (e: any) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
