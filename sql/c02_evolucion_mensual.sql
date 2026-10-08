with
-- C2 · Evolución mensual de la venta neta y de la captación (README, conclusión C2).
-- Devuelve: por mes, pedidos, venta neta, compradores, % de la venta neta que viene de clientes captados en meses
-- anteriores y clientes nuevos por origen (Orgánico, canales con inversión, Newsletter y Directo).
-- Añade una fila con la media de febrero a mayo.
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
-- >>> QUERY DE C2
m as (
  select to_char(created_at, 'YYYY-MM') as mes, count(*) as pedidos, sum(neto) as venta_neta,
         count(distinct persona) as compradores,
         round(100.0 * sum(neto) filter (where persona not in (select n.persona from nuevo n
               where to_char(n.created_at, 'YYYY-MM') = to_char(p.created_at, 'YYYY-MM'))) / sum(neto), 1) as pct_venta_clientes_previos
  from p where es_venta group by 1
),
n as (
  select to_char(created_at, 'YYYY-MM') as mes, count(*) as nuevos,
         count(*) filter (where canal = 'Organic') as nuevos_organico,
         count(*) filter (where canal in (select distinct channel from marketing_spend)) as nuevos_canales_pago,
         count(*) filter (where canal in ('Newsletter', 'Direct')) as nuevos_newsletter_directo
  from nuevo group by 1
),
t as (select m.*, n.nuevos, n.nuevos_organico, n.nuevos_canales_pago, n.nuevos_newsletter_directo from m join n using (mes))
select mes, pedidos, round(venta_neta) as venta_neta, compradores, pct_venta_clientes_previos,
       nuevos, nuevos_organico, nuevos_canales_pago, nuevos_newsletter_directo
from t
union all
select 'media feb-may', null, round(avg(venta_neta)), null, null, round(avg(nuevos), 2), round(avg(nuevos_organico), 2),
       round(avg(nuevos_canales_pago), 2), round(avg(nuevos_newsletter_directo), 2)
from t where mes between '2026-02' and '2026-05'
order by mes
