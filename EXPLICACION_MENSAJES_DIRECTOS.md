# Sistema de Mensajes Directos - Explicación Completa

## ÍNDICE

1. Arquitectura de Mensajes
2. Almacenamiento en MongoDB
3. Relaciones en Neo4j
4. Flujo de Envío de Mensaje
5. Flujo de Lectura de Conversación
6. Sistema de No Leídos
7. Lista de Conversaciones
8. Demostración Práctica

---

## 1. ARQUITECTURA DE MENSAJES

### Bases de Datos Involucradas

```
┌─────────────────────────────────────────────────────────┐
│                   USUARIO ENVÍA DM                       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
        ┌───────────────────────────────────┐
        │  Backend FastAPI                   │
        │  /api/dm/send                      │
        └───────────┬───────────────────────┘
                    │
        ┌───────────┴────────────┐
        ↓                        ↓
┌──────────────┐         ┌──────────────┐
│   MongoDB    │         │    Neo4j     │
│              │         │              │
│ Colección:   │         │ Relación:    │
│   dms        │         │ [:MESSAGED]  │
│              │         │              │
│ Guarda:      │         │ Guarda:      │
│ - Contenido  │         │ - Último     │
│ - Timestamp  │         │   mensaje_at │
│ - Read flag  │         │ - Dirección  │
└──────────────┘         └──────────────┘
```

**Decisión de diseño:**
- **MongoDB:** Almacena los mensajes completos (datos detallados)
- **Neo4j:** Almacena solo que existe comunicación (grafo social)
- **Redis:** NO se usa para mensajes (no hay cache, son datos persistentes)

### Por qué NO se usa Redis para mensajes

**Razones:**

1. **Persistencia requerida:**
   - Mensajes no pueden perderse si Redis se reinicia
   - Son datos legales/auditables
   - MongoDB provee durabilidad

2. **No hay beneficio de cache:**
   - Conversaciones no se consultan repetidamente
   - Usuario abre una conversación → lee mensajes → cierra
   - No hay patrón de "consulta frecuente del mismo dato"

3. **Ordenamiento temporal:**
   - MongoDB maneja sort por timestamp eficientemente
   - Redis Lists podría funcionar, pero sin ventaja clara

4. **Búsqueda compleja futura:**
   - Buscar mensajes por contenido
   - Filtrar por fecha
   - MongoDB permite estas queries, Redis no

**Comparación:**

| Característica | Feeds (con Redis) | Mensajes (sin Redis) |
|---------------|-------------------|----------------------|
| Patrón de acceso | Recargas frecuentes | Una vez por sesión |
| Datos | Dinámicos (sigues a alguien) | Inmutables (ya enviado) |
| Puede perderse | Sí (se reconstruye) | NO (legal/auditoría) |
| Cache útil | Sí (80% hit rate) | No (bajo hit rate) |

---

## 2. ALMACENAMIENTO EN MONGODB

### Colección: dms

**Ubicación de creación:** `/app/backend/app/main.py` - Líneas 725-786

**Esquema del Documento:**

```javascript
{
  "_id": ObjectId("675a1b2c3d4e5f6a7b8c9d0e"),
  "sender_username": "rodrigo",
  "receiver_username": "kam",
  "content": "Hola! Cómo va tu proyecto de NoSQL?",
  "created_at": "2025-12-12T15:45:30.123456",
  "read": false,
  "read_at": null,
  "conversation_key": "kam::rodrigo"
}
```

**Campos Explicados:**

1. **_id:** ObjectId autogenerado por MongoDB
   - Único por mensaje
   - Contiene timestamp de creación implícito
   - Se puede extraer: `ObjectId("...").getTimestamp()`

2. **sender_username:** Usuario que envía
   - String, referencia a colección users
   - Indexado para queries rápidas

3. **receiver_username:** Usuario que recibe
   - String, referencia a colección users
   - Indexado para queries rápidas

4. **content:** Texto del mensaje
   - String, longitud variable
   - Puede ser muy corto ("Hola") o largo (varios párrafos)
   - No hay límite técnico, pero UI puede limitar

5. **created_at:** Timestamp de envío
   - String en formato ISO 8601
   - Ejemplo: "2025-12-12T15:45:30.123456"
   - Generado con: `datetime.utcnow().isoformat()`
   - Usado para ordenar mensajes cronológicamente

