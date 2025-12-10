import os
from typing import Optional, List

import typer
import requests
import json

API_URL = os.getenv("API_URL", "http://127.0.0.1:8001/api")

app = typer.Typer(help="CLI para la red social Red K")


# ---------- Comandos de usuarios ----------

@app.command("create-user")
def create_user(
    username: str = typer.Argument(..., help="Nombre de usuario"),
    email: str = typer.Argument(..., help="Correo electrónico"),
    name: Optional[str] = typer.Option(None, "--name", "-n", help="Nombre visible"),
    bio: Optional[str] = typer.Option(None, "--bio", "-b", help="Biografía corta"),
):
    """
    Crea un usuario nuevo en el sistema llamando al endpoint POST /users/
    """
    payload = {
        "username": username,
        "email": email,
        "name": name,
        "bio": bio,
    }

    try:
        resp = requests.post(f"{API_URL}/users/", json=payload)
    except Exception as e:
        typer.echo(f"[ERROR] No se pudo conectar a la API: {e}")
        raise typer.Exit(code=1)

    if resp.status_code not in (200, 201):
        typer.echo(f"[ERROR] La API respondió {resp.status_code}:")
        typer.echo(resp.text)
        raise typer.Exit(code=1)

    data = resp.json()
    typer.echo(" Usuario creado:")
    typer.echo(f"  id       : {data.get('id')}")
    typer.echo(f"  username : {data.get('username')}")
    typer.echo(f"  email    : {data.get('email')}")
    typer.echo(f"  name     : {data.get('name')}")
    typer.echo(f"  bio      : {data.get('bio')}")


@app.command("list-users")
def list_users():
    """
    Lista usuarios existentes (GET /users/)
    """
    try:
        resp = requests.get(f"{API_URL}/users/")
    except Exception as e:
        typer.echo(f"[ERROR] No se pudo conectar a la API: {e}")
        raise typer.Exit(code=1)

    if resp.status_code != 200:
        typer.echo(f"[ERROR] La API respondió {resp.status_code}:")
        typer.echo(resp.text)
        raise typer.Exit(code=1)

    users = resp.json()
    if not users:
        typer.echo("No hay usuarios registrados.")
        raise typer.Exit()

    typer.echo("👥 Usuarios:")
    for u in users:
        typer.echo("-" * 40)
        typer.echo(f"id       : {u.get('id')}")
        typer.echo(f"username : {u.get('username')}")
        typer.echo(f"email    : {u.get('email')}")
        typer.echo(f"name     : {u.get('name')}")
        typer.echo(f"bio      : {u.get('bio')}")

    typer.echo("-" * 40)
    typer.echo(f"Total: {len(users)} usuarios")


@app.command("create-post")
def create_post(
    author_username: str = typer.Argument(..., help="Username del autor"),
    content: str = typer.Argument(..., help="Contenido del post"),
    tags: List[str] = typer.Option(None, "--tag", "-t", help="Etiquetas opcionales"),
):
    """
    Crea un post llamando a POST /posts/
    """
    payload = {
        "author_username": author_username,
        "content": content,
        "tags": tags,
    }

    try:
        resp = requests.post(f"{API_URL}/posts/", json=payload)
    except Exception as e:
        typer.echo(f"[ERROR] No se pudo conectar a la API: {e}")
        raise typer.Exit(code=1)

    if resp.status_code not in (200, 201):
        typer.echo(f"[ERROR] La API respondió {resp.status_code}:")
        typer.echo(resp.text)
        raise typer.Exit(code=1)

    data = resp.json()
    typer.echo("Post creado:")
    typer.echo(f"  id       : {data.get('id')}")
    typer.echo(f"  author   : {data.get('author_username')}")
    typer.echo(f"  content  : {data.get('content')}")
    typer.echo(f"  tags     : {data.get('tags')}")
    typer.echo(f"  created  : {data.get('created_at')}")



@app.command("follow-user")
def follow_user(
    username: str = typer.Argument(..., help="Usuario que sigue"),
    target_username: str = typer.Argument(..., help="Usuario a seguir"),
):
    """
    Hace que `username` siga a `target_username` usando POST /users/{username}/follow/{target_username}
    """
    try:
        resp = requests.post(f"{API_URL}/users/{username}/follow/{target_username}")
    except Exception as e:
        typer.echo(f"[ERROR] No se pudo conectar a la API: {e}")
        raise typer.Exit(code=1)

    if resp.status_code != 200:
        typer.echo(f"[ERROR] La API respondió {resp.status_code}:")
        typer.echo(resp.text)
        raise typer.Exit(code=1)

    data = resp.json()
    typer.echo(f"V {data.get('message')}")

