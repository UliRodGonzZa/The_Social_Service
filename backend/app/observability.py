"""
Observability Module - Redis Cluster Metrics

Este módulo proporciona endpoints para monitorear el estado y métricas
del Redis Cluster usado en la aplicación de mensajería.

Soporta dos modos:
- PRODUCTION: Se conecta al Redis Cluster real
- MOCK/DEMO: Retorna datos simulados para testing/demo
"""

import os
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
import redis
from redis.cluster import RedisCluster
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


# Router para endpoints de observabilidad
router = APIRouter(prefix="/observability", tags=["observability"])

# Modo de operación (controlado por env var)
OBSERVABILITY_MODE = os.getenv("OBSERVABILITY_MODE", "mock").lower()  # "production" o "mock"

# Configuración del cluster (para modo production)
REDIS_CLUSTER_NODES = [
    {"host": "redis-master-1", "port": 7000},
    {"host": "redis-master-2", "port": 7001},
    {"host": "redis-master-3", "port": 7002},
]


# ============================================================================
# Modelos Pydantic
# ============================================================================

class RedisNodeInfo(BaseModel):
    """Información de un nodo del cluster"""
    node_id: str
    ip_port: str
    role: str  # "master" o "replica"
    master_id: Optional[str] = None
    state: str  # "connected", "disconnected", "fail"
    slots: str  # Ej: "0-5460" o "-" para replicas
    flags: str  # Ej: "master", "slave,fail"
    
    # Métricas adicionales
    used_memory_human: Optional[str] = None
    instantaneous_ops_per_sec: Optional[int] = None
    connected_clients: Optional[int] = None
    uptime_in_seconds: Optional[int] = None


class ClusterHealthResponse(BaseModel):
    """Respuesta del endpoint de cluster health"""
    mode: str  # "production" o "mock"
    timestamp: str
    cluster_state: str  # "ok" o "fail"
    cluster_size: int
    cluster_known_nodes: int
    cluster_slots_assigned: int
    cluster_slots_ok: int
    cluster_slots_pfail: int
    cluster_slots_fail: int
    nodes: List[RedisNodeInfo]


class SlotDistribution(BaseModel):
    """Distribución de slots en el cluster"""
    slot_range: str  # "0-5460"
    master_node: str  # "node_id"
    master_ip_port: str
    replicas: List[str]  # Lista de node_ids de replicas


class ClusterSlotsResponse(BaseModel):
    """Respuesta del endpoint de slots"""
    mode: str
    timestamp: str
    total_slots: int
    slot_distributions: List[SlotDistribution]


# ============================================================================
# Modelos para Sprint 2: Messaging Metrics
# ============================================================================

class MessagingRateMetrics(BaseModel):
    """Métricas de tasa de mensajes"""
    messages_per_minute: int
    messages_per_second: float
    total_messages_today: int
    peak_minute: Optional[int] = None
    active_conversations: int


class PresenceMetrics(BaseModel):
    """Métricas de presencia"""
    total_online: int
    total_typing: int
    users_online: List[str]
    typing_in_chats: Dict[str, List[str]]  # {chatId: [usernames]}


class UnreadMetrics(BaseModel):
    """Métricas de mensajes no leídos"""
    total_unread_messages: int
    users_with_unread: int
    top_conversations: List[Dict[str, Any]]  # Lista de conversaciones con más no leídos
    average_unread_per_user: float


class MessagingMetricsResponse(BaseModel):
    """Respuesta completa de métricas de mensajería"""
    mode: str
    timestamp: str
    rate: MessagingRateMetrics
    presence: PresenceMetrics
    unread: UnreadMetrics


# ============================================================================
# Funciones Helper - Conexión a Redis Cluster
# ============================================================================

