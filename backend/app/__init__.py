import os
from flask import Flask, jsonify
from flask_cors import CORS
from .db.connection import close_db_connection

def create_app():
    app = Flask(__name__)

    app.config["MYSQL_HOST"] = "localhost"
    app.config["MYSQL_USER"] = "root"
    app.config["MYSQL_PASSWORD"] = "areejfatima"
    app.config["MYSQL_DB"] = "flight_planner"

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    register_blueprints(app)

    app.teardown_appcontext(close_db_connection)

    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "ok"})

    return app

#A Blueprint is a way to group related routes, logic, and files together in Flask
def register_blueprints(app: Flask):
    from .routes.flights import flights_bp
    from .routes.airports import airports_bp
    from .routes.routes_planner import routes_bp
    from .routes.live import live_bp
    from .routes.routes_simulate import simulate_bp
    from .routes.graph import graph_bp

    app.register_blueprint(flights_bp)
    app.register_blueprint(airports_bp)
    app.register_blueprint(routes_bp)
    app.register_blueprint(live_bp)
    app.register_blueprint(simulate_bp)
    app.register_blueprint(graph_bp)
    return app
