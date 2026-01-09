"""
Router de Zonas - Endpoints de estadísticas por zona geográfica
"""
from fastapi import APIRouter, Query
from typing import Optional
from sqlmodel import Session
from sqlalchemy import text
from config.db_connection import engine
import math

router = APIRouter(prefix="/api", tags=["zones"])


@router.get("/zone-statistics")
async def get_zone_statistics(
    city_id: int = None,
    updated_date_from: str = None,
    updated_date_to: str = None
):
    """Obtener estadísticas de zonas básicas"""
    try:
        with Session(engine) as session:
            query_sql = """
            SELECT 
                p.location_main,
                COUNT(DISTINCT p.fr_property_id) as property_count,
                MIN(p.latitude) as min_lat,
                MAX(p.latitude) as max_lat,
                MIN(p.longitude) as min_lng,
                MAX(p.longitude) as max_lng,
                AVG(p.latitude) as center_lat,
                AVG(p.longitude) as center_lng
            FROM property p
            WHERE p.location_main IS NOT NULL 
                AND p.area > 0 
                AND p.price > 0
                AND p.latitude IS NOT NULL 
                AND p.longitude IS NOT NULL
                {city_filter}
            GROUP BY p.location_main
            HAVING COUNT(DISTINCT p.fr_property_id) > 3
            ORDER BY property_count DESC;
            """
            
            city_filter = f"AND p.city_id = {city_id}" if city_id else ""
            final_query = query_sql.format(city_filter=city_filter)
            
            results = session.exec(text(final_query)).all()
            
            zone_stats = []
            for row in results:
                zone_stats.append({
                    'id': row[0].lower().replace(' ', '_').replace('/', '_') if row[0] else 'unknown',
                    'name': row[0] if row[0] else 'Zona desconocida',
                    'property_count': int(row[1]) if row[1] else 0,
                    'bounds': {
                        'min_lat': float(row[2]) if row[2] else 0,
                        'max_lat': float(row[3]) if row[3] else 0,
                        'min_lng': float(row[4]) if row[4] else 0,
                        'max_lng': float(row[5]) if row[5] else 0
                    },
                    'center_lat': float(row[6]) if row[6] else 0,
                    'center_lng': float(row[7]) if row[7] else 0,
                    'sale_avg_price_m2': 0,
                    'sale_valorization': 0,
                    'rent_avg_price_m2': 0,
                    'rent_valorization': 0,
                    'cap_rate': 0,
                    'cap_rate_valorization': 0
                })
            
            return {'status': 'success', 'data': zone_stats}
            
    except Exception as e:
        print(f"Error getting zone statistics: {e}")
        return {'status': 'error', 'message': str(e), 'data': []}