def get_redis_cluster_client():
    """
    Obtiene cliente de Redis Cluster.
    
    Nota: En modo production, se conecta al cluster real.
    En modo mock, retorna None.
    """
    if OBSERVABILITY_MODE == "production":
        try:
            # Crear cliente de Redis Cluster
            rc = RedisCluster(
                startup_nodes=REDIS_CLUSTER_NODES,
                decode_responses=True,
                skip_full_coverage_check=True,
                socket_timeout=5,
                socket_connect_timeout=5,
            )
            # Verificar conexión
            rc.ping()
            return rc
        except Exception as e:
            print(f"⚠️ Error conectando a Redis Cluster: {e}")
            return None
    return None


def parse_cluster_nodes(nodes_output: str) -> List[Dict[str, Any]]:
    """
    Parsea la salida de CLUSTER NODES.
    
    Formato: <id> <ip:port> <flags> <master_id> <ping> <pong> <epoch> <state> <slots>
    """
    nodes = []
    for line in nodes_output.strip().split('\n'):
        if not line:
            continue
        
        parts = line.split()
        if len(parts) < 8:
            continue
        
        node_id = parts[0]
        ip_port = parts[1].split('@')[0]  # Remover puerto de cluster bus
        flags = parts[2]
        master_id = parts[3] if parts[3] != '-' else None
        state = parts[7]
        
        # Determinar role
        role = "master" if "master" in flags else "replica"
        
        # Slots (solo para masters)
        slots = "-"
        if role == "master" and len(parts) > 8:
            # Combinar todos los rangos de slots
            slot_ranges = parts[8:]
            slots = ",".join(slot_ranges)
        
        nodes.append({
            "node_id": node_id,
            "ip_port": ip_port,
            "role": role,
            "master_id": master_id,
            "state": state,
            "slots": slots,
            "flags": flags,
        })
    
    return nodes


def parse_cluster_info(info_output: str) -> Dict[str, Any]:
    """
    Parsea la salida de CLUSTER INFO.
    
    Retorna diccionario con métricas clave.
    """
    info = {}
    for line in info_output.strip().split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            info[key.strip()] = value.strip()
    return info


def get_node_info(rc: RedisCluster, node_addr: str) -> Dict[str, Any]:
    """
    Obtiene INFO de un nodo específico.
    
    Retorna métricas como memoria, ops/sec, clientes conectados.
    """
    try:
        # Conectar directamente al nodo
        host, port = node_addr.split(':')
        node_client = redis.Redis(
            host=host, 
            port=int(port), 
            decode_responses=True,
            socket_timeout=5
        )
        
        info = node_client.info()
        
        return {
            "used_memory_human": info.get("used_memory_human", "N/A"),
            "instantaneous_ops_per_sec": info.get("instantaneous_ops_per_sec", 0),
            "connected_clients": info.get("connected_clients", 0),
            "uptime_in_seconds": info.get("uptime_in_seconds", 0),
        }
    except Exception as e:
        print(f"⚠️ Error obteniendo INFO de {node_addr}: {e}")
        return {
            "used_memory_human": "N/A",
            "instantaneous_ops_per_sec": 0,
            "connected_clients": 0,
            "uptime_in_seconds": 0,
        }


# ============================================================================
# Funciones Mock - Datos de Demostración
# ============================================================================