6. **read:** Booleano de lectura
   - `false` cuando se envía
   - `true` cuando receiver abre la conversación
   - Usado para contar mensajes no leídos

7. **read_at:** Timestamp de lectura
   - `null` mientras no se lea
   - Se actualiza cuando read cambia a true
   - Útil para "visto a las 3:45 PM"

8. **conversation_key:** Clave de conversación
   - **CRÍTICO:** Normaliza la conversación
   - Formato: `{username1}::{username2}` ordenado alfabéticamente
   - Ejemplos:
     - rodrigo → kam: "kam::rodrigo"
     - kam → rodrigo: "kam::rodrigo" (MISMO)
     - alice → bob: "alice::bob"
   - **Por qué ordenado alfabéticamente:**
     ```python
     # Sin ordenamiento
     rodrigo_to_kam = "rodrigo::kam"
     kam_to_rodrigo = "kam::rodrigo"
     # SON DIFERENTES → dos conversaciones separadas (MAL)

     # Con ordenamiento alfabético
     u1, u2 = sorted(["rodrigo", "kam"])
     key = f"{u1}::{u2}"  # Siempre "kam::rodrigo"
     # MISMO KEY → una sola conversación (BIEN)
     ```

### Índices Recomendados

```javascript
// Índice 1: Búsqueda por conversación (más usado)
db.dms.createIndex({ "conversation_key": 1, "created_at": 1 })

// Query:
db.dms.find({ conversation_key: "kam::rodrigo" })
       .sort({ created_at: 1 })
// Complejidad: O(log n + m) donde m = mensajes en la conversación
// Sin índice: O(n) donde n = todos los mensajes

// Índice 2: Mensajes no leídos de un usuario
db.dms.createIndex({ "receiver_username": 1, "read": 1 })

// Query:
db.dms.find({ receiver_username: "rodrigo", read: false })
// Complejidad: O(log n + m)
// Sin índice: O(n)

// Índice 3: Búsqueda por participante
db.dms.createIndex({ "sender_username": 1 })
db.dms.createIndex({ "receiver_username": 1 })
```

**Impacto de índices:**

```
100,000 mensajes en el sistema:
- Sin índice: escanear 100,000 documentos (~500ms)
- Con índice: acceder directamente a ~50 mensajes (~10ms)
Mejora: 50x
```

### Ejemplos de Documentos Reales

**Conversación entre rodrigo y kam:**

```javascript
// Mensaje 1: rodrigo → kam
{
  "_id": ObjectId("675a1b2c3d4e5f6a7b8c9d0e"),
  "sender_username": "rodrigo",
  "receiver_username": "kam",
  "content": "Hola! Cómo va tu proyecto?",
  "created_at": "2025-12-12T15:45:30.123456",
  "read": true,
  "read_at": "2025-12-12T15:50:15.654321",
  "conversation_key": "kam::rodrigo"
}

// Mensaje 2: kam → rodrigo
{
  "_id": ObjectId("675a1b2c3d4e5f6a7b8c9d0f"),
  "sender_username": "kam",
  "receiver_username": "rodrigo",
  "content": "Muy bien! Terminé la integración con Neo4j",
  "created_at": "2025-12-12T15:46:10.789012",
  "read": false,
  "read_at": null,
  "conversation_key": "kam::rodrigo"  // MISMO KEY
}

// Mensaje 3: rodrigo → kam
{
  "_id": ObjectId("675a1b2c3d4e5f6a7b8c9d10"),
  "sender_username": "rodrigo",
  "receiver_username": "kam",
  "content": "Genial! Yo estoy con Redis ahora",
  "created_at": "2025-12-12T15:47:25.345678",
  "read": false,
  "read_at": null,
  "conversation_key": "kam::rodrigo"  // MISMO KEY
}
```

**Conversación entre alice y bob:**

```javascript
{
  "_id": ObjectId("675a1b2c3d4e5f6a7b8c9d11"),
  "sender_username": "alice",
  "receiver_username": "bob",
  "content": "Nos vemos mañana?",
  "created_at": "2025-12-12T16:00:00.000000",
  "read": true,
  "read_at": "2025-12-12T16:05:30.123456",
  "conversation_key": "alice::bob"  // alice < bob alfabéticamente
}
```

---

## 3. RELACIONES EN NEO4J

### Relación: [:MESSAGED]

