select
-- 02_lineas.sql · Líneas de pedido de productos que existen en el catálogo, activos o no, con su categoría.
-- Las líneas de productos inexistentes no entran: no suman en el subtotal del pedido.
-- activo = la ficha está activa. Las inactivas se marcan en el panel, pero su venta cuenta: se cobró.
-- Zapatillas Trail Urbanas pasa de Accesorios a Deporte: son zapatillas de trail, no un accesorio.
i.id,
       i.order_id as pedido_id,
       i.product_id as producto_id,
       p.name as producto,
       case when p.name = 'Zapatillas Trail Urbanas' then 'Deporte' else p.category end as categoria,
       p.active as activo,
       i.quantity as cantidad,
       (i.unit_price_cents / 100.0)::float8 as precio_eur,
       (i.quantity * i.unit_price_cents / 100.0)::float8 as importe_eur,
       (p.price_cents / 100.0)::float8 as tarifa_eur
from order_items i
join products p on p.id = i.product_id
order by i.id
