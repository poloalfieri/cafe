from flask import current_app
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def get_db():
    if current_app.config["USE_ORM"]:
        engine = create_engine(current_app.config["DB_URI"])
        Session = sessionmaker(bind=engine)
        return Session()
    else:
        import sqlite3
        conn = sqlite3.connect(current_app.config["DB_URI"].replace("sqlite:///", ""))
        return conn

def test_connection():
    if current_app.config["USE_ORM"]:
        engine = create_engine(current_app.config["DB_URI"])
        with engine.connect() as connection:
            result = connection.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
            tables = [row[0] for row in result]
            print("Tablas en la base de datos:", tables)
            return tables
    else:
        print("No se está usando ORM/PostgreSQL.")
        return [] 