**Ubicación:** `/app/backend/app/main.py` - Líneas 765-780

**Estructura:**

```cypher
(rodrigo:User)-[:MESSAGED {last_message_at: "2025-12-12T15:47:25"}]->(kam:User)
```

**Propiedades de la relación:**
- `last_message_at`: Timestamp del mensaje más reciente
- Se actualiza en cada mensaje nuevo
- NO guarda el contenido del mensaje
- NO guarda si está leído

**Código de creación:**

```python
# Línea 765-780
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
```

**Explicación del código:**

1. **MERGE (s:User {username: $sender})**
   - Busca o crea nodo del sender
   - MERGE es idempotente (no duplica)

2. **MERGE (r:User {username: $receiver})**
   - Busca o crea nodo del receiver

3. **MERGE (s)-[rel:MESSAGED]->(r)**
   - Busca o crea relación MESSAGED
   - Si es primer mensaje: CREATE
   - Si ya existe: MATCH

4. **ON CREATE SET rel.last_message_at = $created_at**
   - Solo cuando se CREA la relación (primer mensaje)
   - Establece timestamp inicial

5. **ON MATCH SET rel.last_message_at = $created_at**
   - Cuando la relación YA EXISTE (mensajes subsecuentes)
   - ACTUALIZA el timestamp al más reciente

### Por qué usar Neo4j para mensajes

**NO es para almacenar mensajes completos, es para:**

1. **Análisis de red social:**
   - ¿Con quién habla más cada usuario?
   - ¿Quiénes son los usuarios más "conectados"?
   - Detectar comunidades basadas en comunicación

2. **Sugerencias:**
   - "Personas que podrías conocer" basado en mensajes
   - "Usuarios con quienes tus amigos hablan"

3. **Privacidad/Moderación:**
   - Detectar usuarios que envían muchos mensajes (spam)
   - Analizar patrones de comunicación

4. **Vista rápida de conversaciones activas:**
   ```cypher
   // ¿Con quién he hablado recientemente?
   MATCH (yo:User {username: "rodrigo"})-[m:MESSAGED]-()
   RETURN m.last_message_at
   ORDER BY m.last_message_at DESC
   LIMIT 10
   // Sin consultar MongoDB, muy rápido
   ```

### Dirección de la relación

**Pregunta:** ¿La relación es dirigida o bidireccional?

**Respuesta:** Dirigida, de sender a receiver

```cypher
// rodrigo envía a kam
(rodrigo)-[:MESSAGED]->(kam)

// kam envía a rodrigo
(kam)-[:MESSAGED]->(rodrigo)

// SON DOS RELACIONES SEPARADAS
```

**¿Por qué dos relaciones?**

Permite queries como:
```cypher
// A quién le he enviado mensajes
MATCH (yo:User {username: "rodrigo"})-[:MESSAGED]->(otros)
RETURN otros.username

// Quién me ha enviado mensajes
MATCH (otros)-[:MESSAGED]->(yo:User {username: "rodrigo"})
RETURN otros.username

// Conversaciones (bidireccional)
MATCH (yo:User {username: "rodrigo"})-[:MESSAGED]-(otros)
RETURN otros.username, COUNT(*) as messages
```

---

## 4. FLUJO DE ENVÍO DE MENSAJE

### Endpoint: POST /api/dm/send

**Ubicación:** `/app/backend/app/main.py` - Líneas 725-786

**Request:**
```json
{
  "sender_username": "rodrigo",
  "receiver_username": "kam",
  "content": "Hola! Cómo estás?"
}
```

**Código completo con explicación:**

