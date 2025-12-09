import os
from typing import Optional, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

from pymongo import MongoClient
import redis
from neo4j import GraphDatabase

load_dotenv()

app = FastAPI(title="Red K - API")

# --------- Config común ---------
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017/red_k")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")


# --------- Modelos Pydantic para usuarios ---------

class UserCreate(BaseModel):
    username: str
    email: str
    name: Optional[str] = None
    bio: Optional[str] = None


class UserOut(BaseModel):
    id: str
    username: str
    email: str
    name: Optional[str] = None
    bio: Optional[str] = None


# --------- Helpers de DB (simples, por-request) ---------

def get_mongo_db():
    client = MongoClient(MONGO_URI)
    return client.get_database()  # por defecto: red_k


def get_redis_client():
    return redis.from_url(REDIS_URL)


def get_neo4j_driver():
    return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


# --------- Endpoints básicos ---------

@app.get("/")
def root():
    return {"message": "Red K API corriendo dentro de Docker 🐳"}


@app.get("/health")
def health_check():
    """
    Verifica conexión con Mongo, Redis y Neo4j.
    Cualquier error se devuelve en texto, sin tumbar el servidor.
    """
    mongo_ok = False
    redis_ok = False
    neo4j_ok = False

    mongo_error = None
    redis_error = None
    neo4j_error = None

    # ---------- Mongo ----------
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        client.admin.command("ping")
        mongo_ok = True
    except Exception as e:
        mongo_ok = False
        mongo_error = str(e)

    # ---------- Redis ----------
    try:
        r = redis.from_url(REDIS_URL, socket_connect_timeout=2)
        r.ping()
        redis_ok = True
    except Exception as e:
        redis_ok = False
        redis_error = str(e)

    # ---------- Neo4j ----------
    try:
        driver = get_neo4j_driver()
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


# --------- Endpoints de usuarios ---------

@app.post("/users/", response_model=UserOut)
def create_user(user: UserCreate):
    """
    Crea un usuario:
    - Inserta documento en MongoDB
    - Crea nodo (:User) en Neo4j con id y username
    """
    db = get_mongo_db()
    users_col = db["users"]

    # verificar que no exista username duplicado
    if users_col.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username ya existe")

    doc = {
        "username": user.username,
        "email": user.email,
        "name": user.name,
        "bio": user.bio,
    }

    # Insertar en Mongo
    result = users_col.insert_one(doc)
    user_id = str(result.inserted_id)

    # Crear nodo en Neo4j
    try:
        driver = get_neo4j_driver()
        with driver.session() as session:
            session.run(
                """
                MERGE (u:User {id: $id})
                SET u.username = $username,
                    u.email = $email,
                    u.name = $name,
                    u.bio = $bio
                """,
                id=user_id,
                username=user.username,
                email=user.email,
                name=user.name,
                bio=user.bio,
            )
        driver.close()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Usuario creado en Mongo, pero fallo al crear nodo en Neo4j: {e}",
        )

    return UserOut(
        id=user_id,
        username=user.username,
        email=user.email,
        name=user.name,
        bio=user.bio,
    )


@app.get("/users/", response_model=List[UserOut])
def list_users():
    """
    Lista los usuarios desde MongoDB.
    """
    db = get_mongo_db()
    users_col = db["users"]

    docs = list(users_col.find().limit(50))  # límite arbitrario
    users: List[UserOut] = []

    for d in docs:
        users.append(
            UserOut(
                id=str(d.get("_id")),
                username=d.get("username"),
                email=d.get("email"),
                name=d.get("name"),
                bio=d.get("bio"),
            )
        )

    return users

@app.get("/users/by-username/{username}", response_model=UserOut)
def get_user_by_username(username: str):
    """
    Obtiene un usuario por username desde MongoDB.
    Lo usamos como helper para la CLI y otros endpoints.
    """
    db = get_mongo_db()
    users_col = db["users"]

    doc = users_col.find_one({"username": username})
    if not doc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return UserOut(
        id=str(doc.get("_id")),
        username=doc.get("username"),
        email=doc.get("email"),
        name=doc.get("name"),
        bio=doc.get("bio"),
    )

@app.post("/users/{username}/follow/{target_username}")
def follow_user(username: str, target_username: str):
    """
    Crea una relación FOLLOWS entre dos usuarios:
    (username) -[:FOLLOWS]-> (target_username)
    """
    if username == target_username:
        raise HTTPException(status_code=400, detail="No puedes seguirte a ti mismo")

    db = get_mongo_db()
    users_col = db["users"]

    # Verificar que ambos existen en Mongo
    user_doc = users_col.find_one({"username": username})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Usuario origen no existe")

    target_doc = users_col.find_one({"username": target_username})
    if not target_doc:
        raise HTTPException(status_code=404, detail="Usuario destino no existe")

    user_id = str(user_doc["_id"])
    target_id = str(target_doc["_id"])

    # Crear relación en Neo4j
    try:
        driver = get_neo4j_driver()
        with driver.session() as session:
            session.run(
                """
                MERGE (u:User {id: $user_id})
                SET u.username = $user_username
                MERGE (t:User {id: $target_id})
                SET t.username = $target_username
                MERGE (u)-[:FOLLOWS]->(t)
                """,
                user_id=user_id,
                user_username=username,
                target_id=target_id,
                target_username=target_username,
            )
        driver.close()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear relación FOLLOWS en Neo4j: {e}",
        )

    return {"message": f"{username} ahora sigue a {target_username}"}

class FollowingOut(BaseModel):
    username: str
    name: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[str] = None


@app.get("/users/{username}/following", response_model=List[FollowingOut])
def list_following(username: str):
    """
    Lista a quién sigue el usuario usando Neo4j.
    Se basa en nodos :User y relaciones :FOLLOWS.
    """
    db = get_mongo_db()
    users_col = db["users"]

    user_doc = users_col.find_one({"username": username})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user_id = str(user_doc["_id"])

    try:
        driver = get_neo4j_driver()
        with driver.session() as session:
            result = session.run(
                """
                MATCH (u:User {id: $user_id})-[:FOLLOWS]->(f:User)
                RETURN f.username AS username,
                       f.name AS name,
                       f.bio AS bio,
                       f.email AS email
                """,
                user_id=user_id,
            )
            following = [
                FollowingOut(
                    username=record["username"],
                    name=record["name"],
                    bio=record["bio"],
                    email=record["email"],
                )
                for record in result
            ]
        driver.close()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar Neo4j: {e}",
        )

    return following
