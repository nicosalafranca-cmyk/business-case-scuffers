select
-- 03_gasto.sql · Gasto diario por canal en EUR.
-- Google Ads viene en EUR_CENTS: se divide entre 100.
-- Se eliminan las filas duplicadas exactas (mismo canal, día e importe).
channel as canal,
       to_char(date, 'YYYY-MM-DD') as fecha,
       (case when currency_unit = 'EUR_CENTS' then spend_raw / 100.0 else spend_raw end)::float8 as gasto_eur
from (select distinct channel, date, spend_raw, currency_unit from marketing_spend) d
order by 1, 2
