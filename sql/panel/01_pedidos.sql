with
-- 01_pedidos.sql · Un registro por pedido con el modelo común del README («4. Modelado de datos»).
--   * customer_id = persona: las cuentas con el mismo usuario de email (antes de la @, sin mayúsculas) se unifican.
--     cuenta_id guarda la cuenta original del pedido.
--   * excluido = pedido dado de baja (deleted_at) o de prueba (alguna línea cobrada a menos del 50 % de su tarifa)
--   * subtotal_eur = subtotal del pedido, sin IVA ni envío. Es la suma de sus líneas de productos que existen,
--     activos o no (las líneas de productos inexistentes no suman en el subtotal)
--   * canal normalizado: las 5 grafías de Meta Ads se unifican (Instagram Ads queda aparte)
--   * pais = país de envío del pedido · pais_cliente = país de registro de la cuenta
--   * reembolso_eur = lo reembolsado en el pedido: el subtotal entero si está refunded, una o varias unidades si es parcial
--   * unidades_devueltas = todas si refunded, y en una devolución parcial las k unidades de la línea que casa con el importe
--   * nuevo_cliente = primer pedido válido y no cancelado de la persona
--   * descuento_pct = mayor discount_pct de sus códigos (no figura en los importes: el panel lo usa solo como sensibilidad)
cli as (
  select id, country, min(id) over (partition by lower(split_part(email, '@', 1))) as persona
  from customers
),
ex as (
  select o.id from orders o
  where o.deleted_at is not null
     or exists (select 1 from order_items i join products pr on pr.id = i.product_id
                where i.order_id = o.id and i.unit_price_cents < 0.5 * pr.price_cents)
),
lv as (
  select i.order_id, i.quantity, i.unit_price_cents
  from order_items i join products pr on pr.id = i.product_id
),
uds as (select order_id, sum(quantity) as uds from lv group by 1),
reembolsos as (
  select order_id, sum(amount_cents) as amount_cents, min(created_at) as fecha, min(reason) as motivo
  from refunds group by 1
),
parcial as (
  select r.order_id, max(k) as uds
  from refunds r
  join orders o on o.id = r.order_id and o.status = 'delivered'
  join lv on lv.order_id = r.order_id
  cross join lateral generate_series(1, lv.quantity) k
  where k * lv.unit_price_cents = r.amount_cents
  group by 1
),
codigos as (
  select op.order_id, string_agg(pr.name, ' + ' order by pr.id) as codigos, max(pr.discount_pct) as dto
  from order_promotions op join promotions pr on pr.id = op.promotion_id group by 1
),
base as (
  select o.id, c.persona as customer_id, o.customer_id as cuenta_id,
         case when lower(btrim(o.channel)) = 'meta ads' then 'Meta Ads' else btrim(o.channel) end as canal,
         o.country as pais, c.country as pais_cliente, o.status as estado, o.created_at as fecha,
         o.subtotal_cents / 100.0 as subtotal_eur,
         o.shipping_cents / 100.0 as envio_eur, o.tax_cents / 100.0 as iva_eur, o.total_amount_cents / 100.0 as total_eur,
         case when o.deleted_at is not null then 'Pedido dado de baja (deleted_at)'
              when o.id in (select id from ex) then 'Pedido de prueba (línea a menos del 50 % de su tarifa)'
         end as motivo_exclusion,
         cd.codigos, coalesce(cd.dto, 0) as descuento_pct,
         r.amount_cents / 100.0 as reembolso_eur, r.fecha as fecha_reembolso, r.motivo as motivo_reembolso,
         coalesce(u.uds, 0) as unidades,
         case when o.status = 'refunded' then u.uds when pa.order_id is not null then pa.uds end as unidades_devueltas,
         case when o.status = 'refunded' then 'total' when r.order_id is not null then 'parcial' end as tipo_devolucion
  from orders o
  join cli c on c.id = o.customer_id
  left join uds u on u.order_id = o.id
  left join reembolsos r on r.order_id = o.id
  left join codigos cd on cd.order_id = o.id
  left join parcial pa on pa.order_id = o.id
)
select b.id, b.customer_id, b.cuenta_id, b.canal, b.pais, b.pais_cliente, b.estado,
       to_char(b.fecha, 'YYYY-MM-DD') as fecha,
       b.subtotal_eur::float8 as subtotal_eur, b.envio_eur::float8 as envio_eur, b.iva_eur::float8 as iva_eur, b.total_eur::float8 as total_eur,
       b.motivo_exclusion, (b.motivo_exclusion is not null) as excluido, b.codigos,
       b.descuento_pct::int as descuento_pct,
       b.reembolso_eur::float8 as reembolso_eur, to_char(b.fecha_reembolso, 'YYYY-MM-DD') as fecha_reembolso, b.motivo_reembolso,
       b.unidades::int as unidades, b.unidades_devueltas::int as unidades_devueltas, b.tipo_devolucion,
       (b.motivo_exclusion is null and b.estado <> 'cancelled'
        and row_number() over (partition by b.customer_id
                               order by (b.motivo_exclusion is not null or b.estado = 'cancelled'), b.fecha, b.id) = 1) as nuevo_cliente
from base b
order by b.id
