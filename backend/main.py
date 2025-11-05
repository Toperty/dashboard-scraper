"""
Backend que FUNCIONA - Sin problemas de tablas
"""

from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import pytz

app = FastAPI(title="Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Timezone de Colombia
COLOMBIA_TZ = pytz.timezone('America/Bogota')

def get_local_now():
    """Obtener la hora actual en timezone de Colombia"""
    return datetime.now(COLOMBIA_TZ)

def get_city_status(city):
    """Determinar estado de ciudad basado en offsets y updated"""
    if city.updated:
        return "completed"
    elif city.current_sell_offset != 0 or city.current_rent_offset != 0:
        return "en_proceso"
    else:
        return "programado"


def get_recent_logs(session):
    """Obtener logs recientes de la tabla scraper_logs"""
    from sqlmodel import select
    from models.scraper_log import ScraperLog
    
    try:
        # Obtener los 10 logs más recientes
        recent_logs_query = select(ScraperLog).order_by(ScraperLog.timestamp.desc()).limit(10)
        recent_logs = session.exec(recent_logs_query).all()
        
        return [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else get_local_now().isoformat(),
                "scraper_name": log.scraper_name,
                "city_code": log.city_code,
                "offer_type": log.offer_type,
                "page_number": log.page_number,
                "log_level": log.log_level,
                "log_type": log.log_type,
                "message": log.message,
                "execution_time_ms": log.execution_time_ms,
                "properties_found": log.properties_found,
                "properties_validated": log.properties_validated,
                "error_type": log.error_type,
                "session_id": log.session_id,
                "scheduled_time": log.scheduled_time.isoformat() if log.scheduled_time else None
            }
            for log in recent_logs
        ]
    except Exception as e:
        return []

def get_next_executions(session):
    """Obtener próximas ejecuciones basadas en lógica de orden alfabético"""
    from sqlalchemy import text
    
    try:
        now = get_local_now()
        
        # Determinar cuál es la ciudad que se está ejecutando actualmente
        current_city_query = text("""
            SELECT city_code, offer_type FROM scraper_logs 
            ORDER BY timestamp DESC LIMIT 1
        """)
        
        current_result = session.exec(current_city_query).first()
        current_city_code = current_result[0] if current_result else None
        current_offer_type = current_result[1] if current_result else None
        
        # Obtener información de ciudades y su progreso
        cities_query = text("""
            SELECT 
                c.name,
                c.website_name,
                c.current_sell_offset,
                c.sell_pages_limit,
                c.current_rent_offset,
                c.rent_pages_limit,
                c.updated
            FROM city c
            WHERE c.updated = false
            ORDER BY c.name ASC
        """)
        
        cities_result = session.exec(cities_query).fetchall()
        
        executions = []
        
        # Encontrar la próxima ejecución basada en la lógica:
        # 1. Primero sell, luego rent
        # 2. Orden alfabético
        # 3. Horario cada 30 minutos (:30)
        
        next_execution_time = now.replace(second=0, microsecond=0)
        # Redondear al próximo :30
        if next_execution_time.minute < 30:
            next_execution_time = next_execution_time.replace(minute=30)
        else:
            next_execution_time = next_execution_time.replace(minute=30) + timedelta(hours=1)
        
        execution_count = 0
        for i, city_row in enumerate(cities_result):
            if execution_count >= 5:  # Límite de 5 ejecuciones
                break
                
            name, website_name, sell_offset, sell_limit, rent_offset, rent_limit, updated = city_row
            
            # Determinar si sell está completado
            sell_completed = sell_offset >= sell_limit if sell_limit > 0 else True
            rent_completed = rent_offset >= rent_limit if rent_limit > 0 else True
            
            # Si la ciudad está en progreso actual, determinar qué sigue
            if website_name == current_city_code:
                # Si estamos haciendo sell y no está completado, continuar sell
                if current_offer_type == "sell" and not sell_completed:
                    executions.append({
                        "city": name,
                        "type": "sell",
                        "scheduled_time": next_execution_time.isoformat(),
                        "minutes_remaining": int((next_execution_time - now).total_seconds() / 60)
                    })
                    next_execution_time += timedelta(hours=1)
                    execution_count += 1
                # Si sell está completado, hacer rent
                elif sell_completed and not rent_completed:
                    executions.append({
                        "city": name,
                        "type": "rent",
                        "scheduled_time": next_execution_time.isoformat(),
                        "minutes_remaining": int((next_execution_time - now).total_seconds() / 60)
                    })
                    next_execution_time += timedelta(hours=1)
                    execution_count += 1
                continue
            
            # Para otras ciudades, agregar sell primero si no está completado
            if not sell_completed:
                executions.append({
                    "city": name,
                    "type": "sell",
                    "scheduled_time": next_execution_time.isoformat(),
                    "minutes_remaining": int((next_execution_time - now).total_seconds() / 60)
                })
                next_execution_time += timedelta(hours=1)
                execution_count += 1
                
                if execution_count >= 5:
                    break
            
            # Luego rent si sell está completado y rent no
            if sell_completed and not rent_completed:
                executions.append({
                    "city": name,
                    "type": "rent",
                    "scheduled_time": next_execution_time.isoformat(),
                    "minutes_remaining": int((next_execution_time - now).total_seconds() / 60)
                })
                next_execution_time += timedelta(hours=1)
                execution_count += 1
        
        # Si no hay ejecuciones, mostrar una por defecto
        if not executions:
            executions.append({
                "city": "Sistema",
                "type": "info",
                "scheduled_time": next_execution_time.isoformat(),
                "minutes_remaining": int((next_execution_time - now).total_seconds() / 60)
            })
        
        return executions
        
    except Exception as e:
        # Fallback con próxima ejecución estimada
        now = get_local_now()
        next_time = now.replace(second=0, microsecond=0)
        if next_time.minute < 30:
            next_time = next_time.replace(minute=30)
        else:
            next_time = next_time.replace(minute=30) + timedelta(hours=1)
            
        return [{
            "city": "Sistema",
            "type": "info",
            "scheduled_time": next_time.isoformat(),
            "minutes_remaining": int((next_time - now).total_seconds() / 60)
        }]

def get_property_stats(session, city_id=None):
    """Obtener estadísticas reales de propiedades"""
    from sqlmodel import select, func
    from models.property import Property
    from datetime import date
    
    try:
        today = get_local_now().date()
        
        if city_id:
            # Stats para una ciudad específica
            total_query = select(func.count(Property.fr_property_id)).where(Property.city_id == city_id)
            today_query = select(func.count(Property.fr_property_id)).where(
                Property.city_id == city_id,
                Property.creation_date == today
            )
        else:
            # Stats globales
            total_query = select(func.count(Property.fr_property_id))
            today_query = select(func.count(Property.fr_property_id)).where(Property.creation_date == today)
        
        total_properties = session.exec(total_query).first() or 0
        today_properties = session.exec(today_query).first() or 0
        
        return total_properties, today_properties
    except Exception as e:
        return 0, 0

