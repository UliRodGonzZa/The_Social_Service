import os
from typing import Optional, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from pymongo import MongoClient
from bson import ObjectId
import redis
from neo4j import GraphDatabase

from datetime import datetime
import json
from enum import Enum

load_dotenv()

app = FastAPI(title="Red K - API")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios exactos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------- Config común ---------
MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/red_k")
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://127.0.0.1:7687")
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

class FeedMode(str, Enum):
    all = "all"          # posts tuyos + de quienes sigues
    self_only = "self"   # solo tus posts
    following_only = "following"  # solo posts de quienes sigues

class SuggestionOut(BaseModel):
    username: str
    name: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[str] = None
    score: float
    reason: Optional[str] = None
    mutual_connections: int = 0
    followers_count: int = 0
    posts_count: int = 0

class DMCreate(BaseModel):
    sender_username: str
    receiver_username: str
    content: str


class DMOut(BaseModel):
    id: str
    sender_username: str
    receiver_username: str
    content: str
    created_at: str  # ISO string
    read: bool
    read_at: Optional[str] = None


class DMConversationSummary(BaseModel):
    with_username: str
    last_message_content: str
    last_message_at: str  # ISO
    unread_count: int

# --------- Helpers de DB (simples, por-request) ---------

def get_mongo_db():
    client = MongoClient(MONGO_URI)
    return client.get_database("red_k")  # explicitly specify database name


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

    # Crear relación en Neo4j (o MongoDB como fallback)
    neo4j_success = False
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
        neo4j_success = True
    except Exception as e:
        print(f"⚠️ Neo4j no disponible para follow, usando MongoDB: {e}")
        # Fallback: guardar en MongoDB
        follows_col = db["follows"]
        follows_col.update_one(
            {"follower": username, "following": target_username},
            {"$set": {"follower": username, "following": target_username}},
            upsert=True
        )

    # Invalidar caché del feed del usuario (después de follow, su feed cambia)
    try:
        r = get_redis_client()
        if r is not None:
            # Eliminar todas las variantes del feed en caché
            pattern = f"feed:{username}:*"
            keys_to_delete = []
            for key in r.scan_iter(match=pattern):
                keys_to_delete.append(key)
            if keys_to_delete:
                r.delete(*keys_to_delete)
                print(f"🗑️  Invalidado caché de feed para {username}: {len(keys_to_delete)} keys")
    except Exception as e:
        print(f"⚠️  No se pudo invalidar caché (no crítico): {e}")

    return {"message": f"{username} ahora sigue a {target_username}"}


@app.delete("/users/{username}/follow/{target_username}")
def unfollow_user(username: str, target_username: str):
    """
    Elimina la relación FOLLOWS entre dos usuarios:
    (username) -[:FOLLOWS]-> (target_username)
    """
    if username == target_username:
        raise HTTPException(status_code=400, detail="No puedes dejar de seguirte a ti mismo")

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

    # Eliminar relación en Neo4j
    try:
        driver = get_neo4j_driver()
        with driver.session() as session:
            result = session.run(
                """
                MATCH (u:User {id: $user_id})-[r:FOLLOWS]->(t:User {id: $target_id})
                DELETE r
                RETURN count(r) as deleted_count
                """,
                user_id=user_id,
                target_id=target_id,
            )
            record = result.single()
            deleted_count = record["deleted_count"] if record else 0
            
            if deleted_count == 0:
                raise HTTPException(
                    status_code=404, 
                    detail=f"{username} no sigue a {target_username}"
                )
        
        driver.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al eliminar relación FOLLOWS en Neo4j: {e}",
        )

    # Invalidar caché del feed del usuario (después de unfollow, su feed cambia)
    try:
        r = get_redis_client()
        if r is not None:
            # Eliminar todas las variantes del feed en caché
            pattern = f"feed:{username}:*"
            keys_to_delete = []
            for key in r.scan_iter(match=pattern):
                keys_to_delete.append(key)
            if keys_to_delete:
                r.delete(*keys_to_delete)
                print(f"🗑️  Invalidado caché de feed para {username}: {len(keys_to_delete)} keys")
    except Exception as e:
        print(f"⚠️  No se pudo invalidar caché (no crítico): {e}")

    return {"message": f"{username} dejó de seguir a {target_username}"}


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
    
    try:
        r = get_redis_client()
        r.delete(f"feed:{post.author_username}")
    except Exception:
        pass

    return PostOut(
        id=post_id,
        author_username=post.author_username,
        content=post.content,
        tags=post.tags or [],
        created_at=created_at,
    )

