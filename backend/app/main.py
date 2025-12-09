import os
from typing import Optional, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

from pymongo import MongoClient
import redis
from neo4j import GraphDatabase

from datetime import datetime
import json


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

class PostCreate(BaseModel):
    author_username: str
    content: str
    tags: Optional[List[str]] = None


class PostOut(BaseModel):
    id: str
    author_username: str
    content: str
    tags: Optional[List[str]] = None
    created_at: str  # ISO string


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

@app.post("/posts/", response_model=PostOut)
def create_post(post: PostCreate):
    """
    Crea un post:
    - Guarda en MongoDB (colección `posts`)
    - Crea nodo (:Post) y relación (:User)-[:POSTED]->(:Post) en Neo4j
    - Invalidata el feed cacheado del autor en Redis
    """
    db = get_mongo_db()
    users_col = db["users"]
    posts_col = db["posts"]

    # Verificar que el autor exista
    user_doc = users_col.find_one({"username": post.author_username})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Autor no encontrado")

    user_id = str(user_doc["_id"])
    created_at = datetime.utcnow().isoformat()

    doc = {
        "author_username": post.author_username,
        "author_id": user_id,
        "content": post.content,
        "tags": post.tags or [],
        "created_at": created_at,
    }

    # Insertar en Mongo
    result = posts_col.insert_one(doc)
    post_id = str(result.inserted_id)

    # Crear nodo Post y relación en Neo4j
    try:
        driver = get_neo4j_driver()
        with driver.session() as session:
            session.run(
                """
                MERGE (u:User {id: $user_id})
                SET u.username = $username
                MERGE (p:Post {id: $post_id})
                SET p.content = $content,
                    p.created_at = $created_at
                MERGE (u)-[:POSTED]->(p)
                """,
                user_id=user_id,
                username=post.author_username,
                post_id=post_id,
                content=post.content,
                created_at=created_at,
            )
        driver.close()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Post creado en Mongo, pero fallo al crear nodo/relacion en Neo4j: {e}",
        )

    # Invalidar cache del feed del autor (simplemente borrar)
    try:
        r = get_redis_client()
        r.delete(f"feed:{post.author_username}")
    except Exception:
        # si Redis falla, no rompemos el flujo
        pass

    return PostOut(
        id=post_id,
        author_username=post.author_username,
        content=post.content,
        tags=post.tags or [],
        created_at=created_at,
    )

@app.get("/users/{username}/feed", response_model=List[PostOut])
def get_user_feed(username: str, limit: int = 20):
    """
    Feed del usuario:
    - Usa Neo4j para obtener a quién sigue
    - Usa Mongo para traer posts de esos usuarios + el propio
    - Usa Redis para cachear el resultado por unos segundos
    """
    db = get_mongo_db()
    users_col = db["users"]
    posts_col = db["posts"]
    r = None

    # Intentar conectar a Redis (opcional)
    try:
        r = get_redis_client()
    except Exception:
        r = None

    cache_key = f"feed:{username}"

    # Intentar leer de cache
    if r is not None:
        cached = r.get(cache_key)
        if cached:
            try:
                data = json.loads(cached)
                # devolvemos directamente lo cacheado
                return data
            except Exception:
                pass  # si falla parseo, seguimos normal

    # Verificar que el usuario exista
    user_doc = users_col.find_one({"username": username})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user_id = str(user_doc["_id"])

    # Obtener a quién sigue desde Neo4j
    followed_usernames: List[str] = [username]  # incluimos al propio usuario
    try:
        driver = get_neo4j_driver()
        with driver.session() as session:
            result = session.run(
                """
                MATCH (u:User {id: $user_id})-[:FOLLOWS]->(f:User)
                RETURN f.username AS username
                """,
                user_id=user_id,
            )
            for record in result:
                if record["username"] and record["username"] not in followed_usernames:
                    followed_usernames.append(record["username"])
        driver.close()
    except Exception as e:
        # si Neo4j falla, solo usamos al propio user
        # (podrías levantar 500, pero para demo es mejor degradar)
        pass

    # Traer posts desde Mongo
    cursor = (
        posts_col.find(
            {"author_username": {"$in": followed_usernames}}
        )
        .sort("created_at", -1)
        .limit(limit)
    )

    posts: List[PostOut] = []
    for d in cursor:
        posts.append(
            PostOut(
                id=str(d.get("_id")),
                author_username=d.get("author_username"),
                content=d.get("content"),
                tags=d.get("tags") or [],
                created_at=d.get("created_at"),
            )
        )

    # Cachear feed en Redis por 60 segundos
    if r is not None:
        try:
            r.setex(cache_key, 60, json.dumps([p.dict() for p in posts]))
        except Exception:
            pass

    return posts
