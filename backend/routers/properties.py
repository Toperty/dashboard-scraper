"""
Router de Propiedades - Endpoints de búsqueda y filtrado de propiedades
"""
from fastapi import APIRouter, Query
from typing import List, Optional
from sqlmodel import Session, select, func
from sqlalchemy import and_, or_
from config.db_connection import engine
from models.property import Property
from models.city import City
from services.stats_service import get_local_now
from services.property_filters import (
    build_rooms_filter, build_baths_filter, build_garages_filter,
    build_stratum_filter, build_antiquity_filter, build_property_type_filter,
    build_price_type_filters, format_antiquity
)
from services.geo_service import geocode_address, filter_properties_by_distance
import re

router = APIRouter(prefix="/api", tags=["properties"])


def format_property_data(prop, city, distance_map: dict = None):
    """Formatear datos de propiedad para respuesta"""
    # Link de FincaRaiz
    finca_raiz_link = None
    if hasattr(prop, 'fr_property_id') and prop.fr_property_id:
        finca_raiz_link = f"https://www.fincaraiz.com.co/inmueble/{prop.fr_property_id}"
    
    # Link de Google Maps
    maps_link = None
    if prop.latitude and prop.longitude:
        maps_link = f"https://www.google.com/maps?q={prop.latitude},{prop.longitude}"
    
    # Procesar stratum
    stratum_value = None
    if prop.stratum:
        stratum_match = re.search(r'Estrato\s*(\d+)', prop.stratum)
        if stratum_match:
            stratum_value = int(stratum_match.group(1))
    
    # Procesar antiquity
    antiquity_display = format_antiquity(prop.antiquity)
    
    # Convertir rooms, baths, garages a números
    rooms_value = None
    if prop.rooms:
        try:
            rooms_value = int(prop.rooms) if isinstance(prop.rooms, str) else prop.rooms
        except:
            rooms_value = prop.rooms
    
    baths_value = None
    if prop.baths:
        try:
            baths_value = int(prop.baths) if isinstance(prop.baths, str) else prop.baths
        except:
            baths_value = prop.baths
    
    garages_value = None
    if prop.garages:
        try:
            garages_value = int(prop.garages) if isinstance(prop.garages, str) else prop.garages
        except:
            garages_value = prop.garages
    
    return {
        "id": prop.fr_property_id,
        "city": city.name if city else "Sin especificar",
        "area": prop.area,
        "rooms": rooms_value,
        "price": prop.price,
        "offer_type": "Venta" if prop.offer == "sell" else "Renta",
        "creation_date": prop.creation_date.isoformat() if prop.creation_date else None,
        "last_update": prop.last_update.isoformat() if prop.last_update else None,
        "title": prop.title,
        "finca_raiz_link": finca_raiz_link,
        "maps_link": maps_link,
        "latitude": prop.latitude,
        "longitude": prop.longitude,
        "baths": baths_value,
        "garages": garages_value,
        "stratum": stratum_value,
        "antiquity": antiquity_display,
        "is_new": prop.is_new,
        "address": getattr(prop, 'address', None),
        "distance": distance_map.get(prop.fr_property_id, None) if distance_map else None
    }


