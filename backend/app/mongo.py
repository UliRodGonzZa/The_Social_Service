from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
import os

# Carga URI desde variables de entorno
# La URI puede incluir el nombre de la DB: mongodb://host:port/dbname
MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/red_k")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "red_k")

_client = None
_db = None


def _connect():
    """
    Crea una única conexión global a MongoDB.
    Se reutiliza en todo el backend para evitar múltiples conexiones.
    """
    global _client, _db

    if _client is None:
        try:
            _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
            # Forzar test de conexión
            _client.admin.command("ping")
            _db = _client[MONGO_DB_NAME]
            print(f"[MongoDB] Conectado a {MONGO_URI} / DB={MONGO_DB_NAME}")
        except ConnectionFailure as e:
            print(f"[MongoDB] Error al conectar: {e}")
            raise e

    return _db


def get_mongo_db():
    """
    Punto de acceso oficial para obtener la BD.
    Siempre devuelve la misma conexión global.
    """
    return _connect()
