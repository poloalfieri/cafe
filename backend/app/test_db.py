from flask import Flask
from db.connection import test_connection
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

if __name__ == "__main__":
    with app.app_context():
        test_connection() 