with
-- C8 · Categorías en mayo y junio, el único tramo en que existen las cuatro: Deporte se da de alta el 1-may
-- (README, conclusión C8).
-- Devuelve: por categoría, referencias con venta (y cuántas son fichas inactivas), unidades, venta, peso, venta y
-- unidades por referencia, venta de mayo y de junio, y % de la venta que viene de fichas inactivas.
-- Venta = cantidad x precio cobrado de las líneas de pedidos no cancelados, antes de devoluciones.
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
-- >>> QUERY DE C8
lv as (
  select l.*, p.created_at as fecha from l join p on p.id = l.order_id
  where p.es_venta and p.created_at >= date '2026-05-01' and p.created_at < date '2026-07-01'
)
select category as categoria, count(distinct product_id) as referencias,
       count(distinct product_id) filter (where not active) as referencias_inactivas,
       sum(quantity) as unidades, round(sum(quantity * unit_price_cents) / 100.0) as venta,
       round(100.0 * sum(quantity * unit_price_cents) / sum(sum(quantity * unit_price_cents)) over (), 1) as pct_venta,
       round(sum(quantity * unit_price_cents) / 100.0 / count(distinct product_id)) as venta_por_referencia,
       round(sum(quantity)::numeric / count(distinct product_id), 1) as unidades_por_referencia,
       round(sum(quantity * unit_price_cents) filter (where fecha < date '2026-06-01') / 100.0) as venta_mayo,
       round(sum(quantity * unit_price_cents) filter (where fecha >= date '2026-06-01') / 100.0) as venta_junio,
       round(100.0 * coalesce(sum(quantity * unit_price_cents) filter (where not active), 0)
             / sum(quantity * unit_price_cents), 1) as pct_venta_fichas_inactivas
from lv group by 1 order by venta_por_referencia desc
