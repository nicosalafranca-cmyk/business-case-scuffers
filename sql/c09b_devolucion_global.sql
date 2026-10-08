with
-- C9 · Tasa de devolución de H1, por pedido y por unidad, y motivos (README, conclusiones C1 y C9).
-- Devuelve: pedidos entregados o devueltos de H1, cuántos tienen devolución total y parcial, % de pedidos con
-- devolución, % si solo contara el estado refunded (nota de dirección 8), unidades, % de unidades devueltas, y
-- pedidos con un motivo de talla.
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
-- >>> QUERY DE C9 (tasa global)
b as (select * from p where en_h1 and status in ('delivered', 'refunded')),
lv as (select l.*, b.status from l join b on b.id = l.order_id),
ud as (
  select case when status = 'refunded' then quantity
              else coalesce((select max(k) from refunds r, generate_series(1, lv.quantity) k
                             where r.order_id = lv.order_id and k * lv.unit_price_cents = r.amount_cents), 0) end as devueltas,
         quantity
  from lv
)
select (select count(*) from b) as pedidos_base,
       (select count(*) from b where status = 'refunded') as devoluciones_totales,
       (select count(*) from b where status = 'delivered' and devuelto > 0) as devoluciones_parciales,
       (select round(100.0 * count(*) filter (where devuelto > 0) / count(*), 1) from b) as pct_pedidos_con_devolucion,
       (select round(100.0 * count(*) filter (where status = 'refunded') / count(*), 1) from b) as pct_solo_refunded,
       (select sum(quantity) from ud) as unidades_base, (select sum(devueltas) from ud) as unidades_devueltas,
       (select round(100.0 * sum(devueltas) / sum(quantity), 1) from ud) as pct_unidades_devueltas,
       (select count(*) from b join refunds r on r.order_id = b.id
        where r.reason in ('Talla incorrecta', 'Cambio de talla no disponible')) as pedidos_devueltos_por_talla
