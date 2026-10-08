with
-- C1 · Puente del subtotal de todos los pedidos de H1 a la venta neta (README, conclusión C1).
-- Devuelve: un paso por fila con su número de pedidos y su importe en euros, y aparte lo que no es venta.
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
-- >>> QUERY DE C1 (puente)
h as (select * from orders where created_at < date '2026-07-01'),
pasos as (
  select 1 as orden, 'Subtotal de todos los pedidos de H1' as paso,
         (select count(*) from h) as pedidos, (select round(sum(subtotal_cents) / 100.0) from h) as eur
  union all
  select 2, '- pedidos dados de baja (deleted_at)',
         -(select count(*) from h where deleted_at is not null),
         -(select round(sum(subtotal_cents) / 100.0) from h where deleted_at is not null)
  union all
  select 3, '- pedidos de prueba (una línea a menos del 50 % de su tarifa)',
         -(select count(*) from h where deleted_at is null and id in (select id from ex)),
         -(select round(sum(subtotal_cents) / 100.0) from h where deleted_at is null and id in (select id from ex))
  union all
  select 4, '- cancelados',
         -(select count(*) from p where en_h1 and not es_venta), -(select round(sum(subtotal)) from p where en_h1 and not es_venta)
  union all
  select 5, '= venta', (select count(*) from p where en_h1 and es_venta), (select round(sum(subtotal)) from p where en_h1 and es_venta)
  union all
  select 6, '- devoluciones (pedidos con alguna, que siguen contando como pedido)',
         (select count(*) from p where en_h1 and es_venta and devuelto > 0), -(select round(sum(devuelto)) from p where en_h1 and es_venta)
  union all
  select 7, '= venta neta', (select count(*) from p where en_h1 and es_venta), (select round(sum(neto)) from p where en_h1 and es_venta)
  union all
  select 8, 'aparte: IVA y envío de esos pedidos (no son venta)', null,
         (select round(sum(o.tax_cents + o.shipping_cents) / 100.0) from orders o join p on p.id = o.id where p.en_h1 and p.es_venta)
  union all
  select 9, 'aparte: líneas de productos inexistentes (no suman en el subtotal)',
         (select count(*) from order_items i join h on h.id = i.order_id left join products pr on pr.id = i.product_id where pr.id is null),
         (select round(sum(i.quantity * i.unit_price_cents) / 100.0) from order_items i join h on h.id = i.order_id
                 left join products pr on pr.id = i.product_id where pr.id is null)
)
select * from pasos order by orden
