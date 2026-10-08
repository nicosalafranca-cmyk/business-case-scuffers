with
-- C5 · Canales con inversión de marzo a junio: coste por cliente nuevo y lo que vale ese cliente (README, conclusión C5).
-- Devuelve: por canal, gasto, clientes nuevos (y cuántos alemanes), coste por cliente nuevo, venta neta esperada a
-- 90 días de esos clientes según su país, retorno de captación (venta neta esperada a 90 días por euro invertido),
-- y como referencia el IEC (venta neta atribuida por euro), el % de esa venta que es recompra, el ticket y el % de
-- pedidos enviados a Alemania.
-- >>> MODELO COMÚN · idéntico en todas las queries de sql/ (README, «4. Modelado de datos»)
-- cli   · persona: las cuentas con el mismo usuario de email (lo que va antes de la @, sin mayúsculas) son una persona
cli as (
  select id, country as pais_cliente,
         min(id) over (partition by lower(split_part(email, '@', 1))) as persona
  from customers
),
-- ex    · pedidos fuera: dados de baja (deleted_at) o de prueba (alguna línea cobrada a menos del 50 % de su tarifa)
ex as (
  select o.id from orders o
  where o.deleted_at is not null
     or exists (select 1 from order_items i join products pr on pr.id = i.product_id
                where i.order_id = o.id and i.unit_price_cents < 0.5 * pr.price_cents)
),
-- l     · líneas de productos que existen, activos o no (las de productos inexistentes no suman en el subtotal).
--         Zapatillas Trail Urbanas pasa de Accesorios a Deporte: son zapatillas de trail, no un accesorio
l as (
  select i.id, i.order_id, i.product_id, i.quantity, i.unit_price_cents, pr.name,
         case when pr.name = 'Zapatillas Trail Urbanas' then 'Deporte' else pr.category end as category,
         pr.active, pr.price_cents
  from order_items i join products pr on pr.id = i.product_id
  where i.order_id not in (select id from ex)
),
-- rf    · importe reembolsado por pedido: el subtotal entero si está refunded, una o varias unidades si es parcial
rf as (select order_id, sum(amount_cents) / 100.0 as eur from refunds group by 1),
-- p     · pedidos válidos: subtotal sin IVA ni envío, neto = subtotal - reembolsado, canal con Meta unificado
p as (
  select o.id, c.persona, c.pais_cliente, o.country as pais_envio, o.status, o.created_at,
         case when lower(btrim(o.channel)) = 'meta ads' then 'Meta Ads' else btrim(o.channel) end as canal,
         o.subtotal_cents / 100.0 as subtotal, coalesce(rf.eur, 0) as devuelto,
         o.subtotal_cents / 100.0 - coalesce(rf.eur, 0) as neto,
         o.status <> 'cancelled' as es_venta, o.created_at < date '2026-07-01' as en_h1
  from orders o join cli c on c.id = o.customer_id left join rf on rf.order_id = o.id
  where o.id not in (select id from ex)
),
-- nuevo · primer pedido válido y no cancelado de cada persona: su fecha es la captación y su canal, el de captación
nuevo as (
  select distinct on (persona) persona, id, canal, created_at, pais_cliente
  from p where es_venta order by persona, created_at, id
),
-- gasto · gasto diario en euros: Google Ads viene en céntimos y los duplicados exactos cuentan una vez
gasto as (
  select channel as canal, date as fecha,
         case when currency_unit = 'EUR_CENTS' then spend_raw / 100.0 else spend_raw end as eur
  from (select distinct channel, date, spend_raw, currency_unit from marketing_spend) d
),
-- >>> QUERY DE C5
v90 as (  -- venta neta a 90 días del cliente nuevo por país: captados del 1-feb al 13-abr (últimos con 90 días observables)
  select n.pais_cliente,
         avg((select sum(p2.neto) from p p2 where p2.persona = n.persona and p2.es_venta
              and p2.created_at <= n.created_at + 90)) as valor
  from nuevo n where n.created_at between date '2026-02-01' and date '2026-04-13' group by 1
),
g as (select canal, sum(eur) as gasto from gasto where fecha between date '2026-03-01' and date '2026-06-30' group by 1),
nv as (
  select n.canal, count(*) as nuevos, count(*) filter (where n.pais_cliente = 'DE') as nuevos_de, sum(v90.valor) as valor
  from nuevo n join v90 using (pais_cliente)
  where n.created_at between date '2026-03-01' and date '2026-06-30' group by 1
),
vt as (
  select canal, count(*) as pedidos, sum(neto) as neto, avg(subtotal) as ticket,
         sum(neto) filter (where id not in (select id from nuevo)) as neto_recompra,
         count(*) filter (where pais_envio = 'DE') as pedidos_de
  from p where es_venta and created_at between date '2026-03-01' and date '2026-06-30' group by 1
)
select g.canal, round(g.gasto) as gasto, nv.nuevos, nv.nuevos_de,
       round(g.gasto / nv.nuevos) as coste_cliente_nuevo,
       round(nv.valor / nv.nuevos) as venta_neta_90d_cliente_nuevo,
       round(nv.valor / g.gasto, 1) as retorno_captacion,
       round(vt.neto / g.gasto, 1) as iec,
       round(100.0 * vt.neto_recompra / vt.neto, 1) as pct_venta_recompra,
       round(vt.ticket, 2) as ticket,
       round(100.0 * vt.pedidos_de / vt.pedidos) as pct_pedidos_alemania
from g join nv using (canal) join vt using (canal)
order by coste_cliente_nuevo