def get_mock_cluster_health() -> ClusterHealthResponse:
    """
    Retorna datos mock para cluster health.
    
    Útil para testing y demo en ambientes sin Redis Cluster.
    """
    return ClusterHealthResponse(
        mode="mock",
        timestamp=datetime.utcnow().isoformat(),
        cluster_state="ok",
        cluster_size=3,
        cluster_known_nodes=6,
        cluster_slots_assigned=16384,
        cluster_slots_ok=16384,
        cluster_slots_pfail=0,
        cluster_slots_fail=0,
        nodes=[
            RedisNodeInfo(
                node_id="abc123master1",
                ip_port="redis-master-1:7000",
                role="master",
                master_id=None,
                state="connected",
                slots="0-5460",
                flags="master",
                used_memory_human="2.5M",
                instantaneous_ops_per_sec=150,
                connected_clients=12,
                uptime_in_seconds=86400,
            ),
            RedisNodeInfo(
                node_id="def456replica1",
                ip_port="redis-replica-1:7003",
                role="replica",
                master_id="abc123master1",
                state="connected",
                slots="-",
                flags="slave",
                used_memory_human="2.5M",
                instantaneous_ops_per_sec=0,
                connected_clients=3,
                uptime_in_seconds=86400,
            ),
            RedisNodeInfo(
                node_id="ghi789master2",
                ip_port="redis-master-2:7001",
                role="master",
                master_id=None,
                state="connected",
                slots="5461-10922",
                flags="master",
                used_memory_human="2.8M",
                instantaneous_ops_per_sec=200,
                connected_clients=15,
                uptime_in_seconds=86400,
            ),
            RedisNodeInfo(
                node_id="jkl012replica2",
                ip_port="redis-replica-2:7004",
                role="replica",
                master_id="ghi789master2",
                state="connected",
                slots="-",
                flags="slave",
                used_memory_human="2.8M",
                instantaneous_ops_per_sec=0,
                connected_clients=3,
                uptime_in_seconds=86400,
            ),
            RedisNodeInfo(
                node_id="mno345master3",
                ip_port="redis-master-3:7002",
                role="master",
                master_id=None,
                state="connected",
                slots="10923-16383",
                flags="master",
                used_memory_human="2.3M",
                instantaneous_ops_per_sec=180,
                connected_clients=10,
                uptime_in_seconds=86400,
            ),
            RedisNodeInfo(
                node_id="pqr678replica3",
                ip_port="redis-replica-3:7005",
                role="replica",
                master_id="mno345master3",
                state="connected",
                slots="-",
                flags="slave",
                used_memory_human="2.3M",
                instantaneous_ops_per_sec=0,
                connected_clients=3,
                uptime_in_seconds=86400,
            ),
        ]
    )


def get_mock_cluster_slots() -> ClusterSlotsResponse:
    """Retorna datos mock para distribución de slots"""
    return ClusterSlotsResponse(
        mode="mock",
        timestamp=datetime.utcnow().isoformat(),
        total_slots=16384,
        slot_distributions=[
            SlotDistribution(
                slot_range="0-5460",
                master_node="abc123master1",
                master_ip_port="redis-master-1:7000",
                replicas=["def456replica1"],
            ),
            SlotDistribution(
                slot_range="5461-10922",
                master_node="ghi789master2",
                master_ip_port="redis-master-2:7001",
                replicas=["jkl012replica2"],
            ),
            SlotDistribution(
                slot_range="10923-16383",
                master_node="mno345master3",
                master_ip_port="redis-master-3:7002",
                replicas=["pqr678replica3"],
            ),
        ]
    )


# ============================================================================
# Endpoints - Cluster Health
# ============================================================================

@router.get("/cluster/health", response_model=ClusterHealthResponse)
async def get_cluster_health():
    """
    Obtiene el estado de salud del Redis Cluster.
    
    Comandos Redis ejecutados:
    - CLUSTER INFO: Estado general del cluster
    - CLUSTER NODES: Información de cada nodo
    - INFO (por nodo): Métricas individuales
    
    Modo MOCK: Retorna datos simulados.
    Modo PRODUCTION: Se conecta al cluster real.
    """
    
    # Modo mock
    if OBSERVABILITY_MODE == "mock":
        return get_mock_cluster_health()
    
    # Modo production
    try:
        rc = get_redis_cluster_client()
        if not rc:
            raise HTTPException(
                status_code=503,
                detail="No se pudo conectar al Redis Cluster"
            )
        
        # Obtener CLUSTER INFO
        cluster_info_raw = rc.execute_command("CLUSTER INFO")
        cluster_info = parse_cluster_info(cluster_info_raw)
        
        # Obtener CLUSTER NODES
        cluster_nodes_raw = rc.execute_command("CLUSTER NODES")
        nodes_data = parse_cluster_nodes(cluster_nodes_raw)
        
        # Enriquecer con métricas de INFO por nodo
        nodes_with_metrics = []
        for node in nodes_data:
            node_metrics = get_node_info(rc, node["ip_port"])
            nodes_with_metrics.append(
                RedisNodeInfo(
                    **node,
                    **node_metrics
                )
            )
        
        return ClusterHealthResponse(
            mode="production",
            timestamp=datetime.utcnow().isoformat(),
            cluster_state=cluster_info.get("cluster_state", "unknown"),
            cluster_size=int(cluster_info.get("cluster_size", 0)),
            cluster_known_nodes=int(cluster_info.get("cluster_known_nodes", 0)),
            cluster_slots_assigned=int(cluster_info.get("cluster_slots_assigned", 0)),
            cluster_slots_ok=int(cluster_info.get("cluster_slots_ok", 0)),
            cluster_slots_pfail=int(cluster_info.get("cluster_slots_pfail", 0)),
            cluster_slots_fail=int(cluster_info.get("cluster_slots_fail", 0)),
            nodes=nodes_with_metrics,
        )
        
    except Exception as e:
        print(f"❌ Error en get_cluster_health: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo cluster health: {str(e)}"
        )


