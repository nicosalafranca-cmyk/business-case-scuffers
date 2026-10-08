with
-- C4 · Venta neta a 90 días del cliente nuevo y días hasta el segundo pedido (README, conclusión C4).
-- Devuelve: clientes y venta neta media a 90 días de los captados en enero y del 1-feb al 13-abr (los últimos con
-- 90 días observables), y la mediana de días entre el primer y el segundo pedido de los que repiten.
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
-- >>> QUERY DE C4 (valor a 90 días y segundo pedido)
v as (
  select n.persona, n.created_at,
         (select sum(p2.neto) from p p2 where p2.persona = n.persona and p2.es_venta
          and p2.created_at <= n.created_at + 90) as neto90,
         (select min(p2.created_at) from p p2 where p2.persona = n.persona and p2.es_venta
          and p2.id <> n.id) - n.created_at as dias_2o
  from nuevo n
)
select 'captados en enero' as grupo, count(*) as clientes, round(avg(neto90)) as venta_neta_90d,
       null::numeric as mediana_dias_2o_pedido, null::numeric as pct_2o_pedido_en_7_dias
from v where created_at < date '2026-02-01'
union all
select 'captados del 1-feb al 13-abr', count(*), round(avg(neto90)), null, null
from v where created_at between date '2026-02-01' and date '2026-04-13'
union all
select 'clientes que repiten (todo el periodo)', count(*), null,
       percentile_cont(0.5) within group (order by dias_2o)::numeric,
       round(100.0 * count(*) filter (where dias_2o <= 7) / count(*), 1)
from v where dias_2o is not null