```python
@app.post("/dm/send", response_model=DMOut)
def send_dm(dm: DMCreate):
    """
    Envía un mensaje directo
    """
    # 1. OBTENER BASES DE DATOS
    db = get_mongo_db()
    users_col = db["users"]
    dms_col = db["dms"]
    
    # 2. VALIDAR QUE USUARIOS EXISTEN
    sender_doc = users_col.find_one({"username": dm.sender_username})
    if not sender_doc:
        raise HTTPException(status_code=404, detail="Sender no existe")
    
    receiver_doc = users_col.find_one({"username": dm.receiver_username})
    if not receiver_doc:
        raise HTTPException(status_code=404, detail="Receiver no existe")
    
    # 3. GENERAR TIMESTAMP
    created_at = datetime.utcnow().isoformat()
    # Ejemplo: "2025-12-12T15:45:30.123456"
    
    # 4. CALCULAR CONVERSATION_KEY (CRÍTICO)
    # Ordenar alfabéticamente para normalizar
    u1, u2 = sorted([dm.sender_username, dm.receiver_username])
    conversation_key = f"{u1}::{u2}"
    # rodrigo y kam → "kam::rodrigo"
    # kam y rodrigo → "kam::rodrigo" (MISMO)
    
    # 5. CREAR DOCUMENTO DEL MENSAJE
    doc = {
        "sender_username": dm.sender_username,
        "receiver_username": dm.receiver_username,
        "content": dm.content,
        "created_at": created_at,
        "read": False,  # Siempre False al crear
        "read_at": None,
        "conversation_key": conversation_key,
    }
    
    # 6. INSERTAR EN MONGODB
    result = dms_col.insert_one(doc)
    dm_id = str(result.inserted_id)
    
    # 7. ACTUALIZAR NEO4J (opcional, no crítico)
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
    except Exception as e:
        # No es crítico, el mensaje ya está en MongoDB
        print(f"Error actualizando Neo4j: {e}")
    
    # 8. RETORNAR MENSAJE CREADO
    return DMOut(
        id=dm_id,
        sender_username=dm.sender_username,
        receiver_username=dm.receiver_username,
        content=dm.content,
        created_at=created_at,
        read=False,
        read_at=None,
    )
```

**Flujo visual:**

```
1. Frontend envía POST /api/dm/send
   ↓
2. Backend valida usuarios existen
   ↓
3. Backend calcula conversation_key
   ↓
4. Backend inserta en MongoDB
   ↓
5. Backend actualiza Neo4j (opcional)
   ↓
6. Backend retorna mensaje creado
   ↓
7. Frontend muestra mensaje en UI
```

**Tiempo de ejecución:**
- Validar usuarios: ~5ms (2 queries a MongoDB)
- Insertar mensaje: ~10ms (1 write a MongoDB)
- Actualizar Neo4j: ~15ms (2 MERGE + 1 relación)
- **Total: ~30ms**

---

## 5. FLUJO DE LECTURA DE CONVERSACIÓN

### Endpoint: GET /api/dm/{username}/{other_username}

**Ubicación:** `/app/backend/app/main.py` - Líneas 788-858

**Request:**
```
GET /api/dm/rodrigo/kam?limit=50&mark_read=true
```

**Parámetros:**
- `username`: Usuario que solicita (rodrigo)
- `other_username`: Usuario con quien habla (kam)
- `limit`: Máximo de mensajes a traer (default 50)
- `mark_read`: Si debe marcar como leídos (default true)

**Código completo:**

```python
@app.get("/dm/{username}/{other_username}", response_model=List[DMOut])
def get_conversation(
    username: str,
    other_username: str,
    limit: int = 50,
    mark_read: bool = True,
):
    """
    Obtiene conversación entre dos usuarios
    """
    # 1. OBTENER BASES DE DATOS
    db = get_mongo_db()
    users_col = db["users"]
    dms_col = db["dms"]
    
    # 2. VALIDAR USUARIOS
    if not users_col.find_one({"username": username}):
        raise HTTPException(status_code=404, detail="Usuario no existe")
    
    if not users_col.find_one({"username": other_username}):
        raise HTTPException(status_code=404, detail="Otro usuario no existe")
    
    # 3. CALCULAR CONVERSATION_KEY
    u1, u2 = sorted([username, other_username])
    conversation_key = f"{u1}::{u2}"
    
    # 4. CONSULTAR MENSAJES
    cursor = (
        dms_col.find({"conversation_key": conversation_key})
        .sort("created_at", 1)  # Orden ascendente (más viejos primero)
        .limit(limit)
    )
    
    # 5. CONVERTIR A LISTA
    docs = list(cursor)
    
    # 6. MARCAR COMO LEÍDOS (si mark_read=true)
    if mark_read and docs:
        now_iso = datetime.utcnow().isoformat()
        
        # Actualizar SOLO mensajes entrantes no leídos
        dms_col.update_many(
            {
                "conversation_key": conversation_key,
                "receiver_username": username,  # Que YO recibí
                "read": False,  # Que NO están leídos
            },
            {
                "$set": {
                    "read": True,
                    "read_at": now_iso
                }
            }
        )
        
        # Actualizar en memoria los documentos que obtuvimos
        for d in docs:
            if d.get("receiver_username") == username and not d.get("read"):
                d["read"] = True
                d["read_at"] = now_iso
    
    # 7. CONVERTIR A OBJETOS PYDANTIC
    messages = []
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
```

