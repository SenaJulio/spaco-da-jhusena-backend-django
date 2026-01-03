import sqlite3
import os
import sys

DB_PATH = "db.sqlite3"
SQL_PATH = "backup_spaco_jhusena.sql"

if not os.path.exists(SQL_PATH):
    print("Backup não encontrado:", SQL_PATH)
    sys.exit(1)

print("Restaurando banco a partir de", SQL_PATH)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

with open(SQL_PATH, "r", encoding="utf-8") as f:
    sql_script = f.read()

cur.executescript(sql_script)
conn.commit()
conn.close()

print("✔ Banco restaurado com sucesso!")
