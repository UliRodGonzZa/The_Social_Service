import os
from fastapi import FastAPI
from dotenv import load_dotenv

from pymongo import MongoClient
import redis
from neo4j import GraphDatabase

load_dotenv()

app = FastAPI(title="Red K - API")


@app.get("/")
def root():
    return {"message": "Red K API corriendo dentro de Docker 🐳"}


@app.get("/health")
def health_check():
    """
    Verifica conexión con Mongo, Redis y Neo4j.
    Cualquier error se devuelve en texto, sin tumbar el servidor.
    """
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017/red_k")
    REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
    NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
    NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
    NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")

    mongo_ok = False
    redis_ok = False
    neo4j_ok = False

    mongo_error = None
    redis_error = None
    neo4j_error = None

    # ---------- Mongo ----------
    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        mongo_client.admin.command("ping")
        mongo_ok = True
    except Exception as e:
        mongo_ok = False
        mongo_error = str(e)

    # ---------- Redis ----------
    try:
        redis_client = redis.from_url(REDIS_URL, socket_connect_timeout=2)
        redis_client.ping()
        redis_ok = True
    except Exception as e:
        redis_ok = False
        redis_error = str(e)

    # ---------- Neo4j ----------
    try:
        driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
        )
        with driver.session() as session:
            session.run("RETURN 1 AS n").single()
        driver.close()
        neo4j_ok = True
    except Exception as e:
        neo4j_ok = False
        neo4j_error = str(e)

    status = "ok" if mongo_ok and redis_ok and neo4j_ok else "degraded"

    return {
        "status": status,
        "mongo": mongo_ok,
        "mongo_error": mongo_error,
        "redis": redis_ok,
        "redis_error": redis_error,
        "neo4j": neo4j_ok,
        "neo4j_error": neo4j_error,
    }