**Resultado (ejemplo):**

```json
[
  {
    "id": "675a1b2c3d4e5f6a7b8c9d0e",
    "sender_username": "rodrigo",
    "receiver_username": "kam",
    "content": "Hola! Cómo va tu proyecto?",
    "created_at": "2025-12-12T15:45:30.123456",
    "read": true,
    "read_at": "2025-12-12T15:50:15.654321"
  },
  {
    "id": "675a1b2c3d4e5f6a7b8c9d0f",
    "sender_username": "kam",
    "receiver_username": "rodrigo",
    "content": "Muy bien! Terminé la integración con Neo4j",
    "created_at": "2025-12-12T15:46:10.789012",
    "read": true,
    "read_at": "2025-12-12T16:00:00.000000"
  },
  {
    "id": "675a1b2c3d4e5f6a7b8c9d10",
    "sender_username": "rodrigo",
    "receiver_username": "kam",
    "content": "Genial! Yo estoy con Redis ahora",
    "created_at": "2025-12-12T15:47:25.345678",
    "read": true,
    "read_at": "2025-12-12T16:00:00.000000"
  }
]
```

**Orden de mensajes:**

```
Más viejo  ↑  (created_at ASC)
           |
           |  Mensaje 1: rodrigo → kam (15:45:30)
           |  Mensaje 2: kam → rodrigo (15:46:10)
           |  Mensaje 3: rodrigo → kam (15:47:25)
           |
Más nuevo  ↓
```

**Por qué orden ascendente:**
- UI de chat muestra mensajes viejos arriba, nuevos abajo
- Usuario scrollea hacia abajo para ver nuevos
- Patrón estándar de aplicaciones de mensajería

---

## 6. SISTEMA DE NO LEÍDOS

### Cómo funciona

**Estado inicial (mensaje enviado):**
```javascript
{
  "sender_username": "kam",
  "receiver_username": "rodrigo",
  "content": "Hola!",
  "read": false,     // ← No leído
  "read_at": null    // ← Sin timestamp
}
```

**Estado después de abrir conversación:**
```javascript
{
  "sender_username": "kam",
  "receiver_username": "rodrigo",
  "content": "Hola!",
  "read": true,      // ← Leído
  "read_at": "2025-12-12T16:00:00.000000"  // ← Timestamp
}
```

### Query de actualización

**Ubicación:** `/app/backend/app/main.py` - Líneas 840-853

```python
# Cuando rodrigo abre conversación con kam
now_iso = datetime.utcnow().isoformat()

dms_col.update_many(
    {
        # Filtro: Solo mensajes de esta conversación
        "conversation_key": "kam::rodrigo",
        
        # Filtro: Solo los que YO (rodrigo) recibí
        "receiver_username": "rodrigo",
        
        # Filtro: Solo los que NO están leídos
        "read": False,
    },
    {
        # Actualización
        "$set": {
            "read": True,
            "read_at": now_iso
        }
    }
)
```

**Ejemplo de ejecución:**

```javascript
// Antes (3 mensajes no leídos)
db.dms.find({conversation_key: "kam::rodrigo", receiver_username: "rodrigo", read: false})
// Resultado:
[
  {_id: 1, content: "Hola", read: false, read_at: null},
  {_id: 2, content: "Cómo estás?", read: false, read_at: null},
  {_id: 3, content: "Responde!", read: false, read_at: null}
]

// Ejecutar update_many
db.dms.update_many(
  {conversation_key: "kam::rodrigo", receiver_username: "rodrigo", read: false},
  {$set: {read: true, read_at: "2025-12-12T16:00:00"}}
)
// Resultado: {matchedCount: 3, modifiedCount: 3}

// Después (0 mensajes no leídos)
db.dms.find({conversation_key: "kam::rodrigo", receiver_username: "rodrigo", read: false})
// Resultado: []
```

### Contar mensajes no leídos

**Para un usuario específico:**

```javascript
// Cuántos mensajes no leídos tiene rodrigo
db.dms.countDocuments({
  receiver_username: "rodrigo",
  read: false
})
// Resultado: 5 (mensajes no leídos de TODAS las conversaciones)
```

