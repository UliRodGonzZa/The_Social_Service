# 📊 Sprint 2: Messaging Metrics - COMPLETADO

## 🎯 Objetivo

Implementar métricas app-level de la aplicación de mensajería usando Redis Cluster para demostrar casos de uso reales de NoSQL.

---

## ✅ Métricas Implementadas

### 1. **📈 Tasa de Mensajes (Message Rate)**

**Métricas:**
- Mensajes por minuto
- Mensajes por segundo  
- Total de mensajes hoy
- Conversaciones activas

**Keys de Redis:**
```redis
msg:rate:{YYYYMMDDHHMM}    # Contador de mensajes del minuto
msg:total:{YYYYMMDD}        # Total de mensajes del día
active:conversations        # Set de conversaciones activas
```

**Comandos:**
```redis
# Incrementar contador al enviar mensaje
INCR msg:rate:202512120715
EXPIRE msg:rate:202512120715 60

# Total del día
INCR msg:total:20251212
EXPIRE msg:total:20251212 86400

# Conversación activa
SADD active:conversations "chat:abc123"
EXPIRE active:conversations 600
```

### 2. **👥 Presencia y Typing (Presence & Typing)**

**Métricas:**
- Total de usuarios online
- Total de usuarios escribiendo
- Lista de usuarios online
- Usuarios escribiendo por chat

**Keys de Redis:**
```redis
presence:{userId}              # TTL 30 segundos
typing:{chatId}:{userId}       # TTL 3 segundos
```

**Comandos:**
```redis
# Usuario se pone online
SETEX presence:rodrigo 30 "online"

# Usuario está escribiendo
SETEX typing:chat123:rodrigo 3 "1"

# Listar usuarios online (por nodo)
SCAN 0 MATCH presence:* COUNT 100

# Listar typing
SCAN 0 MATCH typing:* COUNT 100
```

**Refresh de Presencia:**
- Cliente envía heartbeat cada 15 segundos
- Key con TTL 30s se renueva automáticamente
- Si el cliente deja de enviar, key expira → usuario offline

**Typing Indicator:**
- Cliente envía "typing" cada 1-2 segundos mientras escribe
- Key con TTL 3s expira si deja de escribir
- Otros usuarios ven el indicador en tiempo real

### 3. **📬 Mensajes No Leídos (Unread Messages)**

**Métricas:**
- Total de mensajes no leídos
- Usuarios con mensajes no leídos
- Top conversaciones con más no leídos
- Promedio de no leídos por usuario

**Keys de Redis:**
```redis
unread:{userId}    # HASH: {chatId: count}
```

**Comandos:**
```redis
# Incrementar no leídos al recibir mensaje
HINCRBY unread:kam chat:abc123 1

# Obtener todos los no leídos de un usuario
HGETALL unread:kam
# Retorna: {"chat:abc123": "5", "chat:xyz789": "2"}

# Marcar como leído (leer una conversación)
HDEL unread:kam chat:abc123

# Contar conversaciones con no leídos
HLEN unread:kam
```

---

## 🔧 Implementación

### Backend (FastAPI)

**Endpoint:**
```
GET /api/observability/messaging/metrics
```

**Respuesta:**
```json
{
  "mode": "production",
  "timestamp": "2025-12-12T07:00:00",
  "rate": {
    "messages_per_minute": 45,
    "messages_per_second": 0.75,
    "total_messages_today": 3250,
    "active_conversations": 28
  },
  "presence": {
    "total_online": 15,
    "total_typing": 3,
    "users_online": ["rodrigo", "kam", "alex"],
    "typing_in_chats": {
      "chat:abc123": ["rodrigo"]
    }
  },
  "unread": {
    "total_unread_messages": 47,
    "users_with_unread": 12,
    "top_conversations": [
      {"chat_id": "chat:abc123", "unread_count": 15}
    ],
    "average_unread_per_user": 3.92
  }
}
```

**Funciones Implementadas:**
- `get_messaging_rate_metrics_production()` - Lee contadores de Redis
- `get_presence_metrics_production()` - Escanea keys de presencia/typing
- `get_unread_metrics_production()` - Escanea HASHes de unread
- `get_mock_messaging_metrics()` - Datos simulados para demo

### Frontend (React)

**Componente:**
- `MessagingMetricsTab.jsx`

**Visualización:**
1. **Cards de Rate Metrics**
   - 4 cards con métricas principales
   - Actualización en tiempo real

2. **Sección de Presencia**
   - Lista de usuarios online (badges verdes)
   - Lista de usuarios escribiendo por chat

3. **Sección de Unread**
   - 3 cards de resumen
   - Top 10 conversaciones con más no leídos
   - Ranking con medallas 🥇🥈🥉

4. **Referencia de Comandos Redis**
   - Muestra los comandos exactos usados
   - Útil para la presentación

---

## 🧪 Cómo Probar

### Modo MOCK (Emergent o sin Redis Cluster)

1. **Verificar modo:**
   ```bash
   curl http://localhost:8000/api/observability/mode
   # Debe retornar: {"mode": "mock"}
   ```

2. **Obtener métricas:**
   ```bash
   curl http://localhost:8000/api/observability/messaging/metrics
   ```

3. **Ver en navegador:**
   - Ir a http://localhost:3000/observability
   - Tab "💬 Messaging Metrics"
   - Verás datos simulados

### Modo PRODUCTION (Con Redis Cluster)

