"""
Server entry point
Imports the FastAPI app from app.main
Configura para que funcione con /api prefix
"""

from app.main import app as original_app
from fastapi import FastAPI

# Crear app wrapper que maneje /api y sin /api
app = FastAPI(title="Red K - API Wrapper")

# Montar la app original en /api
app.mount("/api", original_app)

# También en la raíz para requests locales
@app.get("/")
def root():
    return {"message": "Red K API corriendo dentro de Docker 🐳"}

@app.get("/health")
async def health():
    from app.main import get_mongo_db, get_redis, get_neo4j_driver
    try:
        mongo_ok = get_mongo_db() is not None
        mongo_error = None
    except Exception as e:
        mongo_ok = False
        mongo_error = str(e)

    try:
        redis_ok = get_redis() is not None
        redis_error = None
    except Exception as e:
        redis_ok = False
        redis_error = str(e)

    try:
        neo4j_ok = get_neo4j_driver() is not None
        neo4j_error = None
    except Exception as e:
        neo4j_ok = False
        neo4j_error = str(e)

    status = "ok" if all([mongo_ok, redis_ok, neo4j_ok]) else "degraded"

    return {
        "status": status,
        "mongo": mongo_ok,
        "mongo_error": mongo_error,
        "redis": redis_ok,
        "redis_error": redis_error,
        "neo4j": neo4j_ok,
        "neo4j_error": neo4j_error,
    }

__all__ = ['app']
