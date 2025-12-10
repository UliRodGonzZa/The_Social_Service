"""
Redis Cluster Manager para Red K
Maneja conexiones y operaciones con Redis Cluster (3M + 3R)
"""

import os
import json
from typing import Optional, List, Dict, Any
from redis.cluster import RedisCluster, ClusterNode
from redis.exceptions import RedisClusterException
import logging

logger = logging.getLogger(__name__)


class RedisClusterManager:
    """
    Gestor de Redis Cluster con soporte para:
    - Hash tags para agrupar keys relacionadas
    - Cache de feeds, likes, comentarios, DMs
    - Trending posts (sorted sets)
    - TTL configurables por tipo de dato
    """
    
    def __init__(self):
        self._client: Optional[RedisCluster] = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Inicializar conexión a Redis Cluster"""
        try:
            # Nodos de inicio (auto-discovery encontrará el resto)
            startup_nodes = [
                ClusterNode(
                    os.getenv("REDIS_MASTER_1_HOST", "redis-master-1"),
                    int(os.getenv("REDIS_MASTER_1_PORT", "7000"))
                ),
                ClusterNode(
                    os.getenv("REDIS_MASTER_2_HOST", "redis-master-2"),
                    int(os.getenv("REDIS_MASTER_2_PORT", "7001"))
                ),
                ClusterNode(
                    os.getenv("REDIS_MASTER_3_HOST", "redis-master-3"),
                    int(os.getenv("REDIS_MASTER_3_PORT", "7002"))
                ),
            ]
            
            self._client = RedisCluster(
                startup_nodes=startup_nodes,
                decode_responses=True,
                skip_full_coverage_check=False,      # Verificar cobertura completa
                max_connections_per_node=50,         # Pool de conexiones
                read_from_replicas=True,             # Balancear lecturas en réplicas
                reinitialize_steps=10,               # Reintentos si cluster cambia
                cluster_error_retry_attempts=3,      # Reintentos en errores
                socket_connect_timeout=5,            # Timeout de conexión
            )
            
            # Verificar conexión
            self._client.ping()
            logger.info("✓ Conectado a Redis Cluster correctamente")
            
        except Exception as e:
            logger.error(f"✗ Error al conectar a Redis Cluster: {e}")
            self._client = None
    
    def get_client(self) -> Optional[RedisCluster]:
        """Obtener cliente de Redis Cluster"""
        return self._client
    
    def is_available(self) -> bool:
        """Verificar si Redis Cluster está disponible"""
        if not self._client:
            return False
        try:
            self._client.ping()
            return True
        except Exception:
            return False
    
    # ========== FEEDS ==========
    
    def get_user_feed(self, username: str, mode: str = "all") -> Optional[List[Dict]]:
        """
        Obtener feed cacheado del usuario
        
        Args:
            username: Nombre de usuario
            mode: "all", "following", "self"
        
        Returns:
            Lista de posts o None si no está en cache
        """
        if not self._client:
            return None
        
        try:
            key = f"{{user:{username}}}:feed:{mode}"
            cached = self._client.get(key)
            if cached:
                return json.loads(cached)
            return None
        except Exception as e:
            logger.warning(f"Error al leer feed de cache: {e}")
            return None
    
    def set_user_feed(self, username: str, mode: str, posts: List[Dict], ttl: int = 60):
        """
        Cachear feed del usuario
        
        Args:
            username: Nombre de usuario
            mode: "all", "following", "self"
            posts: Lista de posts a cachear
            ttl: Tiempo de vida en segundos (default: 60)
        """
        if not self._client:
            return
        
        try:
            key = f"{{user:{username}}}:feed:{mode}"
            self._client.setex(key, ttl, json.dumps(posts))
            logger.debug(f"Feed cacheado para {username} (mode={mode}, ttl={ttl}s)")
        except Exception as e:
            logger.warning(f"Error al cachear feed: {e}")
    
    def invalidate_user_feed(self, username: str):
        """
        Invalidar todos los feeds del usuario
        
        Args:
            username: Nombre de usuario
        """
        if not self._client:
            return
        
        try:
            keys = [
                f"{{user:{username}}}:feed:all",
                f"{{user:{username}}}:feed:following",
                f"{{user:{username}}}:feed:self",
            ]
            self._client.delete(*keys)
            logger.debug(f"Feeds invalidados para {username}")
        except Exception as e:
            logger.warning(f"Error al invalidar feeds: {e}")
    
    # ========== LIKES ==========
    
    def increment_post_likes(self, post_id: str, username: str) -> int:
        """
        Incrementar likes de un post (operación atómica)
        
        Args:
            post_id: ID del post
            username: Usuario que da like
        
        Returns:
            Nuevo contador de likes, o -1 si ya había dado like
        """
        if not self._client:
            return -1
        
        try:
            # Verificar si ya dio like
            if self._client.sismember(f"{{post:{post_id}}}:likes:users", username):
                return -1
            
            # Pipeline atómico
            pipe = self._client.pipeline()
            pipe.incr(f"{{post:{post_id}}}:likes:count")
            pipe.sadd(f"{{post:{post_id}}}:likes:users", username)
            pipe.zincrby("trending:posts", 1, post_id)
            results = pipe.execute()
            
            logger.debug(f"Like agregado: post={post_id}, user={username}, count={results[0]}")
            return results[0]
        except Exception as e:
            logger.error(f"Error al incrementar likes: {e}")
            return -1
    
    def decrement_post_likes(self, post_id: str, username: str) -> int:
        """
        Decrementar likes de un post (operación atómica)
        
        Args:
            post_id: ID del post
            username: Usuario que quita like
        
        Returns:
            Nuevo contador de likes, o -1 si no había dado like
        """
        if not self._client:
            return -1
        
        try:
            # Verificar si había dado like
            if not self._client.sismember(f"{{post:{post_id}}}:likes:users", username):
                return -1
            
            # Pipeline atómico
            pipe = self._client.pipeline()
            pipe.decr(f"{{post:{post_id}}}:likes:count")
            pipe.srem(f"{{post:{post_id}}}:likes:users", username)
            pipe.zincrby("trending:posts", -1, post_id)
            results = pipe.execute()
            
            logger.debug(f"Like removido: post={post_id}, user={username}, count={results[0]}")
            return results[0]
        except Exception as e:
            logger.error(f"Error al decrementar likes: {e}")
            return -1
    
    def get_post_likes_count(self, post_id: str) -> int:
        """Obtener contador de likes de un post"""
        if not self._client:
            return 0
        
        try:
            count = self._client.get(f"{{post:{post_id}}}:likes:count")
            return int(count) if count else 0
        except Exception as e:
            logger.warning(f"Error al obtener likes count: {e}")
            return 0
    
    def get_post_likes_users(self, post_id: str) -> List[str]:
        """Obtener lista de usuarios que dieron like"""
        if not self._client:
            return []
        
        try:
            users = self._client.smembers(f"{{post:{post_id}}}:likes:users")
            return list(users) if users else []
        except Exception as e:
            logger.warning(f"Error al obtener likes users: {e}")
            return []
    
    def has_user_liked_post(self, post_id: str, username: str) -> bool:
        """Verificar si un usuario dio like a un post"""
        if not self._client:
            return False
        
        try:
            return self._client.sismember(f"{{post:{post_id}}}:likes:users", username)
        except Exception as e:
            logger.warning(f"Error al verificar like: {e}")
            return False
    
    # ========== TRENDING ==========
    
    def get_trending_posts(self, limit: int = 10, timeframe: str = "") -> List[Dict[str, Any]]:
        """
        Obtener posts trending (más likeados)
        
        Args:
            limit: Número de posts a retornar
            timeframe: "" (global), "1h", "24h"
        
        Returns:
            Lista de dicts con post_id y likes
        """
        if not self._client:
            return []
        
        try:
            key = f"trending:posts:{timeframe}" if timeframe else "trending:posts"
            posts = self._client.zrevrange(key, 0, limit - 1, withscores=True)
            return [{"post_id": post_id, "likes": int(score)} for post_id, score in posts]
        except Exception as e:
            logger.warning(f"Error al obtener trending posts: {e}")
            return []
    
    # ========== COMENTARIOS ==========
    
    def get_post_comments(self, post_id: str) -> Optional[List[Dict]]:
        """Obtener comentarios cacheados de un post"""
        if not self._client:
            return None
        
        try:
            key = f"{{post:{post_id}}}:comments"
            cached = self._client.get(key)
            if cached:
                return json.loads(cached)
            return None
        except Exception as e:
            logger.warning(f"Error al leer comentarios de cache: {e}")
            return None
    
    def set_post_comments(self, post_id: str, comments: List[Dict], ttl: int = 120):
        """Cachear comentarios de un post"""
        if not self._client:
            return
        
        try:
            key = f"{{post:{post_id}}}:comments"
            self._client.setex(key, ttl, json.dumps(comments))
            logger.debug(f"Comentarios cacheados para post {post_id}")
        except Exception as e:
            logger.warning(f"Error al cachear comentarios: {e}")
    
    def invalidate_post_comments(self, post_id: str):
        """Invalidar cache de comentarios de un post"""
        if not self._client:
            return
        
        try:
            self._client.delete(f"{{post:{post_id}}}:comments")
            logger.debug(f"Comentarios invalidados para post {post_id}")
        except Exception as e:
            logger.warning(f"Error al invalidar comentarios: {e}")
    
    # ========== DMS ==========
    
    def get_conversation(self, user1: str, user2: str) -> Optional[List[Dict]]:
        """Obtener conversación cacheada entre dos usuarios"""
        if not self._client:
            return None
        
        try:
            # Ordenar usernames alfabéticamente para consistencia
            users = sorted([user1, user2])
            key = f"{{conv:{users[0]}::{users[1]}}}:messages"
            
            cached = self._client.get(key)
            if cached:
                return json.loads(cached)
            return None
        except Exception as e:
            logger.warning(f"Error al leer conversación de cache: {e}")
            return None
    
    def set_conversation(self, user1: str, user2: str, messages: List[Dict], ttl: int = 300):
        """Cachear conversación entre dos usuarios"""
        if not self._client:
            return
        
        try:
            users = sorted([user1, user2])
            key = f"{{conv:{users[0]}::{users[1]}}}:messages"
            self._client.setex(key, ttl, json.dumps(messages))
            logger.debug(f"Conversación cacheada: {user1} <-> {user2}")
        except Exception as e:
            logger.warning(f"Error al cachear conversación: {e}")
    
    def invalidate_conversation(self, user1: str, user2: str):
        """Invalidar cache de conversación"""
        if not self._client:
            return
        
        try:
            users = sorted([user1, user2])
            key = f"{{conv:{users[0]}::{users[1]}}}:messages"
            self._client.delete(key)
            logger.debug(f"Conversación invalidada: {user1} <-> {user2}")
        except Exception as e:
            logger.warning(f"Error al invalidar conversación: {e}")
    
    # ========== RECOMENDACIONES ==========
    
    def get_user_suggestions(self, username: str) -> Optional[List[Dict]]:
        """Obtener recomendaciones cacheadas para un usuario"""
        if not self._client:
            return None
        
        try:
            key = f"{{user:{username}}}:suggestions"
            cached = self._client.get(key)
            if cached:
                return json.loads(cached)
            return None
        except Exception as e:
            logger.warning(f"Error al leer sugerencias de cache: {e}")
            return None
    
    def set_user_suggestions(self, username: str, suggestions: List[Dict], ttl: int = 600):
        """Cachear recomendaciones de usuarios"""
        if not self._client:
            return
        
        try:
            key = f"{{user:{username}}}:suggestions"
            self._client.setex(key, ttl, json.dumps(suggestions))
            logger.debug(f"Sugerencias cacheadas para {username}")
        except Exception as e:
            logger.warning(f"Error al cachear sugerencias: {e}")
    
    def invalidate_user_suggestions(self, username: str):
        """Invalidar cache de recomendaciones"""
        if not self._client:
            return
        
        try:
            self._client.delete(f"{{user:{username}}}:suggestions")
            logger.debug(f"Sugerencias invalidadas para {username}")
        except Exception as e:
            logger.warning(f"Error al invalidar sugerencias: {e}")
    
    # ========== STATS ==========
    
    def get_cluster_info(self) -> Dict[str, Any]:
        """Obtener información del cluster"""
        if not self._client:
            return {"error": "Client not available"}
        
        try:
            return self._client.cluster_info()
        except Exception as e:
            logger.error(f"Error al obtener cluster info: {e}")
            return {"error": str(e)}
    
    def get_cluster_nodes(self) -> Dict[str, Any]:
        """Obtener información de los nodos del cluster"""
        if not self._client:
            return {"error": "Client not available"}
        
        try:
            return self._client.cluster_nodes()
        except Exception as e:
            logger.error(f"Error al obtener cluster nodes: {e}")
            return {"error": str(e)}


# Instancia global (singleton)
redis_cluster_manager = RedisClusterManager()
