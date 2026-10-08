#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cliente mínimo para la API de SQL de la prueba técnica de Scuffers.

Solo usa la librería estándar, así que funciona sin instalar nada. Si tienes
pandas, `df()` te devuelve un DataFrame.

Configuración: ya está hecha. El fichero `.env` que viene al lado de este
script lleva la URL y la clave, así que no tienes que tocar nada. Escribe tu
nombre en `MI_NOMBRE` si quieres que tus consultas queden etiquetadas.

(`.env` empieza por punto, así que en Finder no se ve; en la terminal, con
`ls -a`, sí.)

Si prefieres las variables en el entorno, también vale, y lo que exportes gana
a lo que diga el fichero:

    export SUPABASE_URL="https://xxxxxxxx.supabase.co"
    export SUPABASE_KEY="sb_publishable_..."
    export MI_NOMBRE="tu nombre"      # para etiquetar tus consultas

Uso desde la terminal:

    python3 helper_sql.py "select count(*) as n from orders"
    python3 helper_sql.py -f mi_consulta.sql

Uso desde Python o un notebook:

    from helper_sql import sql, df
    sql("select status, count(*) as n from orders group by 1 order by 2 desc")
    df("select * from products")

Límites de la API: una sola sentencia por llamada, solo lectura (select o with),
15 segundos y 5.000 filas como máximo. Si necesitas más filas, agrega en SQL:
para eso está.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

def _cargar_env() -> None:
    """Lee un .env de al lado del script o del directorio actual, si existe.

    Sin dependencias: hacer `export` a mano sigue valiendo, y lo que ya esté en
    el entorno tiene prioridad sobre el fichero.
    """
    from pathlib import Path

    for sitio in (Path(__file__).resolve().parent / ".env", Path.cwd() / ".env"):
        if not sitio.is_file():
            continue
        for linea in sitio.read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, _, valor = linea.partition("=")
            clave, valor = clave.strip(), valor.strip().strip("'\"")
            if clave and clave not in os.environ:
                os.environ[clave] = valor
        break


_cargar_env()

# Se aceptan también los nombres NEXT_PUBLIC_*, que son los que va a necesitar
# el panel: así un solo .env sirve para el cliente de SQL y para el dashboard.
URL = (os.environ.get("SUPABASE_URL")
       or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")).rstrip("/")
KEY = (os.environ.get("SUPABASE_KEY")
       or os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""))
QUIEN = os.environ.get("MI_NOMBRE") or os.environ.get("USER")


class ErrorSQL(RuntimeError):
    """La base de datos rechazó la consulta. El mensaje viene de Postgres."""


def sql(consulta: str, quien: str | None = None) -> list[dict]:
    """Ejecuta una consulta de lectura y devuelve una lista de diccionarios."""
    if not URL or not KEY:
        raise RuntimeError("Falta configurar SUPABASE_URL y SUPABASE_KEY en el entorno.")

    cuerpo = json.dumps({"q": consulta, "quien": quien or QUIEN}).encode("utf-8")
    peticion = urllib.request.Request(
        f"{URL}/rest/v1/rpc/run_sql",
        data=cuerpo,
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        detalle = err.read().decode("utf-8", "replace")
        try:
            detalle = json.loads(detalle).get("message", detalle)
        except json.JSONDecodeError:
            pass
        raise ErrorSQL(detalle) from None


def df(consulta: str):
    """Igual que sql(), pero devuelve un DataFrame de pandas."""
    import pandas as pd

    return pd.DataFrame(sql(consulta))


def tabla(filas: list[dict], maximo: int = 40) -> str:
    """Formatea el resultado como una tabla de texto alineada."""
    if not filas:
        return "(sin filas)"
    cols = list(filas[0].keys())
    ancho = {c: max(len(c), *(len(str(f.get(c, ""))) for f in filas[:maximo])) for c in cols}
    sep = "  ".join("-" * ancho[c] for c in cols)
    out = ["  ".join(c.ljust(ancho[c]) for c in cols), sep]
    for f in filas[:maximo]:
        out.append("  ".join(str(f.get(c, "")).ljust(ancho[c]) for c in cols))
    if len(filas) > maximo:
        out.append(f"... {len(filas) - maximo} filas más ({len(filas)} en total)")
    return "\n".join(out)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        raise SystemExit(0)
    consulta = (open(args[1], encoding="utf-8").read() if args[0] == "-f" and len(args) > 1
                else " ".join(args))
    try:
        print(tabla(sql(consulta)))
    except (ErrorSQL, RuntimeError) as err:
        print(f"Error: {err}", file=sys.stderr)
        raise SystemExit(1)
