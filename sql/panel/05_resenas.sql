select
-- 05_resenas.sql · Reseñas individuales de todas las fichas, solo del primer semestre (hasta el 30-jun).
r.product_id as producto_id, r.rating, to_char(r.created_at, 'YYYY-MM-DD') as fecha
from product_reviews r
where r.created_at < date '2026-07-01'
order by r.id
