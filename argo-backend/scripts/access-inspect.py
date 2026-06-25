#!/usr/bin/env python3
"""
Lista tablas y columnas de una base Microsoft Access (.accdb / .mdb).

Requisitos (Windows):
  pip install pyodbc
  Driver ODBC: "Microsoft Access Driver (*.mdb, *.accdb)"
  (Instalar "Microsoft Access Database Engine 2016 Redistributable" si no está)

Uso:
  python scripts/access-inspect.py "C:\\ruta\\Finstruvial.accdb"
"""

import sys

try:
    import pyodbc
except ImportError:
    print("Instale pyodbc: pip install pyodbc")
    sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    path = sys.argv[1]
    conn_str = (
        r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        rf"DBQ={path};"
    )

    try:
        conn = pyodbc.connect(conn_str)
    except pyodbc.Error as e:
        print("No se pudo abrir Access. Verifique ruta y driver ODBC.")
        print(e)
        sys.exit(1)

    cur = conn.cursor()
    tables = [
        row.table_name
        for row in cur.tables(tableType="TABLE")
        if not row.table_name.startswith("MSys")
    ]
    tables.sort()

    print(f"Base: {path}")
    print(f"Tablas de usuario: {len(tables)}\n")

    for t in tables:
        cols = cur.columns(table=t)
        names = [c.column_name for c in cols]
        print(f"## {t} ({len(names)} columnas)")
        for n in names:
            print(f"   - {n}")
        try:
            cur.execute(f"SELECT COUNT(*) FROM [{t}]")
            n = cur.fetchone()[0]
            print(f"   filas: {n}")
        except Exception:
            print("   filas: (no contable)")
        print()

    conn.close()
    print("Siguiente paso: copie access-migracion.mapping.example.json → access-migracion.mapping.json")
    print("y ajuste nombres de tabla/columna según lo listado arriba.")


if __name__ == "__main__":
    main()