**Por conversación:**

```javascript
// Cuántos mensajes no leídos tiene rodrigo de kam
db.dms.countDocuments({
  conversation_key: "kam::rodrigo",
  receiver_username: "rodrigo",
  read: false
})
// Resultado: 3 (mensajes no leídos solo de kam)
```

**Agregación por conversación:**

```javascript
db.dms.aggregate([
  // Solo mensajes de rodrigo
  {$match: {receiver_username: "rodrigo", read: false}},
  
  // Agrupar por conversation_key
  {$group: {
    _id: "$conversation_key",
    unread_count: {$sum: 1}
  }},
  
  // Ordenar por más no leídos
  {$sort: {unread_count: -1}}
])

// Resultado:
[
  {_id: "kam::rodrigo", unread_count: 5},
  {_id: "alice::rodrigo", unread_count: 2},
  {_id: "bob::rodrigo", unread_count: 1}
]
```

---

## 7. LISTA DE CONVERSACIONES

### Endpoint: GET /api/dm/conversations/{username}

**Ubicación:** `/app/backend/app/main.py` - Líneas 977-1053

**Request:**
```
GET /api/dm/conversations/rodrigo
```

**Response:**
```json
[
  {
    "with_username": "kam",
    "last_message_content": "Nos vemos mañana!",
    "last_message_at": "2025-12-12T18:30:00.000000",
    "unread_count": 3
  },
  {
    "with_username": "alice",
    "last_message_content": "Gracias por tu ayuda",
    "last_message_at": "2025-12-12T16:15:00.000000",
    "unread_count": 0
  },
  {
    "with_username": "bob",
    "last_message_content": "👍",
    "last_message_at": "2025-12-11T20:00:00.000000",
    "unread_count": 1
  }
]
```

**Código completo:**

```python
@app.get("/dm/conversations/{username}", response_model=List[DMConversationSummary])
def list_conversations(username: str):
    """
    Lista conversaciones activas de un usuario
    """
    db = get_mongo_db()
    users_col = db["users"]
    dms_col = db["dms"]
    
    # 1. VALIDAR USUARIO
    user_doc = users_col.find_one({"username": username})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # 2. OBTENER TODOS LOS MENSAJES DONDE PARTICIPA
    cursor = dms_col.find({
        "$or": [
            {"sender_username": username},
            {"receiver_username": username},
        ]
    })
    
    # 3. PROCESAR MENSAJES Y AGRUPAR POR CONVERSACIÓN
    convs = {}  # {other_username: ConversationSummary}
    
    for d in cursor:
        sender = d.get("sender_username")
        receiver = d.get("receiver_username")
        content = d.get("content")
        created_at = d.get("created_at")
        read = d.get("read", False)
        
        # Determinar "el otro" usuario
        other = receiver if sender == username else sender
        if other is None:
            continue
        
        # Si no existe, inicializar
        if other not in convs:
            convs[other] = DMConversationSummary(
                with_username=other,
                last_message_content=content,
                last_message_at=created_at,
                unread_count=0,
            )
        else:
            # Actualizar si este mensaje es más reciente
            if created_at > convs[other].last_message_at:
                convs[other].last_message_at = created_at
                convs[other].last_message_content = content
        
        # Contar no leídos (solo mensajes entrantes)
        if receiver == username and not read:
            convs[other].unread_count += 1
    
    # 4. ORDENAR POR MENSAJE MÁS RECIENTE
    summaries = list(convs.values())
    summaries.sort(key=lambda c: c.last_message_at, reverse=True)
    
    return summaries
```

**Flujo de procesamiento:**

```
Mensajes en MongoDB:
1. kam → rodrigo: "Hola" (15:00)
2. rodrigo → kam: "Hola!" (15:01)
3. alice → rodrigo: "Hey" (14:00)
4. kam → rodrigo: "Cómo estás?" (15:30) [no leído]

Procesamiento:
- Mensaje 1: other=kam, last="Hola" (15:00), unread=0
- Mensaje 2: other=kam, last="Hola!" (15:01), unread=0 (actualiza)
- Mensaje 3: other=alice, last="Hey" (14:00), unread=0
- Mensaje 4: other=kam, last="Cómo estás?" (15:30), unread=1 (actualiza)

Resultado final:
[
  {with: "kam", last: "Cómo estás?", at: 15:30, unread: 1},
  {with: "alice", last: "Hey", at: 14:00, unread: 0}
]
```

