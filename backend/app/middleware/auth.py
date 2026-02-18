"""
Middleware de autenticación y autorización usando Supabase
Alternativa a Spring Security para Flask
"""
from functools import wraps
from flask import request, jsonify, g
from ..db.supabase_client import supabase
import logging
import base64
import json
import time
from typing import Dict, Optional

logger = logging.getLogger(__name__)

_auth_cache: Dict[str, Dict] = {}
_AUTH_CACHE_TTL_SECONDS = 300
_AUTH_CACHE_SKEW_SECONDS = 30
_AUTH_VERIFY_RETRIES = 3
_AUTH_VERIFY_RETRY_DELAY_SECONDS = 0.35

class AuthenticationError(Exception):
    """Error de autenticación"""
    pass

class AuthorizationError(Exception):
    """Error de autorización"""
    pass

def get_token_from_request():
    """Extraer token del header Authorization"""
    auth_header = request.headers.get('Authorization', '')
    
    if not auth_header:
        return None
    
    # Formato: "Bearer <token>"
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None
    
    return parts[1]

def verify_token(token):
    """
    Verificar token con Supabase y retornar usuario
    
    Returns:
        dict: Usuario con id, email, role, org_id, branch_id
    """
    cached_user = _get_cached_user(token)
    if cached_user:
        return cached_user

    last_error: Optional[Exception] = None
    for attempt in range(_AUTH_VERIFY_RETRIES):
        try:
            # Verificar token con Supabase
            response = supabase.auth.get_user(token)

            if not response or not response.user:
                raise AuthenticationError("Token inválido")

            user = response.user

            # Extraer metadata (role puede venir en app_metadata o user_metadata)
            app_metadata = user.app_metadata or {}
            user_metadata = user.user_metadata or {}
            role = app_metadata.get('role') or user_metadata.get('role')

            verified_user = {
                'id': user.id,
                'email': user.email,
                'role': role,
                'org_id': app_metadata.get('org_id'),
                'branch_id': app_metadata.get('branch_id')
            }
            _cache_verified_user(token, verified_user)
            return verified_user
        except AuthenticationError:
            raise
        except Exception as e:
            last_error = e
            transient = _is_transient_auth_error(e)
            if transient and attempt < _AUTH_VERIFY_RETRIES - 1:
                time.sleep(_AUTH_VERIFY_RETRY_DELAY_SECONDS * (attempt + 1))
                continue
            logger.error(f"Error verificando token: {str(e)}")
            raise AuthenticationError("Token inválido")

    if last_error:
        logger.error(f"Error verificando token: {str(last_error)}")
    raise AuthenticationError("Token inválido")


def _decode_token_exp(token: str) -> Optional[int]:
    try:
        parts = token.split('.')
        if len(parts) < 2:
            return None
        payload = parts[1]
        padding = '=' * (-len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload + padding)
        data = json.loads(decoded.decode('utf-8'))
        exp = data.get('exp')
        if isinstance(exp, int):
            return exp
        if isinstance(exp, float):
            return int(exp)
        return None
    except Exception:
        return None


def _get_cached_user(token: str) -> Optional[Dict]:
    cached = _auth_cache.get(token)
    if not cached:
        return None

    expires_at = cached.get('expires_at', 0)
    now = int(time.time())
    if expires_at <= now + _AUTH_CACHE_SKEW_SECONDS:
        _auth_cache.pop(token, None)
        return None

    user = cached.get('user')
    return user if isinstance(user, dict) else None


def _cache_verified_user(token: str, user: Dict) -> None:
    now = int(time.time())
    token_exp = _decode_token_exp(token)
    cache_exp = now + _AUTH_CACHE_TTL_SECONDS
    if token_exp is not None:
        cache_exp = min(cache_exp, int(token_exp))
    _auth_cache[token] = {
        'user': user,
        'expires_at': cache_exp
    }


def _is_transient_auth_error(error: Exception) -> bool:
    message = str(error).lower()
    transient_patterns = [
        "temporary failure in name resolution",
        "name or service not known",
        "failed to resolve",
        "timed out",
        "timeout",
        "connection reset",
        "network is unreachable",
    ]
    return any(pattern in message for pattern in transient_patterns)

