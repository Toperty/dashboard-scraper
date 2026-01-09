"""
Servicio de geolocalización reutilizable
"""
from math import radians, cos, sin, asin, sqrt
import os
import requests
from typing import Optional, Tuple, Dict


def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """Calcula distancia entre dos puntos en metros usando Haversine"""
    try:
        R = 6371000  # Radio de la Tierra en metros
        lat1, lng1, lat2, lng2 = map(radians, [float(lat1), float(lng1), float(lat2), float(lng2)])
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
        c = 2 * asin(sqrt(a))
        return round(R * c)
    except Exception as e:
        print(f"Error calculando distancia: {e}")
        return float('inf')


def geocode_address(address: str) -> Tuple[Optional[float], Optional[float], Optional[str]]:
    """
    Geocodificar una dirección usando Google Maps API
    Returns: (latitude, longitude, formatted_address)
    """
    try:
        api_key = os.getenv('GOOGLE_API_KEY')
        if not api_key:
            print("❌ GOOGLE_API_KEY no encontrada")
            return None, None, None
        
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            'address': address,
            'key': api_key,
            'region': 'co',
            'language': 'es'
        }
        
        response = requests.get(url, params=params)
        data = response.json()
        
        if data['status'] == 'OK' and data['results']:
            location = data['results'][0]['geometry']['location']
            formatted_address = data['results'][0]['formatted_address']
            return location['lat'], location['lng'], formatted_address
        else:
            print(f"❌ No se pudo geocodificar: {data.get('status', 'Error')}")
            return None, None, None
            
    except Exception as e:
        print(f"❌ Error en geocodificación: {e}")
        return None, None, None


def filter_properties_by_distance(properties: list, lat: float, lng: float, radius: int) -> Tuple[list, Dict[str, int]]:
    """
    Filtrar propiedades por distancia desde un punto
    Returns: (filtered_properties, distance_map)
    """
    distance_map = {}
    filtered_results = []
    
    for prop, city in properties:
        if prop.latitude and prop.longitude:
            distance = calculate_distance(lat, lng, prop.latitude, prop.longitude)
            if distance <= radius:
                distance_map[prop.fr_property_id] = distance
                filtered_results.append((prop, city))
    
    # Ordenar por distancia (más cercanas primero)
    filtered_results.sort(key=lambda x: distance_map.get(x[0].fr_property_id, float('inf')))
    
    return filtered_results, distance_map