# Endpoint de feed con soporte para diferentes modos
@app.get("/users/{username}/feed", response_model=List[PostOut])
def get_user_feed(
    username: str,
    limit: int = 20,
    mode: FeedMode = FeedMode.all,
):
    """
    Feed del usuario:
    - mode = all: posts del usuario + de quienes sigue
    - mode = self: solo posts del usuario
    - mode = following: solo posts de quienes sigue
    - Usa Neo4j para obtener a quién sigue
    - Usa Mongo para traer posts
    - Usa Redis para cachear el resultado
    """
    db = get_mongo_db()
    users_col = db["users"]
    posts_col = db["posts"]

    # Intentar conectar a Redis (opcional)
    try:
        r = get_redis_client()
    except Exception:
        r = None

    # Verificar que el usuario exista
    user_doc = users_col.find_one({"username": username})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user_id = str(user_doc["_id"])

    # Cache key depende de username + modo + limit
    cache_key = f"feed:{username}:{mode.value}:{limit}"

    # Intentar leer de cache
    if r is not None:
        try:
            cached = r.get(cache_key)
            if cached:
                try:
                    data = json.loads(cached)
                    return data
                except Exception:
                    pass  # si falla parseo, seguimos normal
        except Exception:
            # Redis no está disponible, continuar sin cache
            r = None

    # Construir lista de autores según el modo
    authors: List[str] = []

    if mode in (FeedMode.all, FeedMode.self_only):
        authors.append(username)

    followed_usernames: List[str] = []

    if mode in (FeedMode.all, FeedMode.following_only):
        # Obtener a quién sigue desde Neo4j
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
                    uname = record["username"]
                    if uname and uname not in followed_usernames:
                        followed_usernames.append(uname)
            driver.close()
        except Exception:
            # si Neo4j falla, simplemente no añadimos seguidos
            pass

        authors.extend([u for u in followed_usernames if u not in authors])

    if not authors:
        # no hay nadie de quien traer posts
        return []

    # Traer posts desde Mongo
    cursor = (
        posts_col.find(
            {"author_username": {"$in": authors}}
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

    # Intentar guardar en cache (best effort)
    if r is not None:
        try:
            r.setex(cache_key, 60, json.dumps([p.dict() for p in posts]))
        except Exception as e:
            print(f"⚠️ No se pudo guardar en cache: {e}")

    return posts

@app.get("/users/{username}/suggestions", response_model=List[SuggestionOut])
def get_suggestions(username: str, limit: int = 10):
    """
    Sugerencias de usuarios a seguir usando Neo4j:
    - "Amigos de tus amigos" (2-hop) que aún no sigues
    - Se ordenan por un score que combina:
        * mutual_connections (cuántos amigos en común)
        * followers_count    (cuánta gente los sigue)
        * posts_count        (actividad)
    """
    db = get_mongo_db()
    users_col = db["users"]

    user_doc = users_col.find_one({"username": username})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user_id = str(user_doc["_id"])

    suggestions: List[SuggestionOut] = []

    try:
        driver = get_neo4j_driver()
        with driver.session() as session:
            # 1) Encontrar "amigos de tus amigos" que aún no sigues
            result = session.run(
                """
                // u = usuario base
                MATCH (u:User {id: $user_id})-[:FOLLOWS]->(:User)-[:FOLLOWS]->(s:User)
                WHERE s.id <> $user_id
                  AND NOT (u)-[:FOLLOWS]->(s)
                WITH u, s, COUNT(*) AS mutual_connections

                // 2) Contar followers de s
                OPTIONAL MATCH (s)<-[:FOLLOWS]-(:User)
                WITH u, s, mutual_connections, COUNT(*) AS followers_count

                // 3) Contar posts de s
                OPTIONAL MATCH (s)-[:POSTED]->(:Post)
                WITH s,
                     mutual_connections,
                     followers_count,
                     COUNT(*) AS posts_count

                // 4) Calcular score compuesto
                RETURN
                    s.username AS username,
                    s.name AS name,
                    s.bio AS bio,
                    s.email AS email,
                    mutual_connections,
                    followers_count,
                    posts_count,
                    (mutual_connections * 3.0
                     + followers_count * 2.0
                     + posts_count * 1.0) AS score
                ORDER BY score DESC, username ASC
                LIMIT $limit
                """,
                user_id=user_id,
                limit=limit,
            )

            for record in result:
                suggestions.append(
                    SuggestionOut(
                        username=record["username"],
                        name=record.get("name"),
                        bio=record.get("bio"),
                        email=record.get("email"),
                        score=record["score"],
                        reason="Amigos de tus amigos + actividad",
                        mutual_connections=record["mutual_connections"],
                        followers_count=record["followers_count"],
                        posts_count=record["posts_count"],
                    )
                )
        driver.close()
    except Exception as e:
        # si Neo4j falla, usar fallback a MongoDB
        print(f"⚠️ Neo4j no disponible para suggestions: {e}")
        pass

    if not suggestions:
        docs = (
            users_col.find({"username": {"$ne": username}})
            .limit(limit)
        )
        for d in docs:
            suggestions.append(
                SuggestionOut(
                    username=d.get("username"),
                    name=d.get("name"),
                    bio=d.get("bio"),
                    email=d.get("email"),
                    score=1.0,
                    reason="Usuarios aleatorios (sin datos de grafo suficientes)",
                    mutual_connections=0,
                    followers_count=0,
                    posts_count=0,
                )
            )

    return suggestions

@app.post("/dm/send", response_model=DMOut)
def send_dm(dm: DMCreate):
    """
    Envía un DM:
    - Guarda en Mongo (colección `dms`)
    - Crea/actualiza relación (:User)-[:MESSAGED]->(:User) en Neo4j
    """
    db = get_mongo_db()
    users_col = db["users"]
    dms_col = db["dms"]

    # Verificar que ambos usuarios existan
    sender_doc = users_col.find_one({"username": dm.sender_username})
    if not sender_doc:
        raise HTTPException(status_code=404, detail="Sender no existe")

    receiver_doc = users_col.find_one({"username": dm.receiver_username})
    if not receiver_doc:
        raise HTTPException(status_code=404, detail="Receiver no existe")

    created_at = datetime.utcnow().isoformat()

    # Clave de conversación (ordenada alfabéticamente)
    u1, u2 = sorted([dm.sender_username, dm.receiver_username])
    conversation_key = f"{u1}::{u2}"

    doc = {
        "sender_username": dm.sender_username,
        "receiver_username": dm.receiver_username,
        "content": dm.content,
        "created_at": created_at,
        "read": False,
        "read_at": None,
        "conversation_key": conversation_key,
    }

    result = dms_col.insert_one(doc)
    dm_id = str(result.inserted_id)

    # Relación en Neo4j
    try:
        driver = get_neo4j_driver()
        with driver.session() as session:
            session.run(
                """
                MERGE (s:User {username: $sender})
                MERGE (r:User {username: $receiver})
                MERGE (s)-[rel:MESSAGED]->(r)
                ON CREATE SET rel.last_message_at = $created_at
                ON MATCH SET  rel.last_message_at = $created_at
                """,
                sender=dm.sender_username,
                receiver=dm.receiver_username,
                created_at=created_at,
            )
        driver.close()
    except Exception:
        # No tiramos error de API si Neo4j falla; el mensaje ya quedó guardado
        pass

    return DMOut(
        id=dm_id,
        sender_username=dm.sender_username,
        receiver_username=dm.receiver_username,
        content=dm.content,
        created_at=created_at,
        read=False,
        read_at=None,
    )

@app.get("/dm/{username}/{other_username}", response_model=List[DMOut])
def get_conversation(
    username: str,
    other_username: str,
    limit: int = 50,
    mark_read: bool = True,
):
    """
    Devuelve la conversación entre `username` y `other_username`.
    - Muestra mensajes en orden cronológico ascendente.
    - Opcionalmente marca como leídos los mensajes donde receiver = `username`.
    """
    db = get_mongo_db()
    users_col = db["users"]
    dms_col = db["dms"]

    # Verificar que ambos usuarios existan
    if not users_col.find_one({"username": username}):
        raise HTTPException(status_code=404, detail="Usuario no existe")

    if not users_col.find_one({"username": other_username}):
        raise HTTPException(status_code=404, detail="Otro usuario no existe")

    u1, u2 = sorted([username, other_username])
    conversation_key = f"{u1}::{u2}"

    cursor = (
        dms_col.find({"conversation_key": conversation_key})
        .sort("created_at", 1)
        .limit(limit)
    )

    docs = list(cursor)

    # Marcar como leídos los mensajes entrantes
    if mark_read and docs:
        now_iso = datetime.utcnow().isoformat()
        dms_col.update_many(
            {
                "conversation_key": conversation_key,
                "receiver_username": username,
                "read": False,
            },
            {"$set": {"read": True, "read_at": now_iso}},
        )

        # Actualizamos en memoria los que corresponda
        for d in docs:
            if d.get("receiver_username") == username and not d.get("read"):
                d["read"] = True
                d["read_at"] = now_iso

    messages: List[DMOut] = []
    for d in docs:
        messages.append(
            DMOut(
                id=str(d.get("_id")),
                sender_username=d.get("sender_username"),
                receiver_username=d.get("receiver_username"),
                content=d.get("content"),
                created_at=d.get("created_at"),
                read=d.get("read", False),
                read_at=d.get("read_at"),
            )
        )

    return messages

@app.get("/dm/conversations/{username}", response_model=List[DMConversationSummary])
def list_conversations(username: str):
    """
    Lista las conversaciones en las que participa `username`,
    con:
    - último mensaje
    - timestamp del último mensaje
    - número de mensajes no leídos
    """
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    logger.info(f"🔍 list_conversations called for username={username}")
    db = get_mongo_db()
    print(f"🔍 DEBUG: Database obtained: {db.name}", file=sys.stderr, flush=True)
    users_col = db["users"]
    dms_col = db["dms"]

    user_doc = users_col.find_one({"username": username})
    print(f"🔍 DEBUG conversations: username={username}, found={user_doc is not None}, user_doc={user_doc}", file=sys.stderr, flush=True)
    if not user_doc:
        print(f"❌ DEBUG: Usuario '{username}' no encontrado en la colección", file=sys.stderr, flush=True)
        raise HTTPException(status_code=404, detail=f"Usuario '{username}' no encontrado en MongoDB [DEBUG v2]")

    # Traemos todos los mensajes donde participa
    cursor = dms_col.find(
        {
            "$or": [
                {"sender_username": username},
                {"receiver_username": username},
            ]
        }
    )

    convs: dict[str, DMConversationSummary] = {}

    for d in cursor:
        sender = d.get("sender_username")
        receiver = d.get("receiver_username")
        content = d.get("content")
        created_at = d.get("created_at")
        read = d.get("read", False)

        other = receiver if sender == username else sender
        if other is None:
            continue

        # Si no existe, inicializamos
        if other not in convs:
            convs[other] = DMConversationSummary(
                with_username=other,
                last_message_content=content,
                last_message_at=created_at,
                unread_count=0,
            )
        else:
            # Si este mensaje es más reciente, actualizamos último
            if created_at > convs[other].last_message_at:
                convs[other].last_message_at = created_at
                convs[other].last_message_content = content

        # Contabilizar no leídos entrantes
        if receiver == username and not read:
            convs[other].unread_count += 1

    # Ordenar por último mensaje 
    summaries = list(convs.values())
    summaries.sort(key=lambda c: c.last_message_at, reverse=True)

    return summaries


# ========== ENDPOINTS DE LIKES ==========

class LikeRequest(BaseModel):
    username: str
    post_id: str

class LikeResponse(BaseModel):
    post_id: str
    likes_count: int
    user_liked: bool

@app.post("/posts/{post_id}/like", response_model=LikeResponse)
def like_post(post_id: str, username: str):
    """
    Dar like a un post
    
    Integración NoSQL:
    1. Redis: Incrementar contador + agregar a set de usuarios
    2. Neo4j: Crear relación (User)-[:LIKES]->(Post)
    3. MongoDB: Actualizar contador (eventual)
    """
    redis_client = get_redis_client()
    
    # Key para el contador de likes
    likes_count_key = f"post:{post_id}:likes:count"
    # Key para el set de usuarios que dieron like
    likes_users_key = f"post:{post_id}:likes:users"
    
    # Verificar si ya dio like
    if redis_client.sismember(likes_users_key, username):
        # Ya dio like, contar y retornar
        count = redis_client.get(likes_count_key)
        return LikeResponse(
            post_id=post_id,
            likes_count=int(count) if count else 0,
            user_liked=True
        )
    
    # Pipeline atómico
    pipe = redis_client.pipeline()
    pipe.incr(likes_count_key)  # Incrementar contador
    pipe.sadd(likes_users_key, username)  # Agregar usuario al set
    pipe.zincrby("trending:posts", 1, post_id)  # Agregar al trending
    results = pipe.execute()
    
    new_count = results[0]
    
    # Crear relación en Neo4j
    try:
        driver = get_neo4j_driver()
        with driver.session() as session:
            # Obtener user_id desde MongoDB
            db = get_mongo_db()
            users_col = db["users"]
            user_doc = users_col.find_one({"username": username})
            if user_doc:
                user_id = str(user_doc["_id"])
                
                session.run(
                    """
                    MERGE (u:User {id: $user_id})
                    MERGE (p:Post {id: $post_id})
                    MERGE (u)-[:LIKES]->(p)
                    """,
                    user_id=user_id,
                    post_id=post_id
                )
        driver.close()
    except Exception as e:
        print(f"Warning: Error creating LIKES relationship in Neo4j: {e}")
    
    return LikeResponse(
        post_id=post_id,
        likes_count=new_count,
        user_liked=True
    )

@app.delete("/posts/{post_id}/like")
def unlike_post(post_id: str, username: str):
    """
    Quitar like de un post
    """
    redis_client = get_redis_client()
    
    likes_count_key = f"post:{post_id}:likes:count"
    likes_users_key = f"post:{post_id}:likes:users"
    
    # Verificar si había dado like
    if not redis_client.sismember(likes_users_key, username):
        # No había dado like
        count = redis_client.get(likes_count_key)
        return LikeResponse(
            post_id=post_id,
            likes_count=int(count) if count else 0,
            user_liked=False
        )
    
    # Pipeline atómico
    pipe = redis_client.pipeline()
    pipe.decr(likes_count_key)
    pipe.srem(likes_users_key, username)
    pipe.zincrby("trending:posts", -1, post_id)
    results = pipe.execute()
    
    new_count = max(0, results[0])  # No permitir negativos
    
    # Eliminar relación en Neo4j
    try:
        driver = get_neo4j_driver()
        with driver.session() as session:
            db = get_mongo_db()
            users_col = db["users"]
            user_doc = users_col.find_one({"username": username})
            if user_doc:
                user_id = str(user_doc["_id"])
                
                session.run(
                    """
                    MATCH (u:User {id: $user_id})-[r:LIKES]->(p:Post {id: $post_id})
                    DELETE r
                    """,
                    user_id=user_id,
                    post_id=post_id
                )
        driver.close()
    except Exception as e:
        print(f"Warning: Error deleting LIKES relationship in Neo4j: {e}")
    
    return LikeResponse(
        post_id=post_id,
        likes_count=new_count,
        user_liked=False
    )

@app.get("/posts/{post_id}/likes", response_model=LikeResponse)
def get_post_likes(post_id: str, username: str = None):
    """
    Obtener información de likes de un post
    """
    redis_client = get_redis_client()
    
    likes_count_key = f"post:{post_id}:likes:count"
    likes_users_key = f"post:{post_id}:likes:users"
    
    count = redis_client.get(likes_count_key)
    user_liked = False
    
    if username:
        user_liked = redis_client.sismember(likes_users_key, username)
    
    return LikeResponse(
        post_id=post_id,
        likes_count=int(count) if count else 0,
        user_liked=user_liked
    )

@app.get("/trending/posts")
def get_trending_posts(limit: int = 10):
    """
    Obtener posts trending (más likeados)
    
    Redis: ZREVRANGE trending:posts 0 9 WITHSCORES
    """
    try:
        redis_client = get_redis_client()
        
        # Obtener top posts del sorted set
        trending = redis_client.zrevrange("trending:posts", 0, limit - 1, withscores=True)
        
        if not trending:
            return []
        
        # Obtener detalles de los posts desde MongoDB
        db = get_mongo_db()
        posts_col = db["posts"]
        
        result = []
        for post_id, score in trending:
            # Convertir bytes a string si es necesario
            if isinstance(post_id, bytes):
                post_id = post_id.decode('utf-8')
            
            # Buscar post en MongoDB
            try:
                post_doc = posts_col.find_one({"_id": ObjectId(post_id)})
                if post_doc:
                    result.append({
                        "id": str(post_doc["_id"]),
                        "author_username": post_doc.get("author_username"),
                        "content": post_doc.get("content"),
                        "tags": post_doc.get("tags", []),
                        "created_at": post_doc.get("created_at"),
                        "likes_count": int(score)
                    })
            except Exception as e:
                print(f"Error getting post {post_id}: {e}")
                continue
        
        return result
    except Exception as e:
        print(f"⚠️ Redis not available for trending: {e}")
        # Fallback: retornar lista vacía cuando Redis no está disponible
        return []

