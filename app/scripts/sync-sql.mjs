// Copia las queries de ../sql/panel a lib/sql.generated.ts para que el servidor las ejecute tal cual.
// Así el panel y los ficheros .sql del repositorio son SIEMPRE la misma consulta.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const dir = new URL('../../sql/panel/', import.meta.url);
const out = new URL('../lib/sql.generated.ts', import.meta.url);
if (!existsSync(dir)) { console.log('sync-sql: no hay ../sql/panel, se usa lib/sql.generated.ts existente'); process.exit(0); }
const files = { pedidos: '01_pedidos.sql', lineas: '02_lineas.sql', gasto: '03_gasto.sql', productos: '04_productos.sql', resenas: '05_resenas.sql', clientes: '06_clientes.sql' };
let ts = '// GENERADO por scripts/sync-sql.mjs desde /sql/panel — no editar a mano.\nexport const SQL = {\n';
for (const [k, f] of Object.entries(files)) ts += `  ${k}: ${JSON.stringify(readFileSync(new URL(f, dir), 'utf8').trim().replace(/;\s*$/, ''))},\n`;
ts += '} as const;\n';
writeFileSync(out, ts);
console.log('sync-sql: ok');
