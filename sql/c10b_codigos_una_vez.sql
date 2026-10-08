with
-- C10 · Pedidos con código contando cada pedido una vez, y si el código rebaja algo (README, conclusión C10).
-- Devuelve: pedidos de H1 con código, cuántos llevan dos, su venta neta contando cada pedido una vez, el ticket con y
-- sin código, y el % por debajo de la tarifa al que se venden las líneas con y sin código.
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
-- >>> QUERY DE C10 (cada pedido una vez)
nc as (select order_id, count(*) as n from order_promotions group by 1),
x as (select p.*, coalesce(nc.n, 0) as codigos from p left join nc on nc.order_id = p.id where p.es_venta and p.en_h1),
lin as (
  select l.*, exists (select 1 from order_promotions op where op.order_id = l.order_id) as con_codigo
  from l join p on p.id = l.order_id where p.es_venta and p.en_h1
)
select (select count(*) from x where codigos > 0) as pedidos_con_codigo,
       (select count(*) from x where codigos > 1) as pedidos_con_dos_codigos,
       (select round(100.0 * count(*) filter (where codigos > 0) / count(*), 1) from x) as pct_pedidos_con_codigo,
       (select round(sum(neto)) from x where codigos > 0) as ingreso_cada_pedido_una_vez,
       (select round(avg(subtotal), 2) from x where codigos > 0) as ticket_con_codigo,
       (select round(avg(subtotal), 2) from x where codigos = 0) as ticket_sin_codigo,
       (select round(100 * (1 - sum(quantity * unit_price_cents)::numeric / sum(quantity * price_cents)), 1)
        from lin where con_codigo) as pct_bajo_tarifa_con_codigo,
       (select round(100 * (1 - sum(quantity * unit_price_cents)::numeric / sum(quantity * price_cents)), 1)
        from lin where not con_codigo) as pct_bajo_tarifa_sin_codigo
