# backend/server.py

"""
Punto de entrada del servidor.

Envuelve la app principal (app.main:app) y la monta bajo el prefijo /api,
de modo que los endpoints queden como:

    /api/health
    /api/users/
    /api/posts/
    etc.
"""

from fastapi import FastAPI
from app.main import app as api_app  # esta es la app que definiste en main.py

app = FastAPI(title="Red K - API Wrapper")

# Montar la app original en /api
app.mount("/api", api_app)


# Opcional: endpoint raíz para comprobar que el wrapper está vivo
@app.get("/")
def root():
    return {
        "message": "Red K API wrapper running. La API real está bajo /api"
    }


# Opcional: seguir exponiendo /health en la raíz (además de /api/health)
# Reutilizamos la función health_check que ya definiste en main.py
from app.main import health_check as inner_health_check

@app.get("/health")
def health():
    """
    Proxy al /health original de app.main (que ahora vive en /api/health).
    """
    return inner_health_check()
