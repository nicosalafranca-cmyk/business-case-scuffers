with
-- C5 · Coste por cliente nuevo con otras agrupaciones y otro periodo (README, conclusión C5 y supuestos).
-- Devuelve: por escenario y canal, gasto, clientes nuevos y coste por cliente nuevo.
-- Escenarios: Meta + Instagram unidos y Email + Newsletter unidos (como el anexo), de marzo a junio, y todo H1.
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
-- >>> QUERY DE C5 (sensibilidad)
grupo as (
  select canal, case when canal in ('Meta Ads', 'Instagram Ads') then 'Meta + Instagram'
                     when canal in ('Email', 'Newsletter') then 'Email + Newsletter' else canal end as unido
  from (select distinct canal from p) c
),
esc as (
  select '1) unidos, mar-jun' as escenario, gr.unido as canal,
         (select sum(eur) from gasto gs join grupo g2 on g2.canal = gs.canal
          where g2.unido = gr.unido and gs.fecha between date '2026-03-01' and date '2026-06-30') as gasto,
         (select count(*) from nuevo n join grupo g2 on g2.canal = n.canal
          where g2.unido = gr.unido and n.created_at between date '2026-03-01' and date '2026-06-30') as nuevos
  from (select distinct unido from grupo where unido in ('Meta + Instagram', 'Email + Newsletter')) gr
  union all
  select '2) todo H1, por canal', c.canal,
         (select sum(eur) from gasto gs where gs.canal = c.canal and gs.fecha < date '2026-07-01'),
         (select count(*) from nuevo n where n.canal = c.canal and n.created_at < date '2026-07-01')
  from (select distinct canal from gasto) c
)
select escenario, canal, round(gasto) as gasto, nuevos, round(gasto / nullif(nuevos, 0)) as coste_cliente_nuevo
from esc order by escenario, coste_cliente_nuevo
