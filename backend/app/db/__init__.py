#flask extension that handles CORS (cross-origin resource sharing)
#CORS controls which frontends are allowed to talk to your backend
from flask_cors import CORS

#this function is called in run.py
def create_app():
    app = Flask(__name__) #initializing backend app
    CORS(app, resources={r"/*": {"origins": "*"}})
    #allowing any frontend to access any backend point (used * )


