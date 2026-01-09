"""
Servicio de estadísticas reutilizable
"""
from datetime import datetime, timedelta
from sqlmodel import select, func
from sqlalchemy import text
import pytz

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


def get_recent_logs(session, limit: int = 10):
    """Obtener logs recientes de la tabla scraper_logs"""
    from models.scraper_log import ScraperLog
    
    try:
        recent_logs_query = select(ScraperLog).order_by(ScraperLog.timestamp.desc()).limit(limit)
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
        print(f"Error getting recent logs: {e}")
        return []


def get_next_executions(session, limit: int = 5):
    """Obtener próximas ejecuciones basadas en lógica de orden alfabético"""
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
        
        next_execution_time = now.replace(second=0, microsecond=0)
        if next_execution_time.minute < 30:
            next_execution_time = next_execution_time.replace(minute=30)
        else:
            next_execution_time = next_execution_time.replace(minute=30) + timedelta(hours=1)
        
        execution_count = 0
        for city_row in cities_result:
            if execution_count >= limit:
                break
                
            name, website_name, sell_offset, sell_limit, rent_offset, rent_limit, updated = city_row
            
            sell_completed = sell_offset >= sell_limit if sell_limit > 0 else True
            rent_completed = rent_offset >= rent_limit if rent_limit > 0 else True
            
            if website_name == current_city_code:
                if current_offer_type == "sell" and not sell_completed:
                    executions.append({
                        "city": name,
                        "type": "sell",
                        "scheduled_time": next_execution_time.isoformat(),
                        "minutes_remaining": int((next_execution_time - now).total_seconds() / 60)
                    })
                    next_execution_time += timedelta(hours=1)
                    execution_count += 1
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
            
            if not sell_completed:
                executions.append({
                    "city": name,
                    "type": "sell",
                    "scheduled_time": next_execution_time.isoformat(),
                    "minutes_remaining": int((next_execution_time - now).total_seconds() / 60)
                })
                next_execution_time += timedelta(hours=1)
                execution_count += 1
                
                if execution_count >= limit:
                    break
            
            if sell_completed and not rent_completed:
                executions.append({
                    "city": name,
                    "type": "rent",
                    "scheduled_time": next_execution_time.isoformat(),
                    "minutes_remaining": int((next_execution_time - now).total_seconds() / 60)
                })
                next_execution_time += timedelta(hours=1)
                execution_count += 1
        
        if not executions:
            executions.append({
                "city": "Sistema",
                "type": "info",
                "scheduled_time": next_execution_time.isoformat(),
                "minutes_remaining": int((next_execution_time - now).total_seconds() / 60)
            })
        
        return executions
        
    except Exception as e:
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
    from models.property import Property
    
    try:
        today = get_local_now().date()
        
        if city_id:
            total_query = select(func.count(Property.fr_property_id)).where(Property.city_id == city_id)
            today_query = select(func.count(Property.fr_property_id)).where(
                Property.city_id == city_id,
                Property.creation_date == today
            )
        else:
            total_query = select(func.count(Property.fr_property_id))
            today_query = select(func.count(Property.fr_property_id)).where(Property.creation_date == today)
        
        total_properties = session.exec(total_query).first() or 0
        today_properties = session.exec(today_query).first() or 0
        
        return total_properties, today_properties
    except Exception as e:
        print(f"Error getting property stats: {e}")
        return 0, 0


def get_avg_speed(session):
    """Calcular páginas por minuto desde PAGE_NAVIGATION logs"""
    from models.scraper_log import ScraperLog
    
    try:
        yesterday = get_local_now() - timedelta(hours=24)
        
        page_count_query = select(func.count(ScraperLog.id)).where(
            ScraperLog.timestamp >= yesterday,
            ScraperLog.log_type == "PAGE_NAVIGATION"
        )
        
        page_count = session.exec(page_count_query).first()
        
        if page_count and page_count > 0:
            pages_per_minute = page_count / 1440
            return round(float(pages_per_minute), 2)
        else:
            return 0.0
    except Exception as e:
        print(f"Error calculating pages per minute: {e}")
        return 0.0


def get_last_execution_time(session):
    """Obtener tiempo desde la última ejecución"""
    try:
        query = text("SELECT MAX(timestamp) FROM scraper_logs")
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
    """Obtener conteo de errores en las últimas 24h"""
    try:
        yesterday = get_local_now() - timedelta(hours=24)
        
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
        return 0


def get_system_alerts(session):
    """Obtener alertas del sistema desde scraper_logs"""
    try:
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
        level_map = {
            'error': 'critical',
            'warning': 'warning',
            'info': 'info',
            'success': 'info',
            'debug': 'info'
        }
        
        for row in rows:
            level, city_name, offer_type, message, timestamp = row
            mapped_level = level_map.get(level.lower() if level else 'info', 'info')
            
            offer_display = ""
            if offer_type:
                offer_display = "Venta" if offer_type.lower() == "sell" else "Renta" if offer_type.lower() == "rent" else offer_type
                offer_display = f" [{offer_display}]"
            
            city_display = f"{city_name}{offer_display}"
            
            alerts.append({
                "level": mapped_level,
                "city": city_display,
                "message": message or f"Log de tipo {level}",
                "timestamp": timestamp.isoformat() if timestamp else get_local_now().isoformat()
            })
        
        if not alerts:
            alerts.append({
                "level": "info",
                "city": "Sistema",
                "message": "No hay logs disponibles en el sistema",
                "timestamp": get_local_now().isoformat()
            })
        
        return alerts
        
    except Exception as e:
        return [{
            "level": "warning",
            "city": "Sistema",
            "message": f"Error obteniendo alertas: {str(e)}",
            "timestamp": get_local_now().isoformat()
        }]