**Complejidad:**
- Sin índice: O(n) donde n = todos los mensajes
- Con índice en sender/receiver: O(m) donde m = mensajes del usuario
- Típico: usuario tiene 100 mensajes de 10,000 totales → 100x más rápido

---

## 8. DEMOSTRACIÓN PRÁCTICA

### Script Completo de Prueba

```bash
#!/bin/bash
# demo_mensajes.sh

API="http://localhost:8001/api"

echo "========================================"
echo "  DEMOSTRACIÓN: SISTEMA DE MENSAJES"
echo "========================================"
echo ""

# 1. ENVIAR MENSAJES
echo "1. Enviando mensajes..."
echo ""

echo "   a) rodrigo → kam: 'Hola!'"
curl -s -X POST "$API/dm/send" \
  -H "Content-Type: application/json" \
  -d '{
    "sender_username": "rodrigo",
    "receiver_username": "kam",
    "content": "Hola! Cómo va tu proyecto de NoSQL?"
  }' | python3 -c "import sys,json; print('   ✓ Enviado, ID:', json.load(sys.stdin)['id'])"

sleep 1

echo "   b) kam → rodrigo: 'Muy bien!'"
curl -s -X POST "$API/dm/send" \
  -H "Content-Type: application/json" \
  -d '{
    "sender_username": "kam",
    "receiver_username": "rodrigo",
    "content": "Muy bien! Terminé la integración con Neo4j"
  }' | python3 -c "import sys,json; print('   ✓ Enviado, ID:', json.load(sys.stdin)['id'])"

sleep 1

echo "   c) rodrigo → kam: 'Genial!'"
curl -s -X POST "$API/dm/send" \
  -H "Content-Type: application/json" \
  -d '{
    "sender_username": "rodrigo",
    "receiver_username": "kam",
    "content": "Genial! Yo estoy con Redis ahora"
  }' | python3 -c "import sys,json; print('   ✓ Enviado, ID:', json.load(sys.stdin)['id'])"

echo ""

# 2. VERIFICAR EN MONGODB
echo "2. Verificando mensajes en MongoDB..."
echo ""

python3 << 'PYTHON'
from pymongo import MongoClient
import json

client = MongoClient("mongodb://127.0.0.1:27017/red_k")
db = client.get_database()
dms = list(db.dms.find({"conversation_key": "kam::rodrigo"}, {"_id": 0}).sort("created_at", 1))

print(f"   Total de mensajes: {len(dms)}")
print(f"   Conversation key: {dms[0]['conversation_key'] if dms else 'N/A'}")
print("")
print("   Mensajes:")
for i, dm in enumerate(dms[-3:], 1):  # Últimos 3
    read_status = "✓ leído" if dm['read'] else "✗ no leído"
    print(f"   {i}. {dm['sender_username']} → {dm['receiver_username']}")
    print(f"      '{dm['content']}'")
    print(f"      {read_status}")
    print("")
PYTHON

# 3. LISTAR CONVERSACIONES DE RODRIGO
echo "3. Listando conversaciones de rodrigo..."
echo ""

curl -s "$API/dm/conversations/rodrigo" | python3 << 'PYTHON'
import sys, json
convs = json.load(sys.stdin)
for conv in convs:
    print(f"   Con: @{conv['with_username']}")
    print(f"   Último mensaje: '{conv['last_message_content']}'")
    print(f"   No leídos: {conv['unread_count']}")
    print("")
PYTHON

# 4. LEER CONVERSACIÓN (marca como leído)
echo "4. kam abre conversación (marca como leído)..."
echo ""

curl -s "$API/dm/kam/rodrigo?mark_read=true" | python3 << 'PYTHON'
import sys, json
messages = json.load(sys.stdin)
print(f"   Total de mensajes en conversación: {len(messages)}")
print("")
for msg in messages:
    print(f"   {msg['sender_username']} → {msg['receiver_username']}")
    print(f"   '{msg['content']}'")
    print(f"   Leído: {msg['read']}")
    print("")
PYTHON

# 5. VERIFICAR QUE SE MARCARON COMO LEÍDOS
echo "5. Verificando estado de lectura..."
echo ""

python3 << 'PYTHON'
from pymongo import MongoClient

client = MongoClient("mongodb://127.0.0.1:27017/red_k")
db = client.get_database()

unread = db.dms.count_documents({
    "conversation_key": "kam::rodrigo",
    "receiver_username": "kam",
    "read": False
})

print(f"   Mensajes no leídos de kam: {unread}")
print(f"   {'✓ Todos los mensajes fueron marcados como leídos' if unread == 0 else '✗ Aún hay mensajes sin leer'}")
PYTHON

echo ""
echo "========================================"
echo "  DEMOSTRACIÓN COMPLETA"
echo "========================================"
```