@router.get("/cluster/slots", response_model=ClusterSlotsResponse)
async def get_cluster_slots():
    """
    Obtiene la distribución de slots en el cluster.
    
    Comando Redis: CLUSTER SLOTS
    
    Retorna:
    - Rangos de slots
    - Master que maneja cada rango
    - Replicas de cada master
    """
    
    # Modo mock
    if OBSERVABILITY_MODE == "mock":
        return get_mock_cluster_slots()
    
    # Modo production
    try:
        rc = get_redis_cluster_client()
        if not rc:
            raise HTTPException(
                status_code=503,
                detail="No se pudo conectar al Redis Cluster"
            )
        
        # Obtener CLUSTER SLOTS
        slots_info = rc.execute_command("CLUSTER SLOTS")
        
        distributions = []
        for slot_info in slots_info:
            start_slot = slot_info[0]
            end_slot = slot_info[1]
            master_info = slot_info[2]
            replicas_info = slot_info[3:] if len(slot_info) > 3 else []
            
            # Parsear master
            master_ip = master_info[0]
            master_port = master_info[1]
            master_id = master_info[2] if len(master_info) > 2 else "unknown"
            
            # Parsear replicas
            replica_ids = []
            for replica in replicas_info:
                replica_id = replica[2] if len(replica) > 2 else "unknown"
                replica_ids.append(replica_id)
            
            distributions.append(
                SlotDistribution(
                    slot_range=f"{start_slot}-{end_slot}",
                    master_node=master_id,
                    master_ip_port=f"{master_ip}:{master_port}",
                    replicas=replica_ids,
                )
            )
        
        return ClusterSlotsResponse(
            mode="production",
            timestamp=datetime.utcnow().isoformat(),
            total_slots=16384,
            slot_distributions=distributions,
        )
        
    except Exception as e:
        print(f"❌ Error en get_cluster_slots: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo cluster slots: {str(e)}"
        )


@router.get("/mode")
async def get_observability_mode():
    """
    Retorna el modo actual de observabilidad.
    
    Útil para que el frontend sepa si está en modo mock o production.
    """
    return {
        "mode": OBSERVABILITY_MODE,
        "description": "mock: datos simulados, production: cluster real",
        "timestamp": datetime.utcnow().isoformat(),
    }


# ============================================================================
# Sprint 2: Messaging Metrics Endpoints
# ============================================================================

def get_messaging_rate_metrics_production():
    """
    Obtiene métricas de tasa de mensajes desde Redis.
    
    Keys usadas:
    - msg:rate:{minute} - Contador de mensajes por minuto (INCR + EXPIRE 60)
    - msg:total:today - Total de mensajes del día (INCR + EXPIRE 86400)
    - active:conversations - Set de conversaciones activas (SADD + EXPIRE)
    """
    try:
        rc = get_redis_cluster_client()
        if not rc:
            return None
        
        from datetime import datetime
        now = datetime.utcnow()
        current_minute = now.strftime("%Y%m%d%H%M")
        
        # Obtener mensajes del minuto actual
        msg_current_min = rc.get(f"msg:rate:{current_minute}")
        messages_per_minute = int(msg_current_min) if msg_current_min else 0
        
        # Calcular mensajes por segundo (aproximación)
        messages_per_second = round(messages_per_minute / 60.0, 2)
        
        # Total de mensajes hoy
        today = now.strftime("%Y%m%d")
        total_today = rc.get(f"msg:total:{today}")
        total_messages_today = int(total_today) if total_today else 0
        
        # Conversaciones activas
        active_convs = rc.scard("active:conversations")
        
        return MessagingRateMetrics(
            messages_per_minute=messages_per_minute,
            messages_per_second=messages_per_second,
            total_messages_today=total_messages_today,
            peak_minute=None,  # TODO: implementar tracking de pico
            active_conversations=active_convs if active_convs else 0,
        )
    except Exception as e:
        print(f"⚠️ Error obteniendo rate metrics: {e}")
        return None


