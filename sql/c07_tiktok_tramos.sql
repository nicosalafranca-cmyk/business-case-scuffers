with
-- C7 · TikTok antes, durante y después del recorte de gasto (README, conclusión C7).
-- Devuelve: por tramo, días, gasto al día y cada 30 días, pedidos y clientes nuevos de TikTok cada 30 días, coste por
-- cliente nuevo y % de su venta neta que es recompra. La última fila es el coste de cada cliente nuevo adicional:
-- gasto extra cada 30 días del tramo 1 frente al 3, dividido entre los clientes nuevos extra cada 30 días.
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
-- >>> QUERY DE C7
tr as (
  select * from (values ('1) 1-ene a 15-feb', date '2026-01-01', date '2026-02-16'),
                        ('2) 16 a 28-feb, recorte', date '2026-02-16', date '2026-03-01'),
                        ('3) 1-mar a 30-jun', date '2026-03-01', date '2026-07-01')) t(tramo, ini, fin)
),
x as (
  select tramo, fin - ini as dias,
         (select sum(eur) from gasto where canal = 'TikTok Ads' and fecha >= ini and fecha < fin) as gasto,
         (select count(*) from p where es_venta and canal = 'TikTok Ads' and created_at >= ini and created_at < fin) as pedidos,
         (select count(*) from nuevo where canal = 'TikTok Ads' and created_at >= ini and created_at < fin) as nuevos,
         (select sum(neto) from p where es_venta and canal = 'TikTok Ads' and created_at >= ini and created_at < fin) as neto,
         (select sum(neto) from p where es_venta and canal = 'TikTok Ads' and created_at >= ini and created_at < fin
          and id not in (select id from nuevo)) as neto_recompra
  from tr
),
y as (
  select tramo, dias, round(gasto / dias, 2) as gasto_dia, round(30 * gasto / dias) as gasto_30d,
         round(30.0 * pedidos / dias, 1) as pedidos_30d, nuevos, round(30.0 * nuevos / dias, 2) as nuevos_30d,
         round(gasto / nullif(nuevos, 0)) as coste_cliente_nuevo,
         round(100.0 * neto_recompra / neto, 1) as pct_venta_recompra
  from x
)
select * from y
union all
select '4) coste por cliente nuevo adicional (1 frente a 3)', null, null,
       (select gasto_30d from y where tramo like '1)%') - (select gasto_30d from y where tramo like '3)%'), null, null,
       round((select 30.0 * nuevos / dias from x where tramo like '1)%') - (select 30.0 * nuevos / dias from x where tramo like '3)%'), 2),
       round(((select 30 * gasto / dias from x where tramo like '1)%') - (select 30 * gasto / dias from x where tramo like '3)%'))
           / ((select 30.0 * nuevos / dias from x where tramo like '1)%') - (select 30.0 * nuevos / dias from x where tramo like '3)%'))),
       null
order by tramo