### Comandos MongoDB para Explorar

```javascript
// Conectar a MongoDB
mongosh mongodb://127.0.0.1:27017/red_k

// Ver todos los mensajes
db.dms.find().pretty()

// Ver mensajes de una conversación
db.dms.find({conversation_key: "kam::rodrigo"}).sort({created_at: 1})

// Contar mensajes por conversación
db.dms.aggregate([
  {$group: {
    _id: "$conversation_key",
    count: {$sum: 1},
    unread: {$sum: {$cond: ["$read", 0, 1]}}
  }}
])

// Ver mensajes no leídos de un usuario
db.dms.find({
  receiver_username: "rodrigo",
  read: false
}).sort({created_at: -1})

// Último mensaje de cada conversación
db.dms.aggregate([
  {$sort: {created_at: -1}},
  {$group: {
    _id: "$conversation_key",
    last_message: {$first: "$$ROOT"}
  }}
])
```

### Comandos Neo4j para Explorar

```cypher
// Ver todas las relaciones de mensajes
MATCH (u1:User)-[m:MESSAGED]->(u2:User)
RETURN u1.username, u2.username, m.last_message_at
ORDER BY m.last_message_at DESC

// Con quién habla más un usuario
MATCH (rodrigo:User {username: "rodrigo"})-[m:MESSAGED]-(otros:User)
RETURN otros.username, COUNT(*) as message_count
ORDER BY message_count DESC

// Conversaciones bidireccionales
MATCH (u1:User {username: "rodrigo"})-[m1:MESSAGED]->(u2:User),
      (u2)-[m2:MESSAGED]->(u1)
RETURN u2.username, m1.last_message_at, m2.last_message_at

// Usuarios más conectados (hubs)
MATCH (u:User)-[:MESSAGED]-()
RETURN u.username, COUNT(*) as connections
ORDER BY connections DESC
LIMIT 10
```

---

## RESUMEN PARA PRESENTACIÓN

### Puntos Clave

**1. MongoDB como almacén principal**
- Todos los mensajes completos
- Campos: sender, receiver, content, timestamps, read flags
- Índices para búsquedas eficientes

**2. conversation_key normalizado**
- Ordena usernames alfabéticamente
- "kam::rodrigo" para ambas direcciones
- Permite consultar conversación con un solo query

**3. Neo4j para el grafo social**
- Solo relación MESSAGED con timestamp
- No almacena contenido
- Útil para análisis y sugerencias

**4. Sistema de lectura eficiente**
- mark_read=true actualiza múltiples mensajes
- update_many con filtro preciso
- Timestamps de read_at para "visto a las..."

**5. Lista de conversaciones optimizada**
- Una sola query trae todos los mensajes del usuario
- Procesamiento en memoria para agrupar
- Ordenado por más reciente primero

### Texto para presentación

"El sistema de mensajes usa MongoDB como almacén principal porque los mensajes son datos persistentes críticos que no pueden perderse. Cada mensaje tiene un conversation_key que normaliza la conversación ordenando los usernames alfabéticamente, permitiendo que 'rodrigo a kam' y 'kam a rodrigo' compartan la misma clave 'kam::rodrigo'. Esto simplifica las queries: en lugar de buscar con OR donde sender=A y receiver=B o sender=B y receiver=A, simplemente buscamos por conversation_key. El sistema de lectura usa update_many que marca múltiples mensajes como leídos en una sola operación atómica cuando el usuario abre la conversación. Neo4j complementa con la relación MESSAGED que solo almacena el timestamp del último mensaje, útil para análisis de red social sin duplicar los datos completos que ya están en MongoDB. La lista de conversaciones hace una sola query para traer todos los mensajes del usuario y los procesa en memoria para agrupar por conversación y contar no leídos, lo cual es más eficiente que hacer una query separada por cada conversación."
