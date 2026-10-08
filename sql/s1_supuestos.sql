with
-- S1 · Supuestos calculados de las dos maneras (README, «6. Supuestos»).
-- Devuelve: un supuesto por fila con la cifra que resulta de la opción elegida y la de la opción contraria.
-- Los supuestos de canales, categorías y cohortes tienen su opción contraria en c04, c05b y c08b.
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
-- >>> QUERY DE LOS SUPUESTOS
h as (select * from p where es_venta and en_h1),
neto_h1 as (select sum(neto) as v from h),
la as (select order_id, sum(quantity * unit_price_cents) / 100.0 as v from l where active group by 1),
dto as (
  select op.order_id, max(pr.discount_pct) as pct
  from order_promotions op join promotions pr on pr.id = op.promotion_id group by 1
),
filas as (
  select 1 as n, 'Venta neta: solo H1 (contrario: con julio 1-12)' as supuesto,
         (select v from neto_h1) as elegido, (select sum(neto) from p where es_venta) as contrario
  union all
  select 2, 'Venta neta: mes por fecha local (contrario: fecha UTC)', (select v from neto_h1),
         (select sum(p.neto) from p join orders o on o.id = p.id
          where p.es_venta and (o.created_at_utc at time zone 'UTC')::date between date '2026-01-01' and date '2026-06-30')
  union all
  select 3, 'Venta: cancelados fuera (contrario: dentro)', (select sum(subtotal) from h),
         (select sum(subtotal) from p where en_h1)
  union all
  select 4, 'Venta neta: pendientes dentro (contrario: fuera)', (select v from neto_h1),
         (select sum(neto) from h where status <> 'pending')
  union all
  select 5, 'Venta neta: pendientes anteriores a junio dentro (contrario: fuera)', (select v from neto_h1),
         (select sum(neto) from h where not (status = 'pending' and created_at < date '2026-06-01'))
  union all
  select 6, 'Venta neta: subtotal (contrario: total con IVA y envío, nota de dirección 2)', (select v from neto_h1),
         (select sum(o.total_amount_cents / 100.0 - h.devuelto) from h join orders o on o.id = h.id)
  union all
  select 7, 'Venta neta: sin restar el descuento de los códigos (contrario: restándolo)', (select v from neto_h1),
         (select sum(h.neto * (1 - coalesce(dto.pct, 0) / 100.0)) from h left join dto on dto.order_id = h.id)
  union all
  select 8, 'Venta neta: pedidos dados de baja fuera (contrario: dentro)', (select v from neto_h1),
         (select v from neto_h1) + (select sum(o.subtotal_cents / 100.0 - coalesce(rf.eur, 0)) from orders o left join rf on rf.order_id = o.id
                                    where o.deleted_at is not null and o.status <> 'cancelled' and o.created_at < date '2026-07-01')
  union all
  select 9, 'Compradores: pedidos de prueba fuera (contrario: dentro)', (select count(distinct persona) from h),
         (select count(distinct c.persona) from orders o join cli c on c.id = o.customer_id
          where o.deleted_at is null and o.status <> 'cancelled' and o.created_at < date '2026-07-01')
  union all
  select 10, 'Venta neta: fichas inactivas dentro (contrario: fuera, nota de dirección 4)', (select v from neto_h1),
         (select sum(la.v - case when h.status = 'refunded' then la.v
                                 else coalesce((select r.amount_cents / 100.0 from refunds r where r.order_id = h.id
                                                and exists (select 1 from l, generate_series(1, l.quantity) k
                                                            where l.order_id = h.id and l.active and k * l.unit_price_cents = r.amount_cents)), 0) end)
          from h join la on la.order_id = h.id)
  union all
  select 11, 'Compradores: personas (contrario: cuentas de cliente)', (select count(distinct persona) from h),
         (select count(distinct o.customer_id) from orders o join h on h.id = o.id)
  union all
  select 12, 'Clientes nuevos de H1: personas (contrario: cuentas de cliente)',
         (select count(*) from nuevo where created_at < date '2026-07-01'),
         (select count(*) from (select distinct on (o.customer_id) o.customer_id, o.created_at
                                from orders o join p on p.id = o.id where p.es_venta order by o.customer_id, o.created_at, o.id) z
          where created_at < date '2026-07-01')
  union all
  select 13, 'Venta neta: cliente 177 (patrón de revendedor) dentro (contrario: fuera)', (select v from neto_h1),
         (select v from neto_h1) - (select sum(neto) from h where persona = 177)
  union all
  select 14, '% de pedidos con devolución: con parciales (contrario: solo refunded, nota de dirección 8)',
         (select round(100.0 * count(*) filter (where devuelto > 0) / count(*), 1) from h where status in ('delivered', 'refunded')),
         (select round(100.0 * count(*) filter (where status = 'refunded') / count(*), 1) from h where status in ('delivered', 'refunded'))
  union all
  select 15, 'Venta neta: devolución en el mes del pedido (contrario: en el mes del reembolso)', (select v from neto_h1),
         (select sum(subtotal) from h) - (select sum(r.amount_cents) / 100.0 from refunds r join p on p.id = r.order_id
                                           where p.es_venta and r.created_at < date '2026-07-01')
  union all
  select 16, '% de pedidos con devolución: todo H1 (contrario: solo pedidos hasta el 12-jun, con 30 días para devolver)',
         (select round(100.0 * count(*) filter (where devuelto > 0) / count(*), 1) from h where status in ('delivered', 'refunded')),
         (select round(100.0 * count(*) filter (where devuelto > 0) / count(*), 1) from h
          where status in ('delivered', 'refunded') and created_at <= date '2026-06-12')
  union all
  select 17, 'Peor nota: 10 o más reseñas de H1 (contrario: media simple de todas, nota de dirección 5)',
         (select min(nota) from (select avg(rating) as nota from product_reviews where created_at < date '2026-07-01'
                                 group by product_id having count(*) >= 10) a),
         (select min(nota) from (select avg(rating) as nota from product_reviews group by product_id) b)
  union all
  select 18, 'Coste por cliente nuevo de TikTok, mar-jun: gasto registrado (contrario: gasto al ritmo de antes del recorte)',
         (select sum(eur) from gasto where canal = 'TikTok Ads' and fecha between date '2026-03-01' and date '2026-06-30')
           / (select count(*) from nuevo where canal = 'TikTok Ads' and created_at between date '2026-03-01' and date '2026-06-30'),
         (select sum(eur) / 46.0 * 122 from gasto where canal = 'TikTok Ads' and fecha < date '2026-02-16')
           / (select count(*) from nuevo where canal = 'TikTok Ads' and created_at between date '2026-03-01' and date '2026-06-30')
  union all
  select 19, 'Venta neta a 90 días del cliente nuevo: sin la cohorte de enero (contrario: con ella)',
         (select avg((select sum(p2.neto) from p p2 where p2.persona = n.persona and p2.es_venta and p2.created_at <= n.created_at + 90))
          from nuevo n where n.created_at between date '2026-02-01' and date '2026-04-13'),
         (select avg((select sum(p2.neto) from p p2 where p2.persona = n.persona and p2.es_venta and p2.created_at <= n.created_at + 90))
          from nuevo n where n.created_at <= date '2026-04-13')
  union all
  select 20, 'Clientes nuevos de H1: primer pedido no cancelado (contrario: primer pedido de cualquier estado)',
         (select count(*) from nuevo where created_at < date '2026-07-01'),
         (select count(*) from (select distinct on (persona) persona, created_at from p order by persona, created_at, id) z
          where created_at < date '2026-07-01')
  union all
  select 21, 'Pedidos de prueba: umbral del 50 % de la tarifa (contrario: 80 %)',
         (select count(*) from orders o where o.deleted_at is null and exists (select 1 from order_items i join products pr on pr.id = i.product_id
                 where i.order_id = o.id and i.unit_price_cents < 0.5 * pr.price_cents)),
         (select count(*) from orders o where o.deleted_at is null and exists (select 1 from order_items i join products pr on pr.id = i.product_id
                 where i.order_id = o.id and i.unit_price_cents < 0.8 * pr.price_cents))
  union all
  select 22, '% de compradores que repiten en H1: sobre todos (contrario: solo clientes activos, con algún pedido entregado, nota de dirección 3)',
         (select round(100.0 * count(*) filter (where n >= 2) / count(*), 1) from (select persona, count(*) as n from h group by 1) a),
         (select round(100.0 * count(*) filter (where n >= 2) / count(*), 1)
          from (select persona, count(*) as n from h group by 1 having bool_or(status = 'delivered')) b)
  union all
  select 23, 'Ticket medio de H1: todos los compradores (contrario: solo clientes activos, nota de dirección 3)',
         (select sum(subtotal) / count(*) from h),
         (select sum(subtotal) / count(*) from h where persona in (select persona from h where status = 'delivered'))
  union all
  select 24, 'Cifra de venta: venta neta de H1 (contrario: subtotal de todos los pedidos, sin limpiar y de cualquier estado, hasta el 12-jul)',
         (select v from neto_h1), (select sum(subtotal_cents) / 100.0 from orders)
)
select n, supuesto, round(elegido, 2) as con_lo_elegido, round(contrario, 2) as con_lo_contrario,
       round(contrario - elegido, 2) as diferencia
from filas order by n