def require_auth(f):
    """
    Decorator para requerir autenticación en una ruta
    
    Uso:
        @bp.route('/protected')
        @require_auth
        def protected_route():
            user = g.current_user
            return jsonify({"user_id": user['id']})
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_token_from_request()
        
        if not token:
            logger.warning(f"Intento de acceso sin token a {request.path}")
            return jsonify({"error": "No autorizado - Token requerido"}), 401
        
        try:
            user = verify_token(token)
            
            # Guardar usuario en contexto de Flask
            g.current_user = user
            g.user_id = user['id']
            g.user_role = user['role']
            g.user_org_id = user.get('org_id')
            g.user_branch_id = user.get('branch_id')
            
            logger.info(f"Usuario autenticado: {user['id']} - {user['email']} - Rol: {user['role']}")
            
            return f(*args, **kwargs)
        except AuthenticationError as e:
            logger.warning(f"Error de autenticación en {request.path}: {str(e)}")
            return jsonify({"error": str(e)}), 401
        except Exception as e:
            logger.error(f"Error inesperado en autenticación: {str(e)}")
            return jsonify({"error": "Error de autenticación"}), 500
    
    return decorated_function

def require_roles(*allowed_roles):
    """
    Decorator para requerir roles específicos
    Debe usarse DESPUÉS de @require_auth
    
    Uso:
        @bp.route('/admin-only')
        @require_auth
        @require_roles('desarrollador', 'admin')
        def admin_route():
            return jsonify({"message": "Admin access granted"})
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(g, 'current_user'):
                logger.error(f"require_roles usado sin require_auth en {request.path}")
                return jsonify({"error": "Error de configuración"}), 500
            
            user_role = g.user_role
            
            if not user_role:
                logger.warning(f"Usuario sin rol intentó acceder a {request.path}")
                return jsonify({"error": "Usuario sin rol asignado"}), 403
            
            if user_role not in allowed_roles:
                logger.warning(
                    f"Usuario {g.user_id} con rol '{user_role}' "
                    f"intentó acceder a {request.path} "
                    f"(roles permitidos: {', '.join(allowed_roles)})"
                )
                return jsonify({
                    "error": "Permisos insuficientes",
                    "required_roles": list(allowed_roles),
                    "your_role": user_role
                }), 403
            
            logger.info(f"Autorización exitosa: {user_role} accediendo a {request.path}")
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator

def require_same_org(f):
    """
    Decorator para validar que el usuario pertenece a la misma organización
    Útil para endpoints que reciben org_id como parámetro
    
    Uso:
        @bp.route('/org/<org_id>/data')
        @require_auth
        @require_roles('admin', 'caja')
        @require_same_org
        def get_org_data(org_id):
            return jsonify({"org_id": org_id})
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'current_user'):
            return jsonify({"error": "Error de configuración"}), 500
        
        # Obtener org_id del parámetro de ruta o del body
        org_id = kwargs.get('org_id') or request.json.get('org_id')
        
        if not org_id:
            return jsonify({"error": "org_id requerido"}), 400
        
        user_org_id = g.user_org_id
        
        # Desarrollador tiene acceso a todas las orgs
        if g.user_role == 'desarrollador':
            return f(*args, **kwargs)
        
        if not user_org_id:
            logger.warning(f"Usuario {g.user_id} sin org_id intentó acceder a org {org_id}")
            return jsonify({"error": "Usuario sin organización asignada"}), 403
        
        if str(user_org_id) != str(org_id):
            logger.warning(
                f"Usuario {g.user_id} de org {user_org_id} "
                f"intentó acceder a org {org_id}"
            )
            return jsonify({"error": "No puede acceder a otra organización"}), 403
        
        return f(*args, **kwargs)
    
    return decorated_function

def optional_auth(f):
    """
    Decorator para autenticación opcional
    Si hay token, valida y guarda usuario en g.current_user
    Si no hay token, continúa sin error
    
    Útil para endpoints públicos que pueden personalizar respuesta si hay usuario
    
    Uso:
        @bp.route('/menu')
        @optional_auth
        def get_menu():
            if hasattr(g, 'current_user'):
                # Usuario autenticado
                return jsonify({"menu": "personalizado"})
            else:
                # Usuario anónimo
                return jsonify({"menu": "público"})
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_token_from_request()
        
        if token:
            try:
                user = verify_token(token)
                g.current_user = user
                g.user_id = user['id']
                g.user_role = user['role']
                g.user_org_id = user.get('org_id')
                g.user_branch_id = user.get('branch_id')
            except:
                # Ignorar errores en autenticación opcional
                pass
        
        return f(*args, **kwargs)
    
    return decorated_function

# Utilidades adicionales
def get_current_user():
    """Obtener usuario actual del contexto"""
    if hasattr(g, 'current_user'):
        return g.current_user
    return None

def is_authenticated():
    """Verificar si hay un usuario autenticado"""
    return hasattr(g, 'current_user') and g.current_user is not None

def has_role(*roles):
    """Verificar si el usuario tiene alguno de los roles especificados"""
    if not is_authenticated():
        return False
    return g.user_role in roles

def has_permission(resource, action):
    """
    Sistema simple de permisos basado en recursos y acciones
    Puede extenderse para un sistema más complejo
    
    Args:
        resource: Nombre del recurso (ej: 'menu', 'payment', 'order')
        action: Acción (ej: 'create', 'read', 'update', 'delete')
    
    Returns:
        bool: True si el usuario tiene el permiso
    """
    if not is_authenticated():
        return False
    
    role = g.user_role
    
    # Definir matriz de permisos
    permissions = {
        'desarrollador': {
            '*': ['create', 'read', 'update', 'delete']  # Acceso total
        },
        'admin': {
            'menu': ['create', 'read', 'update', 'delete'],
            'order': ['read', 'update'],
            'payment': ['read'],
            'user': ['create', 'read', 'update'],
            'metrics': ['read']
        },
        'caja': {
            'menu': ['read'],
            'order': ['read', 'update'],
            'payment': ['create', 'read'],
            'metrics': ['read']
        }
    }
    
    role_permissions = permissions.get(role, {})
    
    # Desarrollador tiene acceso a todo
    if '*' in role_permissions:
        return True
    
    resource_actions = role_permissions.get(resource, [])
    return action in resource_actions
