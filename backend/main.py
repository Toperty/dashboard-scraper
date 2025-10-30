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
    """Obtener velocidad promedio real de scraper_logs"""
    from sqlmodel import select, func
    from models.scraper_log import ScraperLog
    from datetime import datetime, timedelta
    
    try:
        # Promedio de execution_time_ms de las últimas 24 horas
        yesterday = get_local_now() - timedelta(hours=24)
        
        avg_query = select(func.avg(ScraperLog.execution_time_ms)).where(
            ScraperLog.timestamp >= yesterday,
            ScraperLog.execution_time_ms.is_not(None)
        )
        
        avg_speed = session.exec(avg_query).first()
        return round(float(avg_speed), 1) if avg_speed else 3200.0
    except Exception as e:
        return 3200.0

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
                        "avg_speed_ms": avg_speed
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
    rooms: int = None
):
    """Obtener propiedades con filtros y paginación"""
    from sqlmodel import Session, select
    from config.db_connection import engine
    from models.property import Property
    from models.city import City
    from sqlalchemy import and_, or_
    
    try:
        with Session(engine) as session:
            # Query base con join a city
            query = select(Property, City).join(City, Property.city_id == City.id)
            
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
                filters.append(Property.rooms == rooms)
            
            if filters:
                query = query.where(and_(*filters))
            
            # Contar total para paginación
            count_query = select(Property).join(City, Property.city_id == City.id)
            if filters:
                count_query = count_query.where(and_(*filters))
            
            total_count = len(session.exec(count_query).all())
            
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
                
                properties.append({
                    "id": prop.fr_property_id,
                    "city": city.name,
                    "area": prop.area,
                    "rooms": prop.rooms,
                    "price": prop.price,
                    "offer_type": "Venta" if prop.offer == "sell" else "Renta",
                    "creation_date": prop.creation_date.isoformat() if prop.creation_date else None,
                    "last_update": prop.last_update.isoformat() if prop.last_update else None,
                    "title": prop.title,
                    "finca_raiz_link": finca_raiz_link,
                    "maps_link": maps_link,
                    "latitude": prop.latitude,
                    "longitude": prop.longitude
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

@app.get("/api/health")
async def health():
    return {"status": "healthy", "timestamp": get_local_now()}

@app.get("/")
async def root():
    return {"message": "Dashboard API is running", "timestamp": get_local_now()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)