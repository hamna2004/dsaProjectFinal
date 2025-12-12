import mysql.connector
from flask import current_app, g

def get_db_connection():
    if "db_conn" not in g:
        g.db_conn = mysql.connector.connect(
            host=current_app.config["MYSQL_HOST"],
            user=current_app.config["MYSQL_USER"],
            password=current_app.config["MYSQL_PASSWORD"],
            database=current_app.config["MYSQL_DB"],
        )
    return g.db_conn


def close_db_connection(e=None):
    conn = g.pop("db_conn", None)
    if conn is not None:
        conn.close()