@app.command("list-following")
def list_following(
    username: str = typer.Argument(..., help="Usuario del que se quiere ver a quién sigue"),
):
    """
    Lista a quién sigue un usuario usando GET /users/{username}/following
    """
    try:
        resp = requests.get(f"{API_URL}/users/{username}/following")
    except Exception as e:
        typer.echo(f"[ERROR] No se pudo conectar a la API: {e}")
        raise typer.Exit(code=1)

    if resp.status_code != 200:
        typer.echo(f"[ERROR] La API respondió {resp.status_code}:")
        typer.echo(resp.text)
        raise typer.Exit(code=1)

    people = resp.json()
    if not people:
        typer.echo(f"{username} no sigue a nadie todavía.")
        raise typer.Exit()

    typer.echo(f"👥 {username} sigue a:")
    for p in people:
        typer.echo("-" * 40)
        typer.echo(f"username : {p.get('username')}")
        typer.echo(f"name     : {p.get('name')}")
        typer.echo(f"email    : {p.get('email')}")
        typer.echo(f"bio      : {p.get('bio')}")
    typer.echo("-" * 40)
    typer.echo(f"Total: {len(people)} usuarios seguidos")

@app.command("send-dm")
def send_dm(
    sender_username: str = typer.Argument(..., help="Usuario que envía el mensaje"),
    receiver_username: str = typer.Argument(..., help="Usuario que recibe el mensaje"),
    content: str = typer.Argument(..., help="Contenido del mensaje"),
):
    """
    Envía un DM usando POST /dm/send
    """
    payload = {
        "sender_username": sender_username,
        "receiver_username": receiver_username,
        "content": content,
    }

    try:
        resp = requests.post(f"{API_URL}/dm/send", json=payload)
    except Exception as e:
        typer.echo(f"[ERROR] No se pudo conectar a la API: {e}")
        raise typer.Exit(code=1)

    if resp.status_code not in (200, 201):
        typer.echo(f"[ERROR] La API respondió {resp.status_code}:")
        typer.echo(resp.text)
        raise typer.Exit(code=1)

    data = resp.json()
    typer.echo("📨 DM enviado:")
    typer.echo(f"  id       : {data.get('id')}")
    typer.echo(f"  from     : {data.get('sender_username')}")
    typer.echo(f"  to       : {data.get('receiver_username')}")
    typer.echo(f"  at       : {data.get('created_at')}")
    typer.echo(f"  content  : {data.get('content')}")

@app.command("read-dm")
def read_dm(
    username: str = typer.Argument(..., help="Usuario que lee la conversación"),
    other_username: str = typer.Argument(..., help="Otro usuario de la conversación"),
    limit: int = typer.Option(50, "--limit", "-l", help="Número máximo de mensajes"),
):
    """
    Lee la conversación entre `username` y `other_username`
    usando GET /dm/{username}/{other_username}
    """
    params = {"limit": limit, "mark_read": "true"}

    try:
        resp = requests.get(
            f"{API_URL}/dm/{username}/{other_username}",
            params=params,
        )
    except Exception as e:
        typer.echo(f"[ERROR] No se pudo conectar a la API: {e}")
        raise typer.Exit(code=1)

    if resp.status_code != 200:
        typer.echo(f"[ERROR] La API respondió {resp.status_code}:")
        typer.echo(resp.text)
        raise typer.Exit(code=1)

    messages = resp.json()
    if not messages:
        typer.echo(f"No hay mensajes entre {username} y {other_username}.")
        raise typer.Exit()

    typer.echo(f"💬 Conversación {username} ↔ {other_username}:")
    for m in messages:
        sender = m.get("sender_username")
        receiver = m.get("receiver_username")
        created_at = m.get("created_at")
        content = m.get("content")
        read = m.get("read")
        read_at = m.get("read_at")

        flag = ""
        if receiver == username and not read:
            flag = " [UNREAD]"
        elif receiver == username and read:
            flag = " [read]"

        typer.echo("-" * 60)
        typer.echo(f"{created_at}  {sender} → {receiver}{flag}")
        typer.echo(f"  {content}")
        if read_at:
            typer.echo(f"  read_at: {read_at}")
    typer.echo("-" * 60)
    typer.echo(f"Total: {len(messages)} mensajes")