1. **Configurar modo:**
   ```bash
   # backend/.env
   OBSERVABILITY_MODE=production
   ```

2. **Agregar datos de prueba:**
   ```bash
   # Conectar a Redis Cluster
   docker exec -it redis-master-1 redis-cli -c -p 7000
   
   # Simular mensajes por minuto
   INCR msg:rate:202512120715
   EXPIRE msg:rate:202512120715 60
   
   # Total del día
   SET msg:total:20251212 3250
   
   # Usuario online
   SETEX presence:rodrigo 30 "online"
   SETEX presence:kam 30 "online"
   
   # Typing
   SETEX typing:chat123:rodrigo 3 "1"
   
   # Unread
   HINCRBY unread:kam chat:abc123 5
   HINCRBY unread:kam chat:xyz789 3
   HINCRBY unread:alex chat:abc123 10
   
   # Conversaciones activas
   SADD active:conversations "chat:abc123"
   SADD active:conversations "chat:xyz789"
   ```

3. **Verificar en dashboard:**
   - Badge debe decir "🟢 PRODUCTION"
   - Datos deben coincidir con Redis

---

## 📊 Flujo Completo de Mensajería con Métricas

### Cuando un usuario envía un mensaje:

```python
# 1. Guardar mensaje en MongoDB
db.messages.insert_one({
    "chat_id": "chat:abc123",
    "sender": "rodrigo",
    "content": "Hola!",
    "timestamp": datetime.utcnow()
})

# 2. Actualizar métricas en Redis
# a) Incrementar rate del minuto actual
redis.incr(f"msg:rate:{current_minute}")
redis.expire(f"msg:rate:{current_minute}", 60)

# b) Incrementar total del día
redis.incr(f"msg:total:{today}")
redis.expire(f"msg:total:{today}", 86400)

# c) Marcar conversación como activa
redis.sadd("active:conversations", "chat:abc123")
redis.expire("active:conversations", 600)

# d) Incrementar unread del receptor
redis.hincrby("unread:kam", "chat:abc123", 1)
```

### Cuando un usuario se conecta:

```python
# Marcar como online
redis.setex(f"presence:{user_id}", 30, "online")

# Heartbeat cada 15 segundos para mantener presencia
while connected:
    redis.setex(f"presence:{user_id}", 30, "online")
    await asyncio.sleep(15)
```

### Cuando un usuario escribe:

```python
# Cliente envía evento "typing"
redis.setex(f"typing:{chat_id}:{user_id}", 3, "1")

# Se renueva mientras sigue escribiendo
# Expira automáticamente a los 3s si deja de escribir
```

### Cuando un usuario lee mensajes:

```python
# Marcar conversación como leída
redis.hdel(f"unread:{user_id}", chat_id)

# O resetear contador
redis.hset(f"unread:{user_id}", chat_id, 0)
```

---

## 🎓 Para la Presentación

### Puntos Clave a Demostrar:

1. **Redis para métricas en tiempo real:**
   - INCR para contadores atómicos
   - SETEX para datos con TTL (presencia, typing)
   - HASH para datos estructurados (unread)
   - SCAN para evitar KEYS *

2. **Patrones de diseño:**
   - Time-series con keys por minuto/día
   - TTL para datos efímeros (presencia 30s, typing 3s)
   - Hash tags para sharding consistente

3. **Escalabilidad:**
   - Operaciones O(1) (INCR, GET, HGET)
   - SCAN en lugar de KEYS
   - Expiration automática (no cleanup manual)

4. **Distribución en Cluster:**
   - Keys se distribuyen por hash slot
   - `presence:{userId}` → mismo slot para usuario
   - `unread:{userId}` → mismo slot que presence

### Demostración en Vivo:

```bash
# 1. Mostrar dashboard con métricas mock
# 2. Cambiar a modo production
# 3. Ejecutar comandos Redis en vivo
# 4. Refrescar dashboard → Ver cambios
# 5. Mostrar auto-refresh cada 5s
```

---

## 🔗 Integración con Aplicación Real

Para integrar estas métricas en la app de mensajería:

**Backend - Al enviar mensaje:**
```python
@app.post("/dm/send")
def send_message(msg: DMCreate):
    # ... guardar en MongoDB ...
    
    # Actualizar métricas
    update_messaging_metrics(msg.sender_username, msg.receiver_username)
    
    return message
```

**Frontend - Presence heartbeat:**
```javascript
// En MessagesPage.jsx
useEffect(() => {
    const interval = setInterval(async () => {
        await fetch(`${API}/presence/heartbeat?userId=${currentUser.username}`);
    }, 15000);
    
    return () => clearInterval(interval);
}, [currentUser]);
```

**Frontend - Typing indicator:**
```javascript
// En ChatWindow.jsx
const handleTyping = () => {
    fetch(`${API}/presence/typing?chatId=${chatId}&userId=${currentUser.username}`);
};

<input onChange={handleTyping} ... />
```

---

## ✅ Resumen

**Sprint 2 COMPLETADO:**
- ✅ 3 tipos de métricas implementadas (rate, presence, unread)
- ✅ Modo mock para demo sin cluster
- ✅ Modo production con Redis Cluster real
- ✅ Dashboard visual completo
- ✅ Documentación de comandos Redis
- ✅ Auto-refresh cada 5 segundos
- ✅ Listo para presentación

**Próximo:** Sprint 3 - Data Distribution (chatId → slot → master)
