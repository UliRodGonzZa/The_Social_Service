# 🖥️ Red K - Guía de CLI

## 📋 Resumen

Red K incluye una interfaz de línea de comandos (CLI) completa para interactuar con la API sin necesidad de usar el frontend web o herramientas como curl/Postman.

**Ubicación**: `/app/backend/app/cli.py`

**Tecnología**: [Typer](https://typer.tiangolo.com/) - Framework moderno de CLI para Python

---

## 🚀 Uso Básico

Todos los comandos se ejecutan desde la raíz del proyecto backend con:

```bash
python -m app.cli <comando> [argumentos] [opciones]
```

Para ver ayuda general:
```bash
python -m app.cli --help
```

Para ver ayuda de un comando específico:
```bash
python -m app.cli <comando> --help
```

---

## 👥 Comandos de Usuarios

### 1. Crear Usuario
```bash
python -m app.cli create-user <username> <email> --name "<nombre>" --bio "<biografía>"
```

**Argumentos requeridos**:
- `username`: Nombre de usuario único
- `email`: Correo electrónico

**Opciones**:
- `--name` / `-n`: Nombre visible (opcional)
- `--bio` / `-b`: Biografía corta (opcional)

**Ejemplo**:
```bash
python -m app.cli create-user alice alice@example.com --name "Alice Smith" --bio "Developer | Tech enthusiast"
```

**Salida**:
```
✅ Usuario creado:
  id       : 675abc123def...
  username : alice
  email    : alice@example.com
  name     : Alice Smith
  bio      : Developer | Tech enthusiast
```

---

### 2. Listar Usuarios
```bash
python -m app.cli list-users
```

**Ejemplo de salida**:
```
👥 Usuarios:
----------------------------------------
id       : 675abc123def...
username : alice
email    : alice@example.com
name     : Alice Smith
bio      : Developer | Tech enthusiast
----------------------------------------
id       : 675xyz789ghi...
username : bob
email    : bob@example.com
name     : Bob Jones
bio      : Designer | UI/UX
----------------------------------------
Total: 2 usuarios
```

---

### 3. Seguir a Otro Usuario
```bash
python -m app.cli follow-user <username> <target_username>
```

**Argumentos**:
- `username`: Usuario que sigue
- `target_username`: Usuario a seguir

**Ejemplo**:
```bash
python -m app.cli follow-user alice bob
```

**Salida**:
```
✅ alice ahora sigue a bob
```

**Nota**: Crea la relación `(alice)-[:FOLLOWS]->(bob)` en Neo4j.

---

### 4. Listar A Quién Sigue un Usuario
```bash
python -m app.cli list-following <username>
```

**Ejemplo**:
```bash
python -m app.cli list-following alice
```

**Salida**:
```
👥 alice sigue a:
----------------------------------------
username : bob
name     : Bob Jones
email    : bob@example.com
bio      : Designer | UI/UX
----------------------------------------
Total: 1 usuarios seguidos
```

---

### 5. Ver Sugerencias de Usuarios
```bash
python -m app.cli suggest-users <username> --limit <número>
```

**Alias**: También puedes usar `get-suggestions`

**Opciones**:
- `--limit` / `-l`: Número máximo de sugerencias (default: 10)

**Ejemplo**:
```bash
python -m app.cli suggest-users alice --limit 5
```

**Salida**:
```
✨ Sugerencias para alice:
----------------------------------------
username           : charlie
name               : Charlie Davis
email              : charlie@example.com
bio                : Backend Engineer
score              : 15.0
mutual_connections : 3
followers_count    : 5
posts_count        : 8
reason             : Amigos de tus amigos + actividad
----------------------------------------
Total: 5 sugerencias
```

**Algoritmo**: 
- "Amigos de tus amigos" (2-hop en Neo4j)
- Score = `mutual_connections * 3 + followers * 2 + posts * 1`
- Ordenado por score descendente

---

## 📝 Comandos de Posts

### 6. Crear Post
```bash
python -m app.cli create-post <author_username> "<contenido>" --tag "<tag1>" --tag "<tag2>"
```

**Argumentos**:
- `author_username`: Username del autor
- `content`: Contenido del post

**Opciones**:
- `--tag` / `-t`: Etiqueta (puede repetirse múltiples veces)

**Ejemplo**:
```bash
python -m app.cli create-post alice "¡Hola mundo desde la CLI!" --tag "intro" --tag "tech"
```

**Salida**:
```
✅ Post creado:
  id       : 676abc123def...
  author   : alice
  content  : ¡Hola mundo desde la CLI!
  tags     : ['intro', 'tech']
  created  : 2024-12-10T12:00:00.000Z
```

**Efectos**:
1. Guarda post en MongoDB
2. Crea nodo `(:Post)` y relación `(alice)-[:POSTED]->(post)` en Neo4j
3. Invalida caché del feed de alice en Redis

---

### 7. Ver Feed de Usuario
```bash
python -m app.cli get-feed <username> --limit <número> --mode <modo>
```

**Opciones**:
- `--limit` / `-l`: Número máximo de posts (default: 20)
- `--mode` / `-m`: Modo del feed:
  - `all`: Posts del usuario + de quienes sigue (default)
  - `self`: Solo posts del usuario
  - `following`: Solo posts de quienes sigue

**Ejemplo**:
```bash
python -m app.cli get-feed alice --limit 10 --mode all
```

**Salida**:
```
📰 Feed de alice (mode=all):
----------------------------------------
id       : 676abc123def...
author   : alice
created  : 2024-12-10T12:00:00.000Z
content  : ¡Hola mundo desde la CLI!
tags     : intro, tech
----------------------------------------
id       : 676xyz789ghi...
author   : bob
created  : 2024-12-10T11:30:00.000Z
content  : Mi primer post en Red K
tags     : intro
----------------------------------------
Total: 2 posts
```

**Performance**:
- Primera llamada: ~50-100ms (consulta Neo4j + MongoDB)
- Llamadas subsecuentes (dentro de 60s): ~5ms (caché Redis)

---

## 💬 Comandos de Mensajes Directos (DMs)

### 8. Enviar DM
```bash
python -m app.cli send-dm <sender_username> <receiver_username> "<contenido>"
```

**Argumentos**:
- `sender_username`: Usuario que envía
- `receiver_username`: Usuario que recibe
- `content`: Contenido del mensaje

**Ejemplo**:
```bash
python -m app.cli send-dm alice bob "Hey Bob, ¿cómo estás?"
```

**Salida**:
```
📨 DM enviado:
  id       : 677abc123def...
  from     : alice
  to       : bob
  at       : 2024-12-10T12:05:00.000Z
  content  : Hey Bob, ¿cómo estás?
```

**Efectos**:
1. Guarda mensaje en MongoDB
2. Crea/actualiza relación `(alice)-[:MESSAGED]->(bob)` en Neo4j

---

### 9. Leer Conversación
```bash
python -m app.cli read-dm <username> <other_username> --limit <número>
```

**Opciones**:
- `--limit` / `-l`: Número máximo de mensajes (default: 50)

**Ejemplo**:
```bash
python -m app.cli read-dm alice bob --limit 20
```

**Salida**:
```
💬 Conversación alice ↔ bob:
------------------------------------------------------------
2024-12-10T12:05:00.000Z  alice → bob
  Hey Bob, ¿cómo estás?
------------------------------------------------------------
2024-12-10T12:07:00.000Z  bob → alice [read]
  ¡Hola Alice! Todo bien, ¿y tú?
  read_at: 2024-12-10T12:08:00.000Z
------------------------------------------------------------
2024-12-10T12:10:00.000Z  alice → bob
  Muy bien también, gracias!
------------------------------------------------------------
Total: 3 mensajes
```

**Efectos**:
- Marca automáticamente como leídos los mensajes entrantes de `username`
- Flags: `[UNREAD]`, `[read]`

---

### 10. Listar Conversaciones
```bash
python -m app.cli list-dm-conversations <username>
```

**Ejemplo**:
```bash
python -m app.cli list-dm-conversations alice
```

**Salida**:
```
📁 Conversaciones de alice:
------------------------------------------------------------
with          : bob
last_at       : 2024-12-10T12:10:00.000Z
last_message  : Muy bien también, gracias!
unread_count  : 0
------------------------------------------------------------
with          : charlie
last_at       : 2024-12-10T11:45:00.000Z
last_message  : ¿Viste el último post?
unread_count  : 2
------------------------------------------------------------
Total: 2 conversaciones
```

---

## 🔄 Flujos de Trabajo Comunes

### Flujo 1: Crear Red Social de Prueba

```bash
# 1. Crear usuarios
python -m app.cli create-user alice alice@example.com --name "Alice Smith" --bio "Developer"
python -m app.cli create-user bob bob@example.com --name "Bob Jones" --bio "Designer"
python -m app.cli create-user charlie charlie@example.com --name "Charlie Davis" --bio "Engineer"

# 2. Crear relaciones
python -m app.cli follow-user alice bob
python -m app.cli follow-user alice charlie
python -m app.cli follow-user bob charlie

# 3. Crear posts
python -m app.cli create-post alice "Mi primer post!" --tag "intro"
python -m app.cli create-post bob "Hello from Bob" --tag "intro"
python -m app.cli create-post charlie "Backend rocks!" --tag "tech" --tag "backend"

# 4. Ver feed
python -m app.cli get-feed alice --limit 10
```

---

### Flujo 2: Conversación Entre Usuarios

```bash
# 1. Alice envía mensaje a Bob
python -m app.cli send-dm alice bob "Hey Bob, ¿tienes un minuto?"

# 2. Bob lee la conversación (marca como leído)
python -m app.cli read-dm bob alice

# 3. Bob responde
python -m app.cli send-dm bob alice "Claro Alice, dime"

# 4. Ver lista de conversaciones
python -m app.cli list-dm-conversations alice
```

---

### Flujo 3: Descubrir Usuarios

```bash
# 1. Ver a quién sigue alice
python -m app.cli list-following alice

# 2. Ver sugerencias para alice
python -m app.cli suggest-users alice --limit 5

# 3. Seguir un usuario sugerido
python -m app.cli follow-user alice dave

# 4. Ver feed actualizado
python -m app.cli get-feed alice --mode all
```

---

## 🔧 Configuración

### Variable de Entorno API_URL

Por defecto, el CLI apunta a: `http://127.0.0.1:8001/api`

Para cambiar la URL del API:

```bash
export API_URL="https://mi-api.com/api"
python -m app.cli list-users
```

O en una sola línea:
```bash
API_URL="https://mi-api.com/api" python -m app.cli list-users
```

---

## 📊 Resumen de Comandos

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `create-user` | Crear usuario | `create-user alice alice@example.com --name "Alice"` |
| `list-users` | Listar usuarios | `list-users` |
| `follow-user` | Seguir usuario | `follow-user alice bob` |
| `list-following` | Ver seguidos | `list-following alice` |
| `suggest-users` | Sugerencias | `suggest-users alice --limit 5` |
| `create-post` | Crear post | `create-post alice "Hola!" --tag tech` |
| `get-feed` | Ver feed | `get-feed alice --limit 10 --mode all` |
| `send-dm` | Enviar DM | `send-dm alice bob "Hola!"` |
| `read-dm` | Leer conversación | `read-dm alice bob --limit 20` |
| `list-dm-conversations` | Listar conversaciones | `list-dm-conversations alice` |

---

## 🐛 Solución de Problemas

### Error: "No se pudo conectar a la API"

**Problema**: El backend no está corriendo o la URL es incorrecta.

**Solución**:
```bash
# Verificar que el backend esté corriendo
sudo supervisorctl status backend

# Si no está corriendo, iniciarlo
sudo supervisorctl start backend

# Verificar que responde
curl http://127.0.0.1:8001/health
```

---

### Error: "La API respondió 404"

**Problema**: El endpoint no existe o la URL no incluye el prefijo `/api`.

**Solución**:
- Verificar que `API_URL` termine en `/api`
- El valor por defecto es: `http://127.0.0.1:8001/api`

---

### Error: "Usuario no encontrado"

**Problema**: El username no existe en MongoDB.

**Solución**:
```bash
# Verificar usuarios existentes
python -m app.cli list-users

# Crear el usuario si no existe
python -m app.cli create-user <username> <email>
```

---

### Error: "Username ya existe"

**Problema**: Intentando crear un usuario con un username duplicado.

**Solución**:
- Usar un username diferente
- Los usernames son únicos en MongoDB

---

## 💡 Tips y Trucos

### 1. Crear Datos de Prueba Rápidamente
```bash
# Script para popular la base de datos
for i in {1..10}; do
  python -m app.cli create-user "user$i" "user$i@example.com" --name "User $i" --bio "Test user $i"
done
```

### 2. Ver Posts en Tiempo Real
```bash
# Terminal 1: Crear posts
python -m app.cli create-post alice "Post $(date)"

# Terminal 2: Ver feed (actualizar cada 5 segundos)
watch -n 5 'python -m app.cli get-feed alice --limit 5'
```

### 3. Exportar Feed a JSON
```bash
python -m app.cli get-feed alice --limit 100 > feed.txt
```

### 4. Crear Grafo de Seguidos
```bash
# Seguir en cadena: alice → bob → charlie → dave
python -m app.cli follow-user alice bob
python -m app.cli follow-user bob charlie
python -m app.cli follow-user charlie dave

# Ver sugerencias (debería sugerir charlie y dave para alice)
python -m app.cli suggest-users alice
```

---

## 🚀 Próximas Funcionalidades CLI

Funcionalidades que podrían añadirse en el futuro:

- [ ] `like-post` - Dar like a un post
- [ ] `unlike-post` - Quitar like de un post
- [ ] `trending-posts` - Ver posts trending
- [ ] `delete-user` - Eliminar usuario
- [ ] `delete-post` - Eliminar post
- [ ] `unfollow-user` - Dejar de seguir usuario
- [ ] `search-users` - Buscar usuarios por username/name
- [ ] `search-posts` - Buscar posts por contenido/tags
- [ ] `export-data` - Exportar datos de usuario (GDPR)

---

**Última actualización**: 2024-12-10
**Versión CLI**: 1.0
**Framework**: Typer 0.9+