def get_avg_speed(session):
    """Calcular páginas por minuto desde PAGE_NAVIGATION logs"""
    from sqlmodel import select, func
    from models.scraper_log import ScraperLog
    from datetime import datetime, timedelta
    
    try:
        # Últimas 24 horas
        yesterday = get_local_now() - timedelta(hours=24)
        
        # Contar logs de PAGE_NAVIGATION en las últimas 24 horas
        page_count_query = select(func.count(ScraperLog.id)).where(
            ScraperLog.timestamp >= yesterday,
            ScraperLog.log_type == "PAGE_NAVIGATION"
        )
        
        page_count = session.exec(page_count_query).first()
        
        if page_count and page_count > 0:
            # Calcular páginas por minuto (24 horas = 1440 minutos)
            pages_per_minute = page_count / 1440
            return round(float(pages_per_minute), 2)
        else:
            return 0.0
    except Exception as e:
        print(f"Error calculating pages per minute: {e}")
        return 0.0

def get_last_execution_time(session):
    """Obtener tiempo desde la última ejecución obteniendo el timestamp más reciente de la BD"""
    try:
        from sqlalchemy import text
        
        # Obtener el último timestamp de scraper_logs
        query = text("""
            SELECT MAX(timestamp) FROM scraper_logs
        """)
        
        result = session.execute(query).fetchone()
        
        if result and result[0]:
            now = get_local_now()
            
            diff = now - result[0]
            total_seconds = abs(diff.total_seconds())
            
            if total_seconds < 60:
                return "Hace unos segundos"
            elif total_seconds < 3600:
                minutes = int(total_seconds // 60)
                return f"Hace {minutes} min"
            elif total_seconds < 86400:
                hours = int(total_seconds // 3600)
                return f"Hace {hours} hora{'s' if hours > 1 else ''}"
            else:
                days = int(total_seconds // 86400)
                return f"Hace {days} día{'s' if days > 1 else ''}"
        else:
            return "N/A"
            
    except Exception as e:
        print(f"Error getting last execution time: {e}")
        return "N/A"

def get_recent_errors_count(session):
    """Obtener conteo de errores usando SQL directo"""
    try:
        from sqlalchemy import text
        from datetime import timedelta
        
        yesterday = get_local_now() - timedelta(hours=24)
        
        # Contar errores en las últimas 24h
        query = text("""
            SELECT COUNT(*) FROM scraper_logs 
            WHERE timestamp >= :yesterday 
            AND log_level = 'ERROR'
        """)
        result = session.execute(query, {"yesterday": yesterday}).fetchone()
        count = int(result[0]) if result else 0
        
        return count
    except Exception as e:
        print(f"Error getting recent errors count: {e}")
        import traceback
        traceback.print_exc()
        return 0

def get_system_alerts(session):
    """Obtener alertas del sistema desde scraper_logs - último log de cada categoría"""
    from sqlalchemy import text
    
    try:
        # Usar SQL directo para evitar problemas con el enum
        sql_query = text("""
            WITH latest_logs AS (
                SELECT DISTINCT ON (LOWER(log_level))
                    LOWER(log_level) as log_level,
                    city_code,
                    offer_type,
                    message,
                    timestamp,
                    ROW_NUMBER() OVER (PARTITION BY LOWER(log_level) ORDER BY timestamp DESC) as rn
                FROM scraper_logs
                WHERE log_level IS NOT NULL
            )
            SELECT 
                ll.log_level,
                COALESCE(c.name, ll.city_code, 'Sistema') as city_name,
                ll.offer_type,
                ll.message,
                ll.timestamp
            FROM latest_logs ll
            LEFT JOIN city c ON ll.city_code = c.website_name
            WHERE ll.rn = 1
            ORDER BY ll.timestamp DESC
            LIMIT 10
        """)
        
        result = session.exec(sql_query)
        rows = result.fetchall()
        
        alerts = []
        for row in rows:
            level, city_name, offer_type, message, timestamp = row
            
            # Mapear niveles a los esperados por el frontend
            level_map = {
                'error': 'critical',
                'warning': 'warning',
                'info': 'info',
                'success': 'info',
                'debug': 'info'
            }
            
            mapped_level = level_map.get(level.lower() if level else 'info', 'info')
            
            # Formatear offer_type
            offer_display = ""
            if offer_type:
                offer_display = "Venta" if offer_type.lower() == "sell" else "Renta" if offer_type.lower() == "rent" else offer_type
                offer_display = f" [{offer_display}]"
            
            # Concatenar ciudad con tipo de oferta
            city_display = f"{city_name}{offer_display}"
            
            alerts.append({
                "level": mapped_level,
                "city": city_display,
                "message": message or f"Log de tipo {level}",
                "timestamp": timestamp.isoformat() if timestamp else get_local_now().isoformat()
            })
        
        # Si no hay alertas, agregar una informativa
        if not alerts:
            alerts.append({
                "level": "info",
                "city": "Sistema",
                "message": "No hay logs disponibles en el sistema",
                "timestamp": get_local_now().isoformat()
            })
        
        return alerts
        
    except Exception as e:
        # Retornar alerta de error si algo falla
        return [{
            "level": "warning",
            "city": "Sistema",
            "message": f"Error obteniendo alertas: {str(e)}",
            "timestamp": get_local_now().isoformat()
        }]

@app.get("/api/dashboard")
async def get_dashboard():
    """Dashboard con datos REALES de BD que funciona"""
    
    # Importar solo cuando necesitemos para evitar problemas de inicialización
    from sqlmodel import Session, select, func
    from config.db_connection import engine
    from models.city import City
    from models.scraper_log import ScraperLog
    from models.property import Property
    
    try:
        with Session(engine) as session:
            cities = session.exec(select(City).order_by(City.name)).all()
            
            # Obtener estadísticas globales reales
            total_properties_global, today_properties_global = get_property_stats(session)
            avg_speed = get_avg_speed(session)
            
            # Calcular propiedades actualizadas hoy
            from models.property import Property
            today = get_local_now().date()
            updated_today_query = select(func.count(Property.fr_property_id)).where(Property.last_update == today)
            properties_updated_today = session.exec(updated_today_query).first() or 0
            
            city_data = []
            for city in cities:
                # Calcular páginas procesadas basándose en propiedades (25 propiedades por página)
                sell_pages_processed = city.current_sell_offset // 25 if city.current_sell_offset > 0 else 0
                rent_pages_processed = city.current_rent_offset // 25 if city.current_rent_offset > 0 else 0
                
                # Limitar páginas procesadas al límite máximo
                sell_pages_processed = min(sell_pages_processed, city.sell_pages_limit)
                rent_pages_processed = min(rent_pages_processed, city.rent_pages_limit)
                
                # Calcular progreso basado en páginas procesadas vs páginas totales (máximo 100%)
                sell_progress = min((sell_pages_processed / city.sell_pages_limit * 100), 100.0) if city.sell_pages_limit > 0 else 0
                rent_progress = min((rent_pages_processed / city.rent_pages_limit * 100), 100.0) if city.rent_pages_limit > 0 else 0
                
                # Obtener estadísticas reales por ciudad
                total_properties_city, today_properties_city = get_property_stats(session, city.id)
                
                # Calcular hours_inactive reales
                hours_inactive = 0.0
                if city.last_updated:
                    delta = get_local_now().date() - city.last_updated
                    hours_inactive = round(delta.total_seconds() / 3600, 1)
                
                city_data.append({
                    "id": city.id,
                    "name": city.name,
                    "website_name": city.website_name,
                    "sell_progress": round(sell_progress, 1),
                    "rent_progress": round(rent_progress, 1),
                    "sell_pages": f"{sell_pages_processed}/{city.sell_pages_limit}",
                    "rent_pages": f"{rent_pages_processed}/{city.rent_pages_limit}",
                    "status": get_city_status(city),
                    "last_update": city.last_updated.isoformat() if city.last_updated else get_local_now().isoformat(),
                    "hours_inactive": hours_inactive,
                    "properties_today": today_properties_city,
                    "properties_total": total_properties_city
                })
            
            return {
                "status": "success",
                "timestamp": get_local_now().isoformat(),
                "data": {
                    "summary": {
                        "total_cities": len(cities),
                        "active_cities": len([c for c in cities if not c.updated]),
                        "completed_cities": len([c for c in cities if c.updated]),
                        "properties_today": today_properties_global,
                        "properties_updated_today": properties_updated_today,
                        "properties_total": total_properties_global,
                        "avg_speed_ms": avg_speed,
                        "last_execution_time": get_last_execution_time(session),
                        "recent_errors_count": get_recent_errors_count(session)
                    },
                    "cities": city_data,
                    "next_executions": get_next_executions(session),
                    "alerts": get_system_alerts(session),
                    "recent_logs": get_recent_logs(session)
                }
            }
    except Exception as e:
        return {"status": "error", "detail": f"Error: {str(e)}"}

@app.get("/api/summary")
async def get_summary_with_changes():
    """Obtener resumen con cambios porcentuales"""
    from sqlmodel import Session, select, func
    from config.db_connection import engine
    from models.city import City
    from models.property import Property
    from datetime import timedelta
    
    try:
        with Session(engine) as session:
            # Obtener estadísticas de hoy
            today = get_local_now().date()
            yesterday = today - timedelta(days=1)
            
            # Propiedades de hoy vs ayer
            today_properties_query = select(func.count(Property.fr_property_id)).where(Property.creation_date == today)
            yesterday_properties_query = select(func.count(Property.fr_property_id)).where(Property.creation_date == yesterday)
            
            today_count = session.exec(today_properties_query).first() or 0
            yesterday_count = session.exec(yesterday_properties_query).first() or 0
            
            # Calcular cambio porcentual de propiedades
            properties_change = 0
            if yesterday_count > 0:
                properties_change = round(((today_count - yesterday_count) / yesterday_count) * 100, 1)
            
            # Ciudades activas vs ayer
            cities_query = select(City)
            cities = session.exec(cities_query).all()
            
            total_cities = len(cities)
            active_cities = len([c for c in cities if not c.updated])
            
            # Para ciudades, comparar con las de ayer (simplificado)
            cities_change = 0  # Podríamos implementar historial de ciudades activas
            
            # Total de propiedades vs la semana pasada
            week_ago = today - timedelta(days=7)
            total_properties_query = select(func.count(Property.fr_property_id))
            week_ago_query = select(func.count(Property.fr_property_id)).where(Property.creation_date <= week_ago)
            
            total_properties = session.exec(total_properties_query).first() or 0
            week_ago_total = session.exec(week_ago_query).first() or 0
            
            # Calcular cambio total semanal
            total_change = 0
            if week_ago_total > 0:
                total_change = round(((total_properties - week_ago_total) / week_ago_total) * 100, 1)
            
            return {
                "status": "success",
                "data": {
                    "total_cities": total_cities,
                    "active_cities": active_cities,
                    "completed_cities": total_cities - active_cities,
                    "properties_today": today_count,
                    "properties_total": total_properties,
                    "avg_speed_ms": get_avg_speed(session),
                    "last_execution_time": get_last_execution_time(session),
                    "recent_errors_count": get_recent_errors_count(session),
                    "changes": {
                        "properties_today_change": properties_change,
                        "cities_change": cities_change,
                        "total_change": total_change
                    }
                }
            }
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@app.get("/api/properties")
async def get_properties(
    page: int = 1,
    limit: int = 50,
    city_id: int = None,
    offer_type: str = None,
    min_price: float = None,
    max_price: float = None,
    min_area: float = None,
    max_area: float = None,
    rooms: str = None,
    baths: str = None,
    garages: str = None,
    stratum: str = None,
    min_antiquity: int = None,
    max_antiquity: int = None,
    antiquity_filter: str = None,
    property_type: str = None,
    updated_date_from: str = None,
    updated_date_to: str = None,
    # Parámetros de ubicación para filtrar por distancia
    search_address: str = None,
    latitude: float = None,
    longitude: float = None,
    radius: int = None
):
    """Obtener propiedades con filtros y paginación"""
    from sqlmodel import Session, select
    from config.db_connection import engine
    from models.property import Property
    from models.city import City
    from sqlalchemy import and_, or_
    
    try:
        with Session(engine) as session:
            # Query base con left join a city para incluir propiedades sin city_id
            query = select(Property, City).outerjoin(City, Property.city_id == City.id)
            
            # Aplicar filtros
            filters = []
            
            if city_id:
                filters.append(Property.city_id == city_id)
            
            if offer_type:
                filters.append(Property.offer == offer_type)
                
            if min_price is not None:
                filters.append(Property.price >= min_price)
                
            if max_price is not None:
                filters.append(Property.price <= max_price)
                
            if min_area is not None:
                filters.append(Property.area >= min_area)
                
            if max_area is not None:
                filters.append(Property.area <= max_area)
                
            if rooms is not None:
                if rooms == "unspecified":  # "Sin especificar" case
                    filters.append(or_(
                        Property.rooms == None,
                        Property.rooms == '',
                        Property.rooms == 'N/A'
                    ))
                elif rooms.endswith('+'):  # Casos como "5+"
                    min_value = int(rooms[:-1])  # Extraer el número antes del "+"
                    print(f'EL VALOR MINIMO ES ESTE {min_value}')
                    # Filtrar solo valores numéricos y luego comparar
                    from sqlalchemy import cast, Integer, and_
                    filters.append(and_(
                        Property.rooms.regexp_match('^[0-9]+$'),  # Solo valores numéricos
                        cast(Property.rooms, Integer) >= min_value
                    ))
                else:
                    filters.append(Property.rooms == rooms)
            
            if baths is not None:
                if baths == "unspecified":  # "Sin especificar" case
                    filters.append(or_(
                        Property.baths == None,
                        Property.baths == '',
                        Property.baths == 'N/A'
                    ))
                elif baths.endswith('+'):  # Casos como "4+"
                    min_value = int(baths[:-1])  # Extraer el número antes del "+"
                    # Filtrar solo valores numéricos y luego comparar
                    from sqlalchemy import cast, Integer, and_
                    filters.append(and_(
                        Property.baths.regexp_match('^[0-9]+$'),  # Solo valores numéricos
                        cast(Property.baths, Integer) >= min_value
                    ))
                else:
                    filters.append(Property.baths == baths)
            
            if garages is not None:
                if garages == "unspecified":  # "Sin especificar" case
                    filters.append(or_(
                        Property.garages == None,
                        Property.garages == '',
                        Property.garages == 'N/A'
                    ))
                elif garages.endswith('+'):  # Casos como "3+"
                    min_value = int(garages[:-1])  # Extraer el número antes del "+"
                    # Filtrar solo valores numéricos y luego comparar
                    from sqlalchemy import cast, Integer, and_
                    filters.append(and_(
                        Property.garages.regexp_match('^[0-9]+$'),  # Solo valores numéricos
                        cast(Property.garages, Integer) >= min_value
                    ))
                else:
                    filters.append(Property.garages == garages)
            
            if stratum is not None:
                if stratum == "unspecified":  # "Sin especificar" case
                    filters.append(or_(
                        Property.stratum == None,
                        Property.stratum == '',
                        Property.stratum == 'Sin especificar'
                    ))
                else:
                    # Convertir número a formato "Estrato X"
                    stratum_str = f"Estrato {stratum}"
                    filters.append(Property.stratum == stratum_str)
            
            if min_antiquity is not None and max_antiquity is not None:
                # Mapear rangos a todos los valores posibles en la BD
                from sqlalchemy import or_, cast, Integer
                antiquity_conditions = []
                
                if min_antiquity == 0 and max_antiquity == 0:
                    # Menos de 1 año
                    antiquity_conditions.extend([
                        Property.antiquity == 'LESS_THAN_1_YEAR',
                        Property.antiquity == 'NEW',
                        Property.antiquity == '0',
                        Property.antiquity == 0
                    ])
                elif min_antiquity == 1 and max_antiquity == 8:
                    # 1 a 8 años
                    antiquity_conditions.extend([
                        Property.antiquity == 'FROM_1_TO_8_YEARS',
                        Property.antiquity == '1 a 8 años',
                        Property.antiquity == '1',
                        Property.antiquity == '2',
                        Property.antiquity == '3',
                        Property.antiquity == '4',
                        Property.antiquity == '5',
                        Property.antiquity == '6',
                        Property.antiquity == '7',
                        Property.antiquity == '8',
                        Property.antiquity == 1,
                        Property.antiquity == 2,
                        Property.antiquity == 3,
                        Property.antiquity == 4,
                        Property.antiquity == 5,
                        Property.antiquity == 6,
                        Property.antiquity == 7,
                        Property.antiquity == 8
                    ])
                elif min_antiquity == 9 and max_antiquity == 15:
                    # 9 a 15 años
                    antiquity_conditions.extend([
                        Property.antiquity == 'FROM_9_TO_15_YEARS',
                        Property.antiquity == '9 a 15 años'
                    ])
                    # Agregar valores numéricos del 9 al 15
                    for i in range(9, 16):
                        antiquity_conditions.append(Property.antiquity == str(i))
                        antiquity_conditions.append(Property.antiquity == i)
                elif min_antiquity == 16 and max_antiquity == 30:
                    # 16 a 30 años
                    antiquity_conditions.extend([
                        Property.antiquity == 'FROM_16_TO_30_YEARS',
                        Property.antiquity == '16 a 30 años'
                    ])
                    # Agregar valores numéricos del 16 al 30
                    for i in range(16, 31):
                        antiquity_conditions.append(Property.antiquity == str(i))
                        antiquity_conditions.append(Property.antiquity == i)
                elif min_antiquity == 31:
                    # Más de 30 años
                    antiquity_conditions.append(Property.antiquity == 'MORE_THAN_30_YEARS')
                    # Agregar valores numéricos mayores a 30
                    for i in range(31, 100):
                        antiquity_conditions.append(Property.antiquity == str(i))
                        antiquity_conditions.append(Property.antiquity == i)
                
                if antiquity_conditions:
                    filters.append(or_(*antiquity_conditions))
            elif antiquity_filter == 'unspecified':
                # Filtrar solo propiedades sin especificar antigüedad
                from sqlalchemy import or_
                filters.append(or_(
                    Property.antiquity == 'UNDEFINED',
                    Property.antiquity == 'Sin especificar',
                    Property.antiquity == None
                ))
            
            if property_type:
                # Mejorar la búsqueda de tipo de inmueble para ser más precisa
                property_type_lower = property_type.lower()
                if property_type_lower == "apartamento":
                    filters.append(or_(
                        Property.title.ilike("%apartamento%"),
                        Property.title.ilike("%apto%")
                    ))
                elif property_type_lower == "casa":
                    filters.append(and_(
                        Property.title.ilike("%casa%"),
                        ~Property.title.ilike("%apartamento%"),
                        ~Property.title.ilike("%apto%")
                    ))
                elif property_type_lower == "oficina":
                    filters.append(Property.title.ilike("%oficina%"))
                elif property_type_lower == "local":
                    filters.append(Property.title.ilike("%local%"))
                elif property_type_lower == "bodega":
                    filters.append(Property.title.ilike("%bodega%"))
                else:
                    # Para otros tipos, usar búsqueda simple sin espacios extra
                    filters.append(Property.title.ilike(f"%{property_type}%"))
            
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
                    # Incluir todo el día hasta las 23:59:59
                    date_to = datetime.strptime(updated_date_to, "%Y-%m-%d").date()
                    filters.append(Property.last_update <= date_to)
                except:
                    pass
            
            if filters:
                query = query.where(and_(*filters))
            
            # SI HAY FILTRO POR DISTANCIA, primero geocodificar la dirección
            if search_address and radius is not None:
                print(f"🏠 Geocodificando dirección: {search_address}")
                
                # Geocodificar la dirección usando Google Maps API directamente
                import requests
                import os
                
                try:
                    api_key = os.getenv('GOOGLE_API_KEY')
                    if not api_key:
                        print("❌ GOOGLE_API_KEY no encontrada")
                        latitude = longitude = None
                    else:
                        # Llamar directamente a la API de Google Maps
                        url = f"https://maps.googleapis.com/maps/api/geocode/json"
                        params = {
                            'address': search_address,
                            'key': api_key,
                            'region': 'co',
                            'language': 'es'
                        }
                        
                        response = requests.get(url, params=params)
                        data = response.json()
                        
                        if data['status'] == 'OK' and data['results']:
                            location = data['results'][0]['geometry']['location']
                            latitude = location['lat']
                            longitude = location['lng']
                            formatted_address = data['results'][0]['formatted_address']
                            print(f"📍 Coordenadas obtenidas: {latitude}, {longitude}")
                            print(f"📮 Dirección formateada: {formatted_address}")
                        else:
                            print(f"❌ No se pudo geocodificar: {data.get('status', 'Error')}")
                            latitude = longitude = None
                except Exception as e:
                    print(f"❌ Error en geocodificación: {e}")
                    latitude = longitude = None
            
            # Inicializar distance_map vacío
            distance_map = {}
            
            # Ahora aplicar filtro por distancia si tenemos coordenadas
            if latitude is not None and longitude is not None and radius is not None:
                print(f"🔍 Filtrado por distancia activado: lat={latitude}, lng={longitude}, radius={radius}m")
                from math import radians, cos, sin, asin, sqrt
                
                def calculate_distance(lat1, lng1, lat2, lng2):
                    """Calcula distancia entre dos puntos en metros usando Haversine"""
                    R = 6371000  # Radio de la Tierra en metros
                    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
                    dlat = lat2 - lat1
                    dlng = lng2 - lng1
                    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
                    c = 2 * asin(sqrt(a))
                    return round(R * c)
                
                # 1. Obtener TODAS las propiedades (sin paginación)
                all_results = session.exec(query.order_by(Property.creation_date.desc())).all()
                print(f"📊 Total propiedades antes del filtro: {len(all_results)}")
                
                # 2. Calcular distancias y filtrar
                filtered_results = []
                for prop, city in all_results:
                    if prop.latitude and prop.longitude:
                        distance = calculate_distance(latitude, longitude, prop.latitude, prop.longitude)
                        if distance <= radius:
                            # Almacenar distancia en diccionario separado
                            distance_map[prop.fr_property_id] = distance
                            filtered_results.append((prop, city))
                
                # 3. Ordenar por distancia (más cercanas primero)
                filtered_results.sort(key=lambda x: distance_map.get(x[0].fr_property_id, float('inf')))
                
                # 4. Actualizar total_count
                total_count = len(filtered_results)
                print(f"✅ Propiedades encontradas dentro de {radius}m: {total_count}")
                
                # 5. Aplicar paginación DESPUÉS del filtrado
                offset = (page - 1) * limit
                results = filtered_results[offset:offset + limit]
                
            else:
                # Sin filtro de distancia, usar lógica normal
                # Contar total para paginación usando COUNT de SQL
                from sqlmodel import func
                count_query = select(func.count(Property.fr_property_id)).outerjoin(City, Property.city_id == City.id)
                if filters:
                    count_query = count_query.where(and_(*filters))
                
                total_count = session.exec(count_query).one()
                
                # Aplicar filtros a la consulta principal solo si hay filtros
                if filters:
                    query = query.where(and_(*filters))
                
                # Aplicar paginación
                offset = (page - 1) * limit
                query = query.offset(offset).limit(limit).order_by(Property.creation_date.desc())
                
                results = session.exec(query).all()
            
            # Formatear resultados
            properties = []
            
            for prop, city in results:
                # Construir link de FincaRaiz
                finca_raiz_link = None
                if hasattr(prop, 'fr_property_id') and prop.fr_property_id:
                    finca_raiz_link = f"https://www.fincaraiz.com.co/inmueble/{prop.fr_property_id}"
                
                # Construir link de Google Maps usando coordenadas
                maps_link = None
                if prop.latitude and prop.longitude:
                    maps_link = f"https://www.google.com/maps?q={prop.latitude},{prop.longitude}"
                
                # Procesar stratum (extraer número del string "Estrato X")
                stratum_value = None
                if prop.stratum:
                    import re
                    stratum_match = re.search(r'Estrato\s*(\d+)', prop.stratum)
                    if stratum_match:
                        stratum_value = int(stratum_match.group(1))
                
                # Procesar antiquity - formatear para mostrar el rango correcto
                antiquity_display = None
                if prop.antiquity:
                    # Mapeo de strings conocidos de FincaRaíz
                    antiquity_string_map = {
                        'LESS_THAN_1_YEAR': 'Menos de 1 año',
                        'FROM_1_TO_8_YEARS': '1 a 8 años',
                        'FROM_9_TO_15_YEARS': '9 a 15 años',
                        'FROM_16_TO_30_YEARS': '16 a 30 años',
                        'MORE_THAN_30_YEARS': 'Más de 30 años',
                        'NEW': 'Menos de 1 año',
                        'TO_BE_BUILT': 'En construcción',
                        '1 a 8 años': '1 a 8 años',  # Ya está en formato correcto
                        '9 a 15 años': '9 a 15 años',
                        '16 a 30 años': '16 a 30 años',
                        'Sin especificar': 'Sin especificar',
                        'UNDEFINED': 'Sin especificar'
                    }
                    
                    if prop.antiquity in antiquity_string_map:
                        antiquity_display = antiquity_string_map[prop.antiquity]
                    else:
                        # Intentar convertir a número y asignar rango
                        try:
                            # Limpiar el string por si tiene espacios o caracteres extra
                            clean_value = str(prop.antiquity).strip()
                            years = int(clean_value)
                            
                            if years == 0:
                                antiquity_display = 'Menos de 1 año'
                            elif years <= 8:
                                antiquity_display = '1 a 8 años'
                            elif years <= 15:
                                antiquity_display = '9 a 15 años'
                            elif years <= 30:
                                antiquity_display = '16 a 30 años'
                            else:
                                antiquity_display = 'Más de 30 años'
                        except:
                            # Si no se puede procesar, mostrar el valor original
                            antiquity_display = str(prop.antiquity)
                
                # Convertir rooms, baths y garages a números si son strings
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
                
                properties.append({
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
                    "distance": distance_map.get(prop.fr_property_id, None)
                })
            
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

@app.post("/api/properties/send-excel")
async def send_properties_excel(request: dict):
    """Enviar propiedades por email en formato Excel"""
    import smtplib
    import os
    import io
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders
    from datetime import datetime
    import openpyxl
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from sqlmodel import Session, select
    from config.db_connection import engine
    from models.property import Property
    from models.city import City
    from sqlalchemy import and_, or_
    
    try:
        # Obtener parámetros del request
        email_destinatario = request.get('email')
        filters = request.get('filters', {})
        
        if not email_destinatario:
            return {"status": "error", "detail": "Email es requerido"}
        
        # Aplicar los mismos filtros que en el endpoint de properties
        with Session(engine) as session:
            query = select(Property, City).outerjoin(City, Property.city_id == City.id)
            
            # Aplicar filtros (mismo código que en get_properties)
            filter_conditions = []
            
            if filters.get('city_id'):
                filter_conditions.append(Property.city_id == filters['city_id'])
            
            if filters.get('offer_type'):
                filter_conditions.append(Property.offer == filters['offer_type'])
                
            if filters.get('min_price') is not None:
                filter_conditions.append(Property.price >= filters['min_price'])
                
            if filters.get('max_price') is not None:
                filter_conditions.append(Property.price <= filters['max_price'])
                
            if filters.get('min_area') is not None:
                filter_conditions.append(Property.area >= filters['min_area'])
                
            if filters.get('max_area') is not None:
                filter_conditions.append(Property.area <= filters['max_area'])
            
            # Filtro de habitaciones
            if filters.get('rooms') is not None:
                rooms = filters.get('rooms')
                if rooms == "unspecified":
                    filter_conditions.append(or_(
                        Property.rooms == None,
                        Property.rooms == '',
                        Property.rooms == 'N/A'
                    ))
                elif rooms.endswith('+'):
                    min_value = int(rooms[:-1])
                    from sqlalchemy import cast, Integer
                    filter_conditions.append(and_(
                        Property.rooms.regexp_match('^[0-9]+$'),
                        cast(Property.rooms, Integer) >= min_value
                    ))
                else:
                    filter_conditions.append(Property.rooms == rooms)
            
            # Filtro de baños
            if filters.get('baths') is not None:
                baths = filters.get('baths')
                if baths == "unspecified":
                    filter_conditions.append(or_(
                        Property.baths == None,
                        Property.baths == '',
                        Property.baths == 'N/A'
                    ))
                elif baths.endswith('+'):
                    min_value = int(baths[:-1])
                    from sqlalchemy import cast, Integer
                    filter_conditions.append(and_(
                        Property.baths.regexp_match('^[0-9]+$'),
                        cast(Property.baths, Integer) >= min_value
                    ))
                else:
                    filter_conditions.append(Property.baths == baths)
            
            # Filtro de garajes
            if filters.get('garages') is not None:
                garages = filters.get('garages')
                if garages == "unspecified":
                    filter_conditions.append(or_(
                        Property.garages == None,
                        Property.garages == '',
                        Property.garages == 'N/A'
                    ))
                elif garages.endswith('+'):
                    min_value = int(garages[:-1])
                    from sqlalchemy import cast, Integer
                    filter_conditions.append(and_(
                        Property.garages.regexp_match('^[0-9]+$'),
                        cast(Property.garages, Integer) >= min_value
                    ))
                else:
                    filter_conditions.append(Property.garages == garages)
            
            # Filtro de estrato
            if filters.get('stratum') is not None:
                stratum = filters.get('stratum')
                if stratum == "unspecified":
                    filter_conditions.append(or_(
                        Property.stratum == None,
                        Property.stratum == '',
                        Property.stratum == 'Sin especificar'
                    ))
                else:
                    stratum_str = f"Estrato {stratum}"
                    filter_conditions.append(Property.stratum == stratum_str)
            
            # Filtro de antigüedad
            min_antiquity = filters.get('min_antiquity')
            max_antiquity = filters.get('max_antiquity')
            antiquity_filter = filters.get('antiquity_filter')
            
            if min_antiquity is not None and max_antiquity is not None:
                antiquity_conditions = []
                
                if min_antiquity == 0 and max_antiquity == 0:
                    # Menos de 1 año
                    antiquity_conditions.extend([
                        Property.antiquity == 'LESS_THAN_1_YEAR',
                        Property.antiquity == 'Menos de 1 año',
                        Property.antiquity == '0'
                    ])
                elif min_antiquity == 1 and max_antiquity == 8:
                    # 1 a 8 años
                    antiquity_conditions.extend([
                        Property.antiquity == 'FROM_1_TO_8_YEARS',
                        Property.antiquity == '1 a 8 años'
                    ])
                    # Agregar valores numéricos del 1 al 8
                    for i in range(1, 9):
                        antiquity_conditions.append(Property.antiquity == str(i))
                        antiquity_conditions.append(Property.antiquity == i)
                elif min_antiquity == 9 and max_antiquity == 15:
                    # 9 a 15 años
                    antiquity_conditions.extend([
                        Property.antiquity == 'FROM_9_TO_15_YEARS',
                        Property.antiquity == '9 a 15 años'
                    ])
                    # Agregar valores numéricos del 9 al 15
                    for i in range(9, 16):
                        antiquity_conditions.append(Property.antiquity == str(i))
                        antiquity_conditions.append(Property.antiquity == i)
                elif min_antiquity == 16 and max_antiquity == 30:
                    # 16 a 30 años
                    antiquity_conditions.extend([
                        Property.antiquity == 'FROM_16_TO_30_YEARS',
                        Property.antiquity == '16 a 30 años'
                    ])
                    # Agregar valores numéricos del 16 al 30
                    for i in range(16, 31):
                        antiquity_conditions.append(Property.antiquity == str(i))
                        antiquity_conditions.append(Property.antiquity == i)
                elif min_antiquity == 31:
                    # Más de 30 años
                    antiquity_conditions.append(Property.antiquity == 'MORE_THAN_30_YEARS')
                    # Agregar valores numéricos mayores a 30
                    for i in range(31, 100):
                        antiquity_conditions.append(Property.antiquity == str(i))
                        antiquity_conditions.append(Property.antiquity == i)
                
                if antiquity_conditions:
                    filter_conditions.append(or_(*antiquity_conditions))
            elif antiquity_filter == 'unspecified':
                # Filtrar solo propiedades sin especificar antigüedad
                filter_conditions.append(or_(
                    Property.antiquity == 'UNDEFINED',
                    Property.antiquity == 'Sin especificar',
                    Property.antiquity == None
                ))
            
            # Filtro de tipo de propiedad
            if filters.get('property_type'):
                property_type = filters.get('property_type')
                property_type_lower = property_type.lower()
                if property_type_lower == "apartamento":
                    filter_conditions.append(or_(
                        Property.title.ilike("%apartamento%"),
                        Property.title.ilike("%apto%")
                    ))
                elif property_type_lower == "casa":
                    filter_conditions.append(and_(
                        Property.title.ilike("%casa%"),
                        ~Property.title.ilike("%apartamento%"),
                        ~Property.title.ilike("%apto%")
                    ))
                elif property_type_lower == "oficina":
                    filter_conditions.append(Property.title.ilike("%oficina%"))
                elif property_type_lower == "local":
                    filter_conditions.append(Property.title.ilike("%local%"))
                elif property_type_lower == "lote":
                    filter_conditions.append(or_(
                        Property.title.ilike("%lote%"),
                        Property.title.ilike("%terreno%")
                    ))
            
            # Filtro de fechas de actualización
            if filters.get('updated_date_from'):
                from datetime import datetime
                date_from = datetime.strptime(filters.get('updated_date_from'), '%Y-%m-%d').date()
                filter_conditions.append(Property.last_update >= date_from)
            
            if filters.get('updated_date_to'):
                from datetime import datetime
                date_to = datetime.strptime(filters.get('updated_date_to'), '%Y-%m-%d').date()
                filter_conditions.append(Property.last_update <= date_to)
            
            if filter_conditions:
                query = query.where(and_(*filter_conditions))
            
            # Obtener propiedades
            results = session.exec(query.order_by(Property.creation_date.desc())).all()
            
            # Procesar filtro de distancia si está presente
            distance_map = {}
            search_lat = filters.get('latitude')
            search_lng = filters.get('longitude')
            radius = filters.get('radius')
            
            if search_lat is not None and search_lng is not None and radius is not None:
                print(f"🔍 Procesando filtro de distancia para Excel: lat={search_lat}, lng={search_lng}, radius={radius}m")
                from math import radians, cos, sin, asin, sqrt
                
                def calculate_distance(lat1, lng1, lat2, lng2):
                    """Calcula distancia entre dos puntos en metros usando Haversine"""
                    R = 6371000  # Radio de la Tierra en metros
                    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
                    dlat = lat2 - lat1
                    dlng = lng2 - lng1
                    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
                    c = 2 * asin(sqrt(a))
                    return round(R * c)
                
                # Filtrar y calcular distancias - SOLO incluir propiedades dentro del radio
                filtered_results = []
                for prop, city in results:
                    if prop.latitude and prop.longitude:
                        distance = calculate_distance(search_lat, search_lng, prop.latitude, prop.longitude)
                        if distance <= radius:
                            distance_map[prop.fr_property_id] = distance
                            filtered_results.append((prop, city))
                    # NO incluir propiedades sin coordenadas cuando hay filtro de distancia
                
                # Ordenar por distancia (más cercanas primero)
                filtered_results.sort(key=lambda x: distance_map.get(x[0].fr_property_id, float('inf')))
                results = filtered_results
                print(f"✅ Propiedades filtradas por distancia: {len(results)}")
            
            # Función para formatear antigüedad
            def format_antiquity(antiquity_value):
                """Convierte valores de antigüedad a formato español estándar"""
                if not antiquity_value:
                    return "Sin especificar"
                
                # Diccionario de mapeo de strings en inglés
                english_to_spanish = {
                    'LESS_THAN_1_YEAR': '1',
                    'FROM_1_TO_8_YEARS': '2', 
                    'FROM_9_TO_15_YEARS': '3',
                    'FROM_16_TO_30_YEARS': '4',
                    'MORE_THAN_30_YEARS': '5',
                    'UNDEFINED': 'Sin especificar'
                }
                
                # Diccionario de mapeo de IDs numéricos
                id_to_spanish = {
                    1: "Menos de 1 año",
                    2: "1 a 8 años", 
                    3: "9 a 15 años",
                    4: "16 a 30 años",
                    5: "Más de 30 años"
                }
                
                # Convertir a string para procesamiento
                antiquity_str = str(antiquity_value).strip()
                
                # Si es un string en inglés, convertir a ID
                if antiquity_str in english_to_spanish:
                    mapped_value = english_to_spanish[antiquity_str]
                    if mapped_value == 'Sin especificar':
                        return mapped_value
                    antiquity_str = mapped_value
                
                # Si es un número o string numérico, convertir a español
                try:
                    antiquity_id = int(antiquity_str)
                    return id_to_spanish.get(antiquity_id, "Sin especificar")
                except ValueError:
                    # Si no es numérico y no está en el mapeo, verificar si contiene palabras clave
                    antiquity_lower = antiquity_str.lower()
                    if any(word in antiquity_lower for word in ['sin especificar', 'undefined', 'n/a', 'none']):
                        return "Sin especificar"
                    # Si contiene texto español ya formateado, devolverlo tal como está
                    return antiquity_str

            # Crear archivo Excel
            wb = Workbook()
            ws = wb.active
            ws.title = "Propiedades"
            
            # Encabezados con estilo
            headers = [
                'ID', 'Título', 'Ciudad', 'Tipo', 'Precio (COP)', 
                'Área (m²)', 'Habitaciones', 'Baños', 'Garajes', 
                'Estrato', 'Antigüedad', 'Distancia (m)', 'Fecha Creación', 
                'Última Actualización', 'FincaRaiz', 'Google Maps'
            ]
            
            # Aplicar estilos a los encabezados
            header_font = Font(bold=True, color="FFFFFF")
            header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
            
            for col, header in enumerate(headers, 1):
                cell = ws.cell(row=1, column=col, value=header)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = Alignment(horizontal="center", vertical="center")
            
            # Verificar límite razonable para Excel (optimización)
            if len(results) > 50000:
                return {"status": "error", "detail": f"Demasiadas propiedades ({len(results):,}). El límite para Excel es 50,000 propiedades. Aplica más filtros."}
            
            print(f"📊 Generando Excel con {len(results):,} propiedades...")
            
            # Agregar datos en lotes para mejor rendimiento
            batch_size = 1000
            total_batches = (len(results) + batch_size - 1) // batch_size
            
            for batch_num in range(total_batches):
                start_idx = batch_num * batch_size
                end_idx = min(start_idx + batch_size, len(results))
                batch = results[start_idx:end_idx]
                
                print(f"📝 Procesando lote {batch_num + 1}/{total_batches} ({len(batch)} propiedades)")
                
                for i, (prop, city) in enumerate(batch):
                    row_idx = start_idx + i + 2  # +2 porque empezamos en fila 2 (después del header)
                    ws.cell(row=row_idx, column=1, value=prop.fr_property_id)
                    ws.cell(row=row_idx, column=2, value=prop.title)
                    ws.cell(row=row_idx, column=3, value=city.name if city else "Sin especificar")
                    ws.cell(row=row_idx, column=4, value="Venta" if prop.offer == "sell" else "Renta")
                    ws.cell(row=row_idx, column=5, value=prop.price)
                    ws.cell(row=row_idx, column=6, value=prop.area)
                    ws.cell(row=row_idx, column=7, value=prop.rooms)
                    ws.cell(row=row_idx, column=8, value=prop.baths)
                    ws.cell(row=row_idx, column=9, value=prop.garages)
                    ws.cell(row=row_idx, column=10, value=prop.stratum)
                    ws.cell(row=row_idx, column=11, value=format_antiquity(prop.antiquity))
                    
                    # Agregar distancia (columna 12)
                    distance = distance_map.get(prop.fr_property_id, None)
                    if distance is not None:
                        ws.cell(row=row_idx, column=12, value=f"{distance:,} m")
                    else:
                        ws.cell(row=row_idx, column=12, value="")
                    
                    ws.cell(row=row_idx, column=13, value=prop.creation_date.isoformat() if prop.creation_date else "")
                    ws.cell(row=row_idx, column=14, value=prop.last_update.isoformat() if prop.last_update else "")
                    
                    # Agregar hipervínculo de FincaRaiz
                    if prop.fr_property_id:
                        cell = ws.cell(row=row_idx, column=15)
                        cell.hyperlink = f"https://www.fincaraiz.com.co/inmueble/{prop.fr_property_id}"
                        cell.value = "Ver en FincaRaiz"
                        cell.style = "Hyperlink"
                    else:
                        ws.cell(row=row_idx, column=15, value="")
                    
                    # Agregar hipervínculo de Google Maps
                    if prop.latitude and prop.longitude:
                        cell = ws.cell(row=row_idx, column=16)
                        cell.hyperlink = f"https://www.google.com/maps?q={prop.latitude},{prop.longitude}"
                        cell.value = "Ver en Maps"
                        cell.style = "Hyperlink"
                    else:
                        ws.cell(row=row_idx, column=16, value="")
            
            # Ajustar ancho de columnas con valores predefinidos (más rápido)
            column_widths = {
                'A': 12,  # ID
                'B': 40,  # Título  
                'C': 15,  # Ciudad
                'D': 10,  # Tipo
                'E': 15,  # Precio
                'F': 12,  # Área
                'G': 12,  # Habitaciones
                'H': 8,   # Baños
                'I': 8,   # Garajes
                'J': 8,   # Estrato
                'K': 15,  # Antigüedad
                'L': 15,  # Distancia
                'M': 12,  # Fecha Creación
                'N': 12,  # Última Actualización
                'O': 15,  # FincaRaiz
                'P': 15   # Google Maps
            }
            
            for col_letter, width in column_widths.items():
                ws.column_dimensions[col_letter].width = width
            
            # Guardar Excel en memoria
            excel_file = io.BytesIO()
            wb.save(excel_file)
            excel_file.seek(0)
            
            # Enviar email
            print(f"📧 Enviando email a {email_destinatario}...")
            
            # Configuración del servidor SMTP
            smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            smtp_user = os.getenv("SMTP_USER")
            smtp_password = os.getenv("SMTP_PASSWORD")
            from_email = os.getenv("FROM_EMAIL", smtp_user)
            
            if not smtp_user or not smtp_password:
                return {"status": "error", "detail": "Credenciales SMTP no configuradas"}
            
            # Crear mensaje
            msg = MIMEMultipart()
            msg['From'] = from_email
            msg['To'] = email_destinatario
            msg['Cc'] = from_email
            msg['Subject'] = f"Dashboard Scraper - Propiedades Exportadas"
            
            # Cuerpo del correo
            # Agregar información de búsqueda por dirección si aplica
            address_info = ""
            if search_lat is not None and search_lng is not None and filters.get('search_address'):
                address_info = f"\n• Propiedad consultada: {filters.get('search_address')}"
                if radius:
                    address_info += f"\n• Radio de búsqueda: {radius:,} metros"
            
            body = f"""Dashboard Scraper - Propiedades

Adjunto encontrarás el archivo Excel con las propiedades solicitadas.

Resumen:
• Total de propiedades exportadas: {len(results)}
• Fecha de exportación: {get_local_now().strftime("%d/%m/%Y %H:%M")}{address_info}

El archivo Excel contiene información detallada de cada propiedad incluyendo:
• Información básica (título, ciudad, tipo)
• Detalles de precio y características  
• Enlaces directos a FincaRaiz
• Coordenadas geográficas

Si tienes alguna pregunta, no dudes en contactarnos.

Saludos cordiales,
Equipo de Avalúos"""
            
            msg.attach(MIMEText(body, 'plain'))
            
            # Adjuntar Excel
            filename = f"propiedades_{get_local_now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            attachment = MIMEBase('application', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            attachment.set_payload(excel_file.read())
            encoders.encode_base64(attachment)
            attachment.add_header('Content-Disposition', f'attachment; filename={filename}')
            msg.attach(attachment)
            
            # Enviar correo
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
            
            print(f"✅ Email enviado exitosamente a {email_destinatario}")
            
            return {
                "status": "success",
                "message": f"Excel enviado exitosamente a {email_destinatario}",
                "properties_count": len(results)
            }
            
    except Exception as e:
        print(f"❌ Error enviando email: {e}")
        return {"status": "error", "detail": str(e)}

@app.get("/api/cities/list")
async def get_cities_list():
    """Obtener lista de ciudades para filtros"""
    from sqlmodel import Session, select
    from config.db_connection import engine
    from models.city import City
    
    try:
        with Session(engine) as session:
            cities_query = select(City.id, City.name).order_by(City.name)
            cities = session.exec(cities_query).all()
            
            return {
                "status": "success",
                "data": [
                    {"id": city_id, "name": city_name}
                    for city_id, city_name in cities
                ]
            }
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@app.get("/health")
async def health():
    """Endpoint simple para healthcheck de Docker"""
    return {"status": "healthy", "timestamp": get_local_now()}

@app.get("/api/health")
async def api_health():
    """Endpoint de health con más detalles para la API"""
    return {"status": "healthy", "timestamp": get_local_now()}

@app.get("/")
async def root():
    return {"message": "Dashboard API is running", "timestamp": get_local_now()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)