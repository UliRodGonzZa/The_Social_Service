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