def get_presence_metrics_production():
    """
    Obtiene métricas de presencia y typing desde Redis.
    
    Keys usadas:
    - presence:{userId} - Key con TTL 30s, valor "online"
    - typing:{chatId}:{userId} - Key con TTL 3s, valor timestamp
    
    Para escanear todas las keys de presencia, usamos SCAN (no KEYS).
    """
    try:
        rc = get_redis_cluster_client()
        if not rc:
            return None
        
        users_online = []
        typing_in_chats = {}
        
        # Escanear keys de presencia
        # Nota: En cluster, SCAN debe ejecutarse en cada master
        for node in REDIS_CLUSTER_NODES:
            try:
                node_client = redis.Redis(
                    host=node["host"],
                    port=node["port"],
                    decode_responses=True,
                    socket_timeout=2
                )
                
                # Escanear presence:*
                cursor = 0
                while True:
                    cursor, keys = node_client.scan(cursor, match="presence:*", count=100)
                    for key in keys:
                        user_id = key.split(":")[1]
                        if user_id not in users_online:
                            users_online.append(user_id)
                    if cursor == 0:
                        break
                
                # Escanear typing:*
                cursor = 0
                while True:
                    cursor, keys = node_client.scan(cursor, match="typing:*", count=100)
                    for key in keys:
                        # key formato: typing:{chatId}:{userId}
                        parts = key.split(":")
                        if len(parts) >= 3:
                            chat_id = parts[1]
                            user_id = parts[2]
                            if chat_id not in typing_in_chats:
                                typing_in_chats[chat_id] = []
                            if user_id not in typing_in_chats[chat_id]:
                                typing_in_chats[chat_id].append(user_id)
                    if cursor == 0:
                        break
                        
            except Exception as e:
                print(f"⚠️ Error escaneando nodo {node}: {e}")
                continue
        
        return PresenceMetrics(
            total_online=len(users_online),
            total_typing=sum(len(users) for users in typing_in_chats.values()),
            users_online=users_online[:50],  # Limitar a 50 para no sobrecargar
            typing_in_chats=typing_in_chats,
        )
    except Exception as e:
        print(f"⚠️ Error obteniendo presence metrics: {e}")
        return None