@router.get("/zone-statistics-full")
async def get_zone_statistics_full(
    city_id: int = None,
    updated_date_from: str = None,
    updated_date_to: str = None
):
    """Obtener estadísticas completas de zonas con valorización"""
    try:
        with Session(engine) as session:
            query_sql = """
            WITH zone_stats AS (
                SELECT 
                    p.location_main,
                    c.name as city_name,
                    COUNT(DISTINCT p.fr_property_id) as property_count,
                    PERCENTILE_CONT(0.2) WITHIN GROUP (ORDER BY p.latitude) as min_lat,
                    PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY p.latitude) as max_lat,
                    PERCENTILE_CONT(0.2) WITHIN GROUP (ORDER BY p.longitude) as min_lng,
                    PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY p.longitude) as max_lng,
                    AVG(p.latitude) as center_lat,
                    AVG(p.longitude) as center_lng,
                    AVG(CASE WHEN p.offer = 'sell' THEN p.price / NULLIF(p.area, 0) END) as sale_price_m2,
                    AVG(CASE WHEN p.offer = 'rent' THEN p.price / NULLIF(p.area, 0) END) as rent_price_m2,
                    AVG(CASE WHEN p.offer = 'sell' AND up.previous_value > 0 THEN up.previous_value / NULLIF(p.area, 0) END) as prev_sale_m2,
                    AVG(CASE WHEN p.offer = 'rent' AND up.previous_value > 0 THEN up.previous_value / NULLIF(p.area, 0) END) as prev_rent_m2
                FROM property p
                LEFT JOIN updated_property up ON p.fr_property_id = up.property_id
                LEFT JOIN city c ON p.city_id = c.id
                WHERE p.location_main IS NOT NULL 
                    AND p.area > 0 
                    AND p.price > 0
                    AND p.latitude IS NOT NULL 
                    AND p.longitude IS NOT NULL
                    {city_filter}
                    {date_filter}
                GROUP BY p.location_main, c.name
                HAVING COUNT(DISTINCT p.fr_property_id) > 3
            )
            SELECT 
                location_main as name,
                city_name,
                property_count,
                min_lat, max_lat, min_lng, max_lng, center_lat, center_lng,
                COALESCE(sale_price_m2, 0) as sale_price_m2,
                COALESCE(rent_price_m2, 0) as rent_price_m2,
                CASE 
                    WHEN prev_sale_m2 > 0 AND sale_price_m2 > 0 THEN 
                        ((sale_price_m2 - prev_sale_m2) / prev_sale_m2 * 100)
                    ELSE 0 
                END as sale_valorization,
                CASE 
                    WHEN prev_rent_m2 > 0 AND rent_price_m2 > 0 THEN 
                        ((rent_price_m2 - prev_rent_m2) / prev_rent_m2 * 100)
                    ELSE 0 
                END as rent_valorization,
                CASE 
                    WHEN sale_price_m2 > 0 AND rent_price_m2 > 0 THEN 
                        (rent_price_m2 / sale_price_m2 / 12)
                    ELSE 0 
                END as cap_rate
            FROM zone_stats
            ORDER BY property_count DESC;
            """
            
            city_filter = f"AND p.city_id = {city_id}" if city_id else ""
            
            date_filter = ""
            if updated_date_from:
                date_filter += f" AND (up.updated_date IS NULL OR up.updated_date >= '{updated_date_from}')"
            if updated_date_to:
                date_filter += f" AND (up.updated_date IS NULL OR up.updated_date <= '{updated_date_to}')"
                
            final_query = query_sql.format(city_filter=city_filter, date_filter=date_filter)
            
            results = session.exec(text(final_query)).all()
            
            zones_data = []
            for result in results:
                # Asegurar que no hay NaN
                sale_price_m2 = float(result[9]) if result[9] and not math.isnan(float(result[9])) else 0
                rent_price_m2 = float(result[10]) if result[10] and not math.isnan(float(result[10])) else 0
                sale_valorization = float(result[11]) if result[11] and not math.isnan(float(result[11])) else 0
                rent_valorization = float(result[12]) if result[12] and not math.isnan(float(result[12])) else 0
                cap_rate = float(result[13]) if result[13] and not math.isnan(float(result[13])) else 0
                
                zones_data.append({
                    'id': str(result[0]),
                    'name': str(result[0]),
                    'city_name': str(result[1]) if result[1] else '',
                    'property_count': int(result[2]) if result[2] else 0,
                    'min_lat': float(result[3]) if result[3] else 0,
                    'max_lat': float(result[4]) if result[4] else 0,
                    'min_lng': float(result[5]) if result[5] else 0,
                    'max_lng': float(result[6]) if result[6] else 0,
                    'center_lat': float(result[7]) if result[7] else 0,
                    'center_lng': float(result[8]) if result[8] else 0,
                    'sale_price_m2': sale_price_m2,
                    'rent_price_m2': rent_price_m2,
                    'sale_valorization': sale_valorization,
                    'rent_valorization': rent_valorization,
                    'cap_rate': cap_rate
                })
            
            return {'status': 'success', 'data': zones_data}
                
    except Exception as e:
        print(f"Error getting zone statistics full: {e}")
        return {'status': 'error', 'message': str(e)}


