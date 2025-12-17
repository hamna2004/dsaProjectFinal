import mysql.connector
#current_app is the flask app that is currently handling the request
#g is basically a request-level storage
#a small storage box that lives only during one http request
from flask import current_app, g

def get_db_connection():
    if "db_conn" not in g: 
        # checks if db connection alr exists for this request
        #so not to create multiple connection for one request
        g.db_conn = mysql.connector.connect(
            host=current_app.config["MYSQL_HOST"],
            user=current_app.config["MYSQL_USER"],
            password=current_app.config["MYSQL_PASSWORD"],
            database=current_app.config["MYSQL_DB"],
        )
    return g.db_conn # returns a mysql database connection


def close_db_connection(e=None):
    conn = g.pop("db_conn", None)
    if conn is not None:
        conn.close()
#closes connection after use
