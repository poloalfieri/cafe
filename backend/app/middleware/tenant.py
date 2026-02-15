"""
Multi-tenant middleware for Flask
Handles restaurant slug resolution and restaurant_id injection
"""
from flask import request, g, jsonify
from functools import lru_cache
import os
import logging

logger = logging.getLogger(__name__)

# Simple in-memory cache for slug to restaurant_id mapping
# In production, consider using Redis or similar
_slug_cache = {}
_cache_ttl = 300  # 5 minutes

INTERNAL_PROXY_KEY = os.getenv('INTERNAL_PROXY_KEY')
FLASK_ENV = os.getenv('FLASK_ENV', 'production')

# Paths that don't require restaurant slug
GLOBAL_PATHS = [
    '/health',
    '/',
]

def is_global_path(path):
    """Check if path is a global endpoint that doesn't require restaurant slug"""
    # Super-admin paths are global (handled by Next.js API routes)
    # These requests won't reach the Flask backend
    for global_path in GLOBAL_PATHS:
        if path.startswith(global_path):
            return True
    return False

def verify_internal_key():
    """Verify X-Internal-Key header for security"""
    if not INTERNAL_PROXY_KEY:
        # If no key is set in development, allow bypass
        if FLASK_ENV == 'development':
            return True
        return False
    
    request_key = request.headers.get('X-Internal-Key')
    return request_key == INTERNAL_PROXY_KEY

def get_restaurant_id_from_slug(slug):
    """
    Get restaurant_id from slug
    Uses cache to avoid repeated database queries
    """
    # Check cache first
    if slug in _slug_cache:
        cached_data = _slug_cache[slug]
        # Simple TTL check would go here in production
        return cached_data['restaurant_id']
    
    # Query database (using Supabase in this case)
    try:
        from ..db.supabase_client import supabase
        
        response = supabase.table('restaurants').select('id').eq('slug', slug).single().execute()
        
        if not response.data:
            return None
        
        restaurant_id = response.data['id']
        
        # Cache the result
        _slug_cache[slug] = {
            'restaurant_id': restaurant_id,
            'slug': slug
        }
        
        return restaurant_id
    except Exception as e:
        logger.error(f"Error fetching restaurant for slug '{slug}': {str(e)}")
        return None

def clear_slug_cache():
    """Clear the slug cache (useful for testing or when restaurants are updated)"""
    global _slug_cache
    _slug_cache = {}

def tenant_middleware():
    """
    Middleware to handle multi-tenant requests
    Should be registered in create_app() with @app.before_request
    """
    # Skip for global paths
    if is_global_path(request.path):
        return None
    
    # Verify internal proxy key for security
    if not verify_internal_key():
        logger.warning(f"Request to {request.path} without valid internal key")
        return jsonify({"error": "Unauthorized - Invalid internal key"}), 401
    
    # Get restaurant slug from header
    restaurant_slug = request.headers.get('X-Restaurant-Slug')
    
    if not restaurant_slug:
        logger.warning(f"Request to {request.path} without X-Restaurant-Slug header")
        return jsonify({"error": "Bad Request - Restaurant slug required"}), 400
    
    # Resolve restaurant_id from slug
    restaurant_id = get_restaurant_id_from_slug(restaurant_slug)
    
    if not restaurant_id:
        logger.warning(f"Invalid restaurant slug: {restaurant_slug}")
        return jsonify({"error": "Not Found - Restaurant not found"}), 404
    
    # Inject restaurant_id into Flask global context
    g.restaurant_id = restaurant_id
    g.restaurant_slug = restaurant_slug
    
    logger.info(f"Request to {request.path} for restaurant: {restaurant_slug} (ID: {restaurant_id})")
    
    return None
