"""
Router de Dashboard - Endpoints del panel principal
"""
from fastapi import APIRouter
from sqlmodel import Session, select, func
from config.db_connection import engine
from models.city import City
from models.property import Property
from services.stats_service import (
    get_local_now, get_city_status, get_recent_logs, get_next_executions,
    get_property_stats, get_avg_speed, get_last_execution_time,
    get_recent_errors_count, get_system_alerts
)
from datetime import timedelta

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
async def get_dashboard():
    """Dashboard con datos REALES de BD"""
    try:
        with Session(engine) as session:
            cities = session.exec(select(City).order_by(City.name)).all()
            
            # Estadísticas globales
            total_properties_global, today_properties_global = get_property_stats(session)
            avg_speed = get_avg_speed(session)
            
            # Propiedades actualizadas hoy
            today = get_local_now().date()
            updated_today_query = select(func.count(Property.fr_property_id)).where(Property.last_update == today)
            properties_updated_today = session.exec(updated_today_query).first() or 0
            
            city_data = []
            for city in cities:
                # Calcular páginas procesadas
                sell_pages_processed = city.current_sell_offset // 25 if city.current_sell_offset > 0 else 0
                rent_pages_processed = city.current_rent_offset // 25 if city.current_rent_offset > 0 else 0
                
                sell_pages_processed = min(sell_pages_processed, city.sell_pages_limit)
                rent_pages_processed = min(rent_pages_processed, city.rent_pages_limit)
                
                sell_progress = min((sell_pages_processed / city.sell_pages_limit * 100), 100.0) if city.sell_pages_limit > 0 else 0
                rent_progress = min((rent_pages_processed / city.rent_pages_limit * 100), 100.0) if city.rent_pages_limit > 0 else 0
                
                total_properties_city, today_properties_city = get_property_stats(session, city.id)
                
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
                        "properties_updated_today": (properties_updated_today - today_properties_global),
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


@router.get("/summary")
async def get_summary_with_changes():
    """Obtener resumen con cambios porcentuales"""
    try:
        with Session(engine) as session:
            today = get_local_now().date()
            yesterday = today - timedelta(days=1)
            
            today_properties_query = select(func.count(Property.fr_property_id)).where(Property.creation_date == today)
            yesterday_properties_query = select(func.count(Property.fr_property_id)).where(Property.creation_date == yesterday)
            
            today_count = session.exec(today_properties_query).first() or 0
            yesterday_count = session.exec(yesterday_properties_query).first() or 0
            
            properties_change = 0
            if yesterday_count > 0:
                properties_change = round(((today_count - yesterday_count) / yesterday_count) * 100, 1)
            
            cities_query = select(City)
            cities = session.exec(cities_query).all()
            
            total_cities = len(cities)
            active_cities = len([c for c in cities if not c.updated])
            
            week_ago = today - timedelta(days=7)
            total_properties_query = select(func.count(Property.fr_property_id))
            week_ago_query = select(func.count(Property.fr_property_id)).where(Property.creation_date <= week_ago)
            
            total_properties = session.exec(total_properties_query).first() or 0
            week_ago_total = session.exec(week_ago_query).first() or 0
            
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
                        "cities_change": 0,
                        "total_change": total_change
                    }
                }
            }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "message": "Backend is running"}


@router.get("/cities/list")
async def get_cities_list():
    """Obtener lista de ciudades para filtros"""
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
