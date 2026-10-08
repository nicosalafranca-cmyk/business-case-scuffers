with
-- 06_clientes.sql · Personas registradas: las cuentas con el mismo usuario de email (antes de la @, sin mayúsculas)
-- son una persona. id = la cuenta más antigua por id, pais = su país de registro, alta = la primera alta.
-- Sirve para separar «registrados» de «compradores» (personas con al menos un pedido válido).
c as (select id, country, created_at, min(id) over (partition by lower(split_part(email, '@', 1))) as persona from customers)
select persona as id, (array_agg(country order by id))[1] as pais, to_char(min(created_at), 'YYYY-MM-DD') as alta
from c group by persona
order by 1