@router.get("/properties")
async def get_properties(
    page: int = 1,
    limit: int = 50,
    city_ids: Optional[List[int]] = Query(None),
    offer_type: str = None,
    min_price: float = None,
    max_price: float = None,
    min_area: float = None,
    max_area: float = None,
    rooms: Optional[List[str]] = Query(None),
    baths: Optional[List[str]] = Query(None),
    garages: Optional[List[str]] = Query(None),
    stratums: Optional[List[str]] = Query(None),
    antiquity_categories: Optional[List[int]] = Query(None),
    antiquity_filter: str = None,
    property_type: Optional[List[str]] = Query(None),
    min_sale_price: float = None,
    max_sale_price: float = None,
    min_rent_price: float = None,
    max_rent_price: float = None,
    updated_date_from: str = None,
    updated_date_to: str = None,
    search_address: str = None,
    latitude: float = None,
    longitude: float = None,
    radius: int = None
):
    """Obtener propiedades con filtros y paginación"""
    try:
        with Session(engine) as session:
            query = select(Property, City).outerjoin(City, Property.city_id == City.id)
            filters = []
            
            # Aplicar filtros básicos
            if city_ids:
                filters.append(Property.city_id.in_(city_ids))
            
            if offer_type:
                filters.append(Property.offer == offer_type)
                
            if min_price is not None:
                filters.append(Property.price >= min_price)
                
            if max_price is not None:
                filters.append(Property.price <= max_price)
            
            # Filtros de precio por tipo de oferta
            price_filter = build_price_type_filters(Property, min_sale_price, max_sale_price, min_rent_price, max_rent_price)
            if price_filter is not None:
                filters.append(price_filter)
                
            if min_area is not None:
                filters.append(Property.area >= min_area)
                
            if max_area is not None:
                filters.append(Property.area <= max_area)
            
            # Filtros construidos con servicios
            rooms_filter = build_rooms_filter(Property, rooms)
            if rooms_filter is not None:
                filters.append(rooms_filter)
            
            baths_filter = build_baths_filter(Property, baths)
            if baths_filter is not None:
                filters.append(baths_filter)
            
            garages_filter = build_garages_filter(Property, garages)
            if garages_filter is not None:
                filters.append(garages_filter)
            
            stratum_filter = build_stratum_filter(Property, stratums)
            if stratum_filter is not None:
                filters.append(stratum_filter)
            
            antiquity_filter_result = build_antiquity_filter(Property, antiquity_categories, antiquity_filter)
            if antiquity_filter_result is not None:
                filters.append(antiquity_filter_result)
            
            property_type_filter = build_property_type_filter(Property, property_type)
            if property_type_filter is not None:
                filters.append(property_type_filter)
            
            # Filtros de fecha
            if updated_date_from:
                from datetime import datetime
                try:
                    date_from = datetime.strptime(updated_date_from, "%Y-%m-%d").date()
                    filters.append(Property.last_update >= date_from)
                except:
                    pass
            
            if updated_date_to:
                from datetime import datetime
                try:
                    date_to = datetime.strptime(updated_date_to, "%Y-%m-%d").date()
                    filters.append(Property.last_update <= date_to)
                except:
                    pass
            
            # Geocodificar dirección si es necesario
            if search_address and radius is not None:
                lat, lng, _ = geocode_address(search_address)
                if lat and lng:
                    latitude, longitude = lat, lng
            
            distance_map = {}
            
            # Filtrar por distancia si hay coordenadas
            if latitude is not None and longitude is not None and radius is not None:
                if filters:
                    query = query.where(and_(*filters))
                
                all_results = session.exec(query.order_by(Property.creation_date.desc())).all()
                
                filtered_results, distance_map = filter_properties_by_distance(all_results, latitude, longitude, radius)
                total_count = len(filtered_results)
                
                # Paginación después del filtrado
                offset = (page - 1) * limit
                results = filtered_results[offset:offset + limit]
            else:
                # Sin filtro de distancia
                count_query = select(func.count(Property.fr_property_id)).outerjoin(City, Property.city_id == City.id)
                if filters:
                    count_query = count_query.where(and_(*filters))
                
                total_count = session.exec(count_query).one()
                
                if filters:
                    query = query.where(and_(*filters))
                
                offset = (page - 1) * limit
                query = query.offset(offset).limit(limit).order_by(Property.creation_date.desc())
                results = session.exec(query).all()
            
            # Formatear resultados
            properties = [format_property_data(prop, city, distance_map) for prop, city in results]
            
            total_pages = (total_count + limit - 1) // limit
            
            return {
                "status": "success",
                "data": {
                    "properties": properties,
                    "pagination": {
                        "page": page,
                        "limit": limit,
                        "total_count": total_count,
                        "total_pages": total_pages,
                        "has_next": page < total_pages,
                        "has_prev": page > 1
                    }
                }
            }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.get("/properties/by-zone")
async def get_properties_by_zone(
    boundary_type: str = Query(..., description="Tipo de límite"),
    city_id: Optional[int] = Query(None),
    north: Optional[float] = Query(None),
    south: Optional[float] = Query(None),
    east: Optional[float] = Query(None),
    west: Optional[float] = Query(None),
    property_type: Optional[str] = Query(None),
    updated_date_from: Optional[str] = Query(None),
    updated_date_to: Optional[str] = Query(None)
):
    """Obtener propiedades agrupadas por zona"""
    try:
        with Session(engine) as session:
            filters = [
                Property.latitude.isnot(None),
                Property.longitude.isnot(None)
            ]
            
            if city_id:
                filters.append(Property.city_id == city_id)
            
            if all([north, south, east, west]):
                filters.extend([
                    Property.latitude <= north,
                    Property.latitude >= south,
                    Property.longitude <= east,
                    Property.longitude >= west
                ])
            
            # Filtrar por tipo de propiedad
            if property_type:
                type_filter = build_property_type_filter(Property, property_type.split(','))
                if type_filter is not None:
                    filters.append(type_filter)
            
            # Filtrar por fechas
            if updated_date_from:
                from datetime import datetime
                date_from = datetime.strptime(updated_date_from, '%Y-%m-%d').date()
                filters.append(Property.last_update >= date_from)
            
            if updated_date_to:
                from datetime import datetime
                date_to = datetime.strptime(updated_date_to, '%Y-%m-%d').date()
                filters.append(Property.last_update <= date_to)
            
            query = select(Property).where(and_(*filters))
            properties = session.exec(query).all()
            
            properties_data = [{
                'id': prop.fr_property_id,
                'latitude': prop.latitude,
                'longitude': prop.longitude,
                'price': prop.price,
                'offer': prop.offer,
                'area': prop.area,
                'rooms': prop.rooms,
                'city_id': prop.city_id,
                'location_main': prop.location_main,
                'stratum': prop.stratum,
                'title': prop.title,
                'last_update': prop.last_update.isoformat() if prop.last_update else None
            } for prop in properties]
            
            properties_for_sale = [p for p in properties_data if p['offer'] == 'sell']
            properties_for_rent = [p for p in properties_data if p['offer'] == 'rent']
            
            return {
                'status': 'success',
                'boundary_type': boundary_type,
                'data': {
                    'properties': properties_data,
                    'summary': {
                        'total': len(properties_data),
                        'for_sale': len(properties_for_sale),
                        'for_rent': len(properties_for_rent)
                    }
                }
            }
            
    except Exception as e:
        print(f"Error getting properties by zone: {e}")
        return {'status': 'error', 'message': str(e), 'data': None}