def get_unread_metrics_production():
    """
    Obtiene métricas de mensajes no leídos desde Redis.
    
    Keys usadas:
    - unread:{userId} - HASH con {chatId: count}
    
    Comandos:
    - HGETALL unread:{userId} - Obtener todos los no leídos de un usuario
    - HLEN unread:{userId} - Contar conversaciones con no leídos
    """
    try:
        rc = get_redis_cluster_client()
        if not rc:
            return None
        
        total_unread = 0
        users_with_unread = 0
        conversation_unreads = {}
        
        # Escanear keys unread:*
        for node in REDIS_CLUSTER_NODES:
            try:
                node_client = redis.Redis(
                    host=node["host"],
                    port=node["port"],
                    decode_responses=True,
                    socket_timeout=2
                )
                
                cursor = 0
                while True:
                    cursor, keys = node_client.scan(cursor, match="unread:*", count=100)
                    for key in keys:
                        user_id = key.split(":")[1]
                        
                        # Obtener hash de no leídos
                        unread_hash = node_client.hgetall(key)
                        if unread_hash:
                            users_with_unread += 1
                            for chat_id, count in unread_hash.items():
                                count_int = int(count)
                                total_unread += count_int
                                
                                # Acumular por conversación
                                if chat_id not in conversation_unreads:
                                    conversation_unreads[chat_id] = 0
                                conversation_unreads[chat_id] += count_int
                    
                    if cursor == 0:
                        break
                        
            except Exception as e:
                print(f"⚠️ Error escaneando unread en nodo {node}: {e}")
                continue
        
        # Top conversaciones con más no leídos
        top_conversations = [
            {"chat_id": chat_id, "unread_count": count}
            for chat_id, count in sorted(
                conversation_unreads.items(),
                key=lambda x: x[1],
                reverse=True
            )[:10]
        ]
        
        avg_unread = (total_unread / users_with_unread) if users_with_unread > 0 else 0.0
        
        return UnreadMetrics(
            total_unread_messages=total_unread,
            users_with_unread=users_with_unread,
            top_conversations=top_conversations,
            average_unread_per_user=round(avg_unread, 2),
        )
    except Exception as e:
        print(f"⚠️ Error obteniendo unread metrics: {e}")
        return None


def get_mock_messaging_metrics():
    """Retorna métricas mock de mensajería"""
    return MessagingMetricsResponse(
        mode="mock",
        timestamp=datetime.utcnow().isoformat(),
        rate=MessagingRateMetrics(
            messages_per_minute=45,
            messages_per_second=0.75,
            total_messages_today=3250,
            peak_minute=120,
            active_conversations=28,
        ),
        presence=PresenceMetrics(
            total_online=15,
            total_typing=3,
            users_online=["rodrigo", "kam", "alex", "maria", "juan"],
            typing_in_chats={
                "chat:abc123": ["rodrigo"],
                "chat:xyz789": ["kam", "alex"],
            },
        ),
        unread=UnreadMetrics(
            total_unread_messages=47,
            users_with_unread=12,
            top_conversations=[
                {"chat_id": "chat:abc123", "unread_count": 15},
                {"chat_id": "chat:xyz789", "unread_count": 10},
                {"chat_id": "chat:def456", "unread_count": 8},
            ],
            average_unread_per_user=3.92,
        ),
    )


@router.get("/messaging/metrics", response_model=MessagingMetricsResponse)
async def get_messaging_metrics():
    """
    Obtiene métricas de mensajería desde Redis Cluster.
    
    Sprint 2 - Métricas:
    1. Rate: Mensajes por minuto/segundo
    2. Presence: Usuarios online y typing
    3. Unread: Mensajes no leídos por conversación
    
    Keys de Redis:
    - msg:rate:{minute} - INCR + EXPIRE 60
    - presence:{userId} - SET con TTL 30s
    - typing:{chatId}:{userId} - SET con TTL 3s
    - unread:{userId} - HASH {chatId: count}
    """
    
    # Modo mock
    if OBSERVABILITY_MODE == "mock":
        return get_mock_messaging_metrics()
    
    # Modo production
    try:
        rate = get_messaging_rate_metrics_production()
        presence = get_presence_metrics_production()
        unread = get_unread_metrics_production()
        
        # Si alguno falla, usar valores por defecto
        if not rate:
            rate = MessagingRateMetrics(
                messages_per_minute=0,
                messages_per_second=0.0,
                total_messages_today=0,
                active_conversations=0,
            )
        
        if not presence:
            presence = PresenceMetrics(
                total_online=0,
                total_typing=0,
                users_online=[],
                typing_in_chats={},
            )
        
        if not unread:
            unread = UnreadMetrics(
                total_unread_messages=0,
                users_with_unread=0,
                top_conversations=[],
                average_unread_per_user=0.0,
            )
        
        return MessagingMetricsResponse(
            mode="production",
            timestamp=datetime.utcnow().isoformat(),
            rate=rate,
            presence=presence,
            unread=unread,
        )
        
    except Exception as e:
        print(f"❌ Error en get_messaging_metrics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo messaging metrics: {str(e)}"
        )