@app.command("list-dm-conversations")
def list_dm_conversations(
    username: str = typer.Argument(..., help="Usuario del que se listan conversaciones"),
):
    """
    Lista conversaciones (chats) de `username` usando GET /dm/conversations/{username}
    """
    try:
        resp = requests.get(f"{API_URL}/dm/conversations/{username}")
    except Exception as e:
        typer.echo(f"[ERROR] No se pudo conectar a la API: {e}")
        raise typer.Exit(code=1)

    if resp.status_code != 200:
        typer.echo(f"[ERROR] La API respondió {resp.status_code}:")
        typer.echo(resp.text)
        raise typer.Exit(code=1)

    convs = resp.json()
    if not convs:
        typer.echo(f"{username} no tiene conversaciones.")
        raise typer.Exit()

    typer.echo(f"📁 Conversaciones de {username}:")
    for c in convs:
        typer.echo("-" * 60)
        typer.echo(f"with          : {c.get('with_username')}")
        typer.echo(f"last_at       : {c.get('last_message_at')}")
        typer.echo(f"last_message  : {c.get('last_message_content')}")
        typer.echo(f"unread_count  : {c.get('unread_count')}")
    typer.echo("-" * 60)
    typer.echo(f"Total: {len(convs)} conversaciones")

@app.command("suggest-users")
@app.command("get-suggestions")
def get_suggestions(
    username: str = typer.Argument(..., help="Usuario para el que se quieren sugerencias"),
    limit: int = typer.Option(10, "--limit", "-l", help="Número máximo de sugerencias"),
):
    """
    Obtiene sugerencias de usuarios a seguir usando GET /users/{username}/suggestions
    """
    params = {"limit": limit}
    try:
        resp = requests.get(f"{API_URL}/users/{username}/suggestions", params=params)
    except Exception as e:
        typer.echo(f"[ERROR] No se pudo conectar a la API: {e}")
        raise typer.Exit(code=1)

    if resp.status_code != 200:
        typer.echo(f"[ERROR] La API respondió {resp.status_code}:")
        typer.echo(resp.text)
        raise typer.Exit(code=1)

    sugs = resp.json()
    if not sugs:
        typer.echo(f"No hay sugerencias para {username}.")
        raise typer.Exit()

    typer.echo(f"✨ Sugerencias para {username}:")
    for s in sugs:
        typer.echo("-" * 60)
        typer.echo(f"username           : {s.get('username')}")
        typer.echo(f"name               : {s.get('name')}")
        typer.echo(f"email              : {s.get('email')}")
        typer.echo(f"bio                : {s.get('bio')}")
        typer.echo(f"score              : {s.get('score')}")
        typer.echo(f"mutual_connections : {s.get('mutual_connections')}")
        typer.echo(f"followers_count    : {s.get('followers_count')}")
        typer.echo(f"posts_count        : {s.get('posts_count')}")
        if s.get("reason"):
            typer.echo(f"reason             : {s.get('reason')}")
    typer.echo("-" * 60)
    typer.echo(f"Total: {len(sugs)} sugerencias")


@app.command("get-feed")
def get_feed(
    username: str = typer.Argument(..., help="Usuario del que se quiere ver el feed"),
    limit: int = typer.Option(20, "--limit", "-l", help="Número máximo de posts"),
    mode: str = typer.Option(
        "all",
        "--mode",
        "-m",
        help="Modo del feed: all, self, following",
    ),
):
    """
    Obtiene el feed de un usuario llamando a GET /users/{username}/feed
    """
    params = {"limit": limit, "mode": mode}
    try:
        resp = requests.get(f"{API_URL}/users/{username}/feed", params=params)
    except Exception as e:
        typer.echo(f"[ERROR] No se pudo conectar a la API: {e}")
        raise typer.Exit(code=1)

    if resp.status_code != 200:
        typer.echo(f"[ERROR] La API respondió {resp.status_code}:")
        typer.echo(resp.text)
        raise typer.Exit(code=1)

    posts = resp.json()
    if not posts:
        typer.echo(f"No hay posts en el feed de {username} (mode={mode}).")
        raise typer.Exit()

    typer.echo(f"Feed de {username} (mode={mode}):")
    for p in posts:
        typer.echo("-" * 60)
        typer.echo(f"id       : {p.get('id')}")
        typer.echo(f"author   : {p.get('author_username')}")
        typer.echo(f"created  : {p.get('created_at')}")
        typer.echo(f"content  : {p.get('content')}")
        tags = p.get("tags") or []
        if tags:
            typer.echo(f"tags     : {', '.join(tags)}")
    typer.echo("-" * 60)
    typer.echo(f"Total: {len(posts)} posts")


if __name__ == "__main__":
    app()
