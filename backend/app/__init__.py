import os
from flask import Flask, jsonify
from flask_cors import CORS
from .db.connection import close_db_connection

def create_app():
    """
    WHAT THIS FUNCTION DOES:
    - Creates and configures the Flask application
    - Sets up database connection settings
    - Registers all the API routes (blueprints)
    - Sets up automatic cleanup of database connections

    This is called once when the server starts up.
    """
    app = Flask(__name__)

    # MySQL connection configuration
    app.config["MYSQL_HOST"] = "localhost"
    app.config["MYSQL_USER"] = "root"
    app.config["MYSQL_PASSWORD"] = "Abababab@2008"
    app.config["MYSQL_DB"] = "flight_planner"

    # These settings are stored in app.config
    # Later, when get_db_connection() (in connection.py) is called, it will read these values
    # to know how to connect to the database

    # CORS SETUP (Cross-Origin Resource Sharing)
    # Allow frontend dev server (React) to call the API
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    # This says: "Allow any website (*) to make requests to /api/* routes

    # Register blueprints
    register_blueprints(app)

    # Ensure DB connections are closed after each request
    app.teardown_appcontext(close_db_connection)

    # Simple health check route so we can confirm the app boots
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({"status": "ok"})

    return app

def register_blueprints(app: Flask):
    """
    WHAT THIS FUNCTION DOES:
    - Imports all the route modules (blueprints)
    - Registers them with the Flask app
    - This makes all the API endpoints available

    Blueprints are like "modules" of routes. For example:
    - flights_bp has routes like /api/flights
    - airports_bp has routes like /api/airports
    - routes_bp has routes like /api/routes/find
    """
    #import all
    from .routes.flights import flights_bp
    from .routes.airports import airports_bp
    from .routes.routes_planner import routes_bp
    from .routes.live import live_bp   # path depends on your structure
    from .routes.routes_simulate import simulate_bp
    from .routes.graph import graph_bp

    #register all
    app.register_blueprint(flights_bp)
    app.register_blueprint(airports_bp)
    app.register_blueprint(routes_bp)
    app.register_blueprint(live_bp)
    app.register_blueprint(simulate_bp)
    app.register_blueprint(graph_bp)
    return app
