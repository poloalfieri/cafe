import os
import pytest
from flask import Flask

from app.db.connection import test_connection as db_test_connection
from app.config import Config


@pytest.mark.skipif(os.getenv("RUN_DB_TESTS") != "1", reason="DB tests disabled by default")
def test_db_connection():
    app = Flask(__name__)
    app.config.from_object(Config)
    with app.app_context():
        db_test_connection()
