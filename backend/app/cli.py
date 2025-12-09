import os
from typing import Optional

import typer
import requests

# Puedes cambiar la URL con la variable de entorno API_URL si quieres
API_URL = os.getenv("API_URL", "http://redk_api:8000")

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

if __name__ == "__main__":
    app()