@router.get("/zone-details")
async def get_zone_details(
    zone_name: str,
    city_id: int = None,
    updated_date_from: str = None,
    updated_date_to: str = None,
    property_type: str = None,
    north: float = None,
    south: float = None,
    east: float = None,
    west: float = None
):
    """Obtener detalles de una zona específica"""
    from datetime import datetime, timedelta
    
    try:
        with Session(engine) as session:
            # Configurar filtro de ubicación
            if not all([north, south, east, west]):
                location_filter = "p.location_main = :zone_name"
                location_params = {"zone_name": zone_name}
            else:
                location_filter = """
                    p.latitude IS NOT NULL 
                    AND p.longitude IS NOT NULL
                    AND p.latitude <= :north 
                    AND p.latitude >= :south
                    AND p.longitude <= :east 
                    AND p.longitude >= :west
                """
                location_params = {"north": north, "south": south, "east": east, "west": west}
            
            has_date_filter = updated_date_from or updated_date_to
            
            # Query para período filtrado
            query_filtered = f"""
            WITH zone_data AS (
                SELECT 
                    p.fr_property_id, p.offer,
                    COALESCE(up.previous_value, p.price) as price,
                    p.area, p.creation_date
                FROM property p
                LEFT JOIN updated_property up ON p.fr_property_id = up.property_id
                WHERE {location_filter}
                    AND p.area > 0 
                    AND (COALESCE(up.previous_value, p.price) > 0)
                    {{city_filter}}
                    {{date_filter}}
                    {{type_filter}}
            ),
            filtered_data AS (
                SELECT * FROM zone_data
            )
            SELECT 
                COUNT(DISTINCT fr_property_id) as total_properties,
                COUNT(DISTINCT CASE WHEN offer = 'sell' THEN fr_property_id END) as sale_count,
                COUNT(DISTINCT CASE WHEN offer = 'rent' THEN fr_property_id END) as rent_count,
                AVG(CASE WHEN offer = 'sell' THEN price / NULLIF(area, 0) END) as sale_price_m2,
                AVG(CASE WHEN offer = 'rent' THEN price / NULLIF(area, 0) END) as rent_price_m2,
                AVG(CASE WHEN offer = 'sell' THEN price END) as avg_sale_price,
                AVG(CASE WHEN offer = 'rent' THEN price END) as avg_rent_price
            FROM filtered_data;
            """
            
            city_filter = f"AND p.city_id = {city_id}" if city_id else ""
            
            # Filtro de tipo de propiedad
            type_filter = ""
            if property_type:
                property_types = [pt.strip().lower() for pt in property_type.split(',')]
                type_conditions = []
                for prop_type in property_types:
                    if prop_type == "apartamento":
                        type_conditions.append("(p.title ILIKE '%apartamento%' OR p.title ILIKE '%apto%')")
                    elif prop_type == "casa":
                        type_conditions.append("p.title ILIKE '%casa%'")
                    elif prop_type in ["oficina", "local", "bodega", "lote", "finca"]:
                        type_conditions.append(f"p.title ILIKE '%{prop_type}%'")
                if type_conditions:
                    type_filter = f"AND ({' OR '.join(type_conditions)})"
            
            date_filter = ""
            if updated_date_from:
                date_filter += f" AND p.creation_date >= '{updated_date_from}'"
            if updated_date_to:
                date_filter += f" AND p.creation_date <= '{updated_date_to}'"
                
            final_query = query_filtered.format(city_filter=city_filter, date_filter=date_filter, type_filter=type_filter)
            result_filtered = session.execute(text(final_query), location_params).first()
            
            # Procesar resultado
            filtered_data = {}
            if result_filtered:
                sale_count = int(result_filtered[1]) if result_filtered[1] else 0
                rent_count = int(result_filtered[2]) if result_filtered[2] else 0
                sale_price_m2 = float(result_filtered[3]) if result_filtered[3] else 0
                rent_avg_price = float(result_filtered[4]) if result_filtered[4] else 0
                avg_sale_price = float(result_filtered[5]) if result_filtered[5] else 0
                avg_rent_price = float(result_filtered[6]) if result_filtered[6] else 0
                
                cap_rate = ((avg_rent_price * 12) / avg_sale_price) if avg_sale_price > 0 and avg_rent_price > 0 else 0
                cap_rate = 0 if math.isnan(cap_rate) or math.isinf(cap_rate) else cap_rate
                
                filtered_data = {
                    'property_count': int(result_filtered[0]) if result_filtered[0] else 0,
                    'sale_count': sale_count,
                    'rent_count': rent_count,
                    'sale_avg_price_m2': sale_price_m2,
                    'rent_avg_price_m2': rent_avg_price,
                    'cap_rate': cap_rate
                }
            
            return {
                'status': 'success',
                'data': {
                    'filtered_period': filtered_data if filtered_data else {
                        'property_count': 0, 'sale_avg_price_m2': 0, 'rent_avg_price_m2': 0, 'cap_rate': 0
                    },
                    'current_period': None,
                    'has_comparison': False
                }
            }
    except Exception as e:
        print(f"Error getting zone details: {e}")
        return {'status': 'error', 'message': str(e)}


@router.get("/all-postal-codes")
async def get_all_postal_codes(city_id: int = None):
    """Obtener códigos postales por ciudad"""
    try:
        with Session(engine) as session:
            query = """
                SELECT DISTINCT 
                    p.location_main,
                    COUNT(*) as property_count,
                    AVG(p.latitude) as center_lat,
                    AVG(p.longitude) as center_lng,
                    AVG(CASE WHEN p.offer = 'sell' THEN p.price / NULLIF(p.area, 0) END) as avg_sale_price_m2,
                    AVG(CASE WHEN p.offer = 'rent' THEN p.price / NULLIF(p.area, 0) END) as avg_rent_price_m2
                FROM property p
                WHERE p.location_main IS NOT NULL
                    AND p.location_main != ''
                    AND p.latitude IS NOT NULL
                    AND p.longitude IS NOT NULL
                    {}
                GROUP BY p.location_main
                ORDER BY property_count DESC
            """
            
            city_filter = f"AND p.city_id = {city_id}" if city_id else ""
            result = session.exec(text(query.format(city_filter))).all()
            
            all_postal_codes = [{
                'postal_code': row[0],
                'has_properties': True,
                'property_count': row[1],
                'center_lat': float(row[2]) if row[2] else None,
                'center_lng': float(row[3]) if row[3] else None,
                'avg_sale_price_m2': float(row[4]) if row[4] else 0,
                'avg_rent_price_m2': float(row[5]) if row[5] else 0
            } for row in result]
        
        return {
            'status': 'success',
            'data': all_postal_codes,
            'stats': {
                'total_codes': len(all_postal_codes),
                'codes_with_properties': len(all_postal_codes),
                'codes_without_properties': 0
            }
        }
        
    except Exception as e:
        print(f"Error getting all postal codes: {e}")
        return {'status': 'error', 'message': str(e), 'data': []}
