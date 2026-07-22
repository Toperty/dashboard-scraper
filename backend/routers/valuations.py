"""
Router de Avalúos - Endpoints de valuaciones de propiedades
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from sqlmodel import Session, select
from config.db_connection import engine
from models.valuation import Valuation
from models.payment_plan_dashboard import PaymentPlanDashboard
from services.stats_service import get_local_now

router = APIRouter(prefix="/api", tags=["valuations"])


class PropertyValuationRequest(BaseModel):
    area: float
    rooms: int
    baths: int
    garages: int
    stratum: int
    latitude: float
    longitude: float
    antiquity: int
    is_new: str
    area_per_room: float
    age_bucket: str
    has_garage: int
    city_id: str
    property_type: int


class SaveValuationRequest(BaseModel):
    valuation_name: str
    area: float
    property_type: int
    rooms: int
    baths: int
    garages: int
    stratum: int
    antiquity: int
    latitude: float
    longitude: float
    capitalization_rate: Optional[float] = None
    sell_price_per_sqm: Optional[float] = None
    rent_price_per_sqm: Optional[float] = None
    total_sell_price: Optional[float] = None
    total_rent_price: Optional[float] = None
    final_price: Optional[float] = None


# Categóricas que los modelos LightGBM tratan como tales (deben coincidir con
# ml_models/train.py). LightGBM re-mapea a las categorías de entrenamiento
# guardadas en el modelo (pandas_categorical) al predecir.
CATEGORICAL_FEATURES = ["is_new", "age_bucket", "city_id"]

# --- Alineación frontend → categorías de entrenamiento -----------------------
# El formulario del avalúo manda representaciones distintas a las que aprendió
# el modelo. Sin normalizar, LightGBM las trata como categoría desconocida y
# pierde la feature (city_id pesa ~17% en renta y ~26% en venta). Traducimos
# aquí, en el serving, para que la señal se use de verdad.
_AGE_BUCKET_TRAIN = {"menos_1_ano", "1_a_8_anos", "9_a_15_anos",
                     "16_a_30_anos", "mas_30_anos", "sin_especificar"}
_AGE_BUCKET_MAP = {           # etiquetas del formulario → bucket de entrenamiento
    "0-1": "menos_1_ano", "1-8": "1_a_8_anos", "9-15": "9_a_15_anos",
    "16-30": "16_a_30_anos", "30+": "mas_30_anos", "": "sin_especificar",
}
_IS_NEW_TRUE = {"si", "sí", "yes", "true", "1", "nuevo"}

# Centroides (lat/lon medianos por city_id) para derivar la ciudad desde las
# coordenadas — el formulario no permite elegir ciudad, pero sí trae lat/lon.
_CENTROIDS = None


def _load_centroids():
    global _CENTROIDS
    if _CENTROIDS is None:
        import os
        import json
        path = os.path.join(os.path.dirname(__file__), '..', 'ml_models', 'city_centroids.json')
        try:
            with open(path) as f:
                raw = json.load(f)
            _CENTROIDS = [(cid, v["lat"], v["lon"]) for cid, v in raw.items()]
        except (OSError, ValueError):
            _CENTROIDS = []
    return _CENTROIDS


def _city_id_from_latlon(lat, lon):
    """city_id de la ciudad cuyo centroide está más cerca (o None si no aplica)."""
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        return None
    # solo dentro de Colombia (evita coords inválidas/0,0)
    if not (-5 <= lat <= 15 and -82 <= lon <= -66):
        return None
    best, best_d = None, None
    for cid, clat, clon in _load_centroids():
        d = (lat - clat) ** 2 + (lon - clon) ** 2
        if best_d is None or d < best_d:
            best, best_d = cid, d
    return best


def _normalize_categoricals(pd_data):
    """Traduce los categóricos del formulario a como fueron entrenados (in place)."""
    # city_id: preferimos derivarlo de lat/lon (el formulario siempre manda "1");
    # el modelo entrenó con city_id como float-string ("1" -> "1.0").
    derived = _city_id_from_latlon(pd_data.get("latitude"), pd_data.get("longitude"))
    cid = derived if derived is not None else pd_data.get("city_id")
    if cid is not None and str(cid).strip() != "":
        try:
            pd_data["city_id"] = str(float(cid))
        except (TypeError, ValueError):
            pd_data["city_id"] = str(cid)
    # age_bucket: acepta el valor ya correcto o traduce la etiqueta del formulario
    ab = str(pd_data.get("age_bucket", "") or "").strip()
    if ab in _AGE_BUCKET_TRAIN:
        pd_data["age_bucket"] = ab
    else:
        pd_data["age_bucket"] = _AGE_BUCKET_MAP.get(ab, "sin_especificar")
    # is_new: "si"/"no" (o boolean) -> "true"/"false"
    pd_data["is_new"] = "true" if str(pd_data.get("is_new", "")).strip().lower() in _IS_NEW_TRUE else "false"
    return pd_data

# Cache de modelos a nivel de módulo: los archivos (~10-12 MB) se cargan y
# parsean una sola vez, no en cada request.
_MODELS = {}


def _load_models():
    """Carga (y cachea) los modelos LightGBM de renta y venta + orden de features."""
    if _MODELS:
        return _MODELS

    import lightgbm as lgb
    import os
    import json

    base_path = os.path.join(os.path.dirname(__file__), '..', 'ml_models')
    metadata_path = os.path.join(base_path, 'metadata.json')

    default_order = ['area', 'rooms', 'baths', 'garages', 'stratum', 'latitude',
                     'longitude', 'antiquity', 'is_new', 'area_per_room',
                     'age_bucket', 'has_garage', 'city_id', 'property_type']
    metadata = {}
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

    for offer, filename in (('rent', 'model_rent_lightgbm.txt'),
                            ('sell', 'model_sell_lightgbm.txt')):
        model_path = os.path.join(base_path, filename)
        features = metadata.get(offer, {}).get('lightgbm', {}).get('features') or default_order
        model = None
        if os.path.exists(model_path):
            with open(model_path, 'r') as f:
                model = lgb.Booster(model_str=f.read())
        _MODELS[offer] = {'model': model, 'features': features}

    return _MODELS


def _predict_price_per_sqm(bundle, processed_data):
    """Predice precio/m² con un modelo LightGBM (target = log1p, se aplica expm1)."""
    import pandas as pd
    import numpy as np

    df = pd.DataFrame([processed_data])[bundle['features']]
    for cat in CATEGORICAL_FEATURES:
        if cat in df.columns:
            df[cat] = pd.Categorical(df[cat].astype(str))
    pred = bundle['model'].predict(df)[0]
    return float(np.expm1(pred))


@router.post("/valuation")
async def calculate_valuation(data: PropertyValuationRequest):
    """Calcular avalúo de propiedad usando modelos ML (LightGBM renta y venta)"""
    try:
        processed_data = {
            'area': data.area,
            'rooms': data.rooms,
            'baths': data.baths,
            'garages': data.garages,
            'stratum': data.stratum,
            'latitude': data.latitude,
            'longitude': data.longitude,
            'antiquity': data.antiquity,
            'is_new': data.is_new,
            'area_per_room': data.area_per_room,
            'age_bucket': data.age_bucket,
            'has_garage': data.has_garage,
            'city_id': data.city_id,
            'property_type': data.property_type
        }

        # Copia normalizada para el modelo (categóricos alineados con el
        # entrenamiento); processed_data queda intacto para el eco de la respuesta.
        model_input = _normalize_categoricals(dict(processed_data))

        models = _load_models()
        results = {}

        # Modelo de renta (LightGBM)
        if models.get('rent', {}).get('model') is not None:
            try:
                rent_price = _predict_price_per_sqm(models['rent'], model_input)
                results['rent_price_per_sqm'] = round(rent_price, 2)
                results['total_rent_price'] = round(rent_price * data.area, 2)
            except Exception as e:
                results['rent_error'] = str(e)
                print(f"Error modelo renta: {e}")

        # Modelo de venta (LightGBM)
        if models.get('sell', {}).get('model') is not None:
            try:
                sell_price = _predict_price_per_sqm(models['sell'], model_input)
                results['sell_price_per_sqm'] = round(sell_price, 2)
                results['total_sell_price'] = round(sell_price * data.area, 2)
            except Exception as e:
                results['sell_error'] = str(e)
                print(f"Error modelo venta: {e}")

        return {
            "status": "success",
            "message": "Avalúo realizado exitosamente",
            "data": {
                "property_info": processed_data,
                "valuation_results": results
            }
        }

    except Exception as e:
        print(f"Error en avalúo: {e}")
        return {"status": "error", "message": str(e), "data": None}


@router.post("/save-valuation")
async def save_valuation(data: SaveValuationRequest):
    """Guardar o actualizar avalúo"""
    try:
        with Session(engine) as session:
            # Verificar si ya existe
            existing = session.exec(
                select(Valuation).where(Valuation.valuation_name == data.valuation_name)
            ).first()
            
            if existing:
                # Actualizar existente
                existing.area = data.area
                existing.property_type = data.property_type
                existing.rooms = data.rooms
                existing.baths = data.baths
                existing.garages = data.garages
                existing.stratum = data.stratum
                existing.antiquity = data.antiquity
                existing.latitude = data.latitude
                existing.longitude = data.longitude
                existing.capitalization_rate = data.capitalization_rate
                existing.sell_price_per_sqm = data.sell_price_per_sqm
                existing.rent_price_per_sqm = data.rent_price_per_sqm
                existing.total_sell_price = data.total_sell_price
                existing.total_rent_price = data.total_rent_price
                existing.final_price = data.final_price
                existing.updated_at = get_local_now()
                
                session.add(existing)
                session.commit()
                
                return {
                    "status": "success",
                    "message": f"Avalúo '{data.valuation_name}' actualizado exitosamente",
                    "action": "updated",
                    "id": existing.id
                }
            else:
                # Crear nuevo
                new_valuation = Valuation(
                    valuation_name=data.valuation_name,
                    area=data.area,
                    property_type=data.property_type,
                    rooms=data.rooms,
                    baths=data.baths,
                    garages=data.garages,
                    stratum=data.stratum,
                    antiquity=data.antiquity,
                    latitude=data.latitude,
                    longitude=data.longitude,
                    capitalization_rate=data.capitalization_rate,
                    sell_price_per_sqm=data.sell_price_per_sqm,
                    rent_price_per_sqm=data.rent_price_per_sqm,
                    total_sell_price=data.total_sell_price,
                    total_rent_price=data.total_rent_price,
                    final_price=data.final_price
                )
                
                session.add(new_valuation)
                session.commit()
                session.refresh(new_valuation)
                
                return {
                    "status": "success",
                    "message": f"Avalúo '{data.valuation_name}' guardado exitosamente",
                    "action": "created",
                    "id": new_valuation.id
                }
                
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/valuations")
async def get_valuations(
    page: int = 1, 
    limit: int = 10,
    search_name: Optional[str] = None,
    property_type: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None
):
    """Obtener lista de avalúos con paginación y filtros"""
    try:
        with Session(engine) as session:
            from sqlmodel import func, and_
            from datetime import datetime
            
            # Construir query base con filtros
            conditions = []
            
            if search_name:
                # Usar ilike para búsqueda insensible a mayúsculas/minúsculas
                conditions.append(Valuation.valuation_name.ilike(f'%{search_name}%'))
            
            if property_type is not None:
                conditions.append(Valuation.property_type == property_type)
            
            if date_from:
                try:
                    date_from_obj = datetime.fromisoformat(date_from)
                    conditions.append(Valuation.created_at >= date_from_obj)
                except:
                    pass
            
            if date_to:
                try:
                    date_to_obj = datetime.fromisoformat(date_to + 'T23:59:59')
                    conditions.append(Valuation.created_at <= date_to_obj)
                except:
                    pass
            
            if price_min is not None:
                conditions.append(Valuation.final_price >= price_min)
            
            if price_max is not None:
                conditions.append(Valuation.final_price <= price_max)
            
            # Aplicar filtros
            base_query = select(Valuation)
            if conditions:
                base_query = base_query.where(and_(*conditions))
            
            # Contar total con filtros
            count_query = select(func.count(Valuation.id))
            if conditions:
                count_query = count_query.where(and_(*conditions))
            total_count = session.exec(count_query).first() or 0
            
            # Obtener avalúos paginados con orden: favoritos primero, luego por fecha
            offset = (page - 1) * limit
            from sqlmodel import desc, asc, nullslast
            valuations_query = base_query.order_by(
                desc(Valuation.is_favorite),  # Favoritos primero (True=1, False=0)
                nullslast(asc(Valuation.favorite_order)),  # Orden de favoritos (nulls al final)
                desc(Valuation.created_at)  # Más recientes primero
            ).offset(offset).limit(limit)
            valuations = session.exec(valuations_query).all()
            
            # Obtener IDs de avalúos que tienen plan de pagos
            valuation_ids = [v.id for v in valuations]
            if valuation_ids:
                plans_query = select(PaymentPlanDashboard.valuation_id).where(
                    PaymentPlanDashboard.valuation_id.in_(valuation_ids)
                )
                valuations_with_plans = set(session.exec(plans_query).all())
            else:
                valuations_with_plans = set()
            
            total_pages = (total_count + limit - 1) // limit
            
            return {
                "valuations": [
                    {
                        "id": v.id,
                        "valuation_name": v.valuation_name,
                        "is_favorite": v.is_favorite,
                        "favorite_order": v.favorite_order,
                        "investment_opportunity": v.investment_opportunity,
                        "area": v.area,
                        "property_type": v.property_type,
                        "rooms": v.rooms,
                        "baths": v.baths,
                        "garages": v.garages,
                        "stratum": v.stratum,
                        "antiquity": v.antiquity,
                        "latitude": v.latitude,
                        "longitude": v.longitude,
                        "capitalization_rate": v.capitalization_rate,
                        "sell_price_per_sqm": v.sell_price_per_sqm,
                        "rent_price_per_sqm": v.rent_price_per_sqm,
                        "total_sell_price": v.total_sell_price,
                        "total_rent_price": v.total_rent_price,
                        "final_price": v.final_price,
                        "has_payment_plan": v.id in valuations_with_plans,
                        "created_at": v.created_at.isoformat() if v.created_at else None,
                        "updated_at": v.updated_at.isoformat() if v.updated_at else None
                    }
                    for v in valuations
                ],
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total_count": total_count,
                    "total_pages": total_pages,
                    "has_next": page < total_pages,
                    "has_prev": page > 1
                }
            }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.delete("/valuations/{valuation_id}")
async def delete_valuation(valuation_id: int):
    """Eliminar un avalúo"""
    try:
        with Session(engine) as session:
            valuation = session.get(Valuation, valuation_id)
            
            if not valuation:
                return {"status": "error", "message": "Avalúo no encontrado"}
            
            session.delete(valuation)
            session.commit()
            
            return {
                "status": "success",
                "message": f"Avalúo '{valuation.valuation_name}' eliminado exitosamente"
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.put("/valuations/{valuation_id}/favorite")
async def toggle_favorite(valuation_id: int):
    """Marcar/desmarcar un avalúo como favorito"""
    try:
        with Session(engine) as session:
            valuation = session.get(Valuation, valuation_id)
            
            if not valuation:
                return {"status": "error", "message": "Avalúo no encontrado"}
            
            if valuation.is_favorite:
                # Desmarcar como favorito y reorganizar los demás
                old_order = valuation.favorite_order
                valuation.is_favorite = False
                valuation.favorite_order = None
                
                # Reorganizar los favoritos restantes
                if old_order:
                    remaining_favorites = session.exec(
                        select(Valuation).where(
                            Valuation.is_favorite == True,
                            Valuation.favorite_order > old_order
                        ).order_by(Valuation.favorite_order)
                    ).all()
                    
                    for fav in remaining_favorites:
                        fav.favorite_order = fav.favorite_order - 1
                        session.add(fav)
                
                message = f"Avalúo '{valuation.valuation_name}' removido de favoritos"
            else:
                # Verificar si ya hay 5 favoritos
                from sqlmodel import func
                favorites_count = session.exec(
                    select(func.count(Valuation.id)).where(Valuation.is_favorite == True)
                ).first() or 0
                
                if favorites_count >= 5:
                    return {
                        "status": "error", 
                        "message": "Solo puedes tener un máximo de 5 favoritos"
                    }
                
                # Obtener el próximo orden disponible
                max_order = session.exec(
                    select(func.max(Valuation.favorite_order)).where(Valuation.is_favorite == True)
                ).first() or 0
                
                # Marcar como favorito con el siguiente orden
                valuation.is_favorite = True
                valuation.favorite_order = max_order + 1
                message = f"Avalúo '{valuation.valuation_name}' agregado a favoritos"
            
            valuation.updated_at = get_local_now()
            session.add(valuation)
            session.commit()
            
            return {
                "status": "success",
                "message": message,
                "is_favorite": valuation.is_favorite,
                "favorite_order": valuation.favorite_order
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.put("/valuations/{valuation_id}/investment-opportunity")
async def toggle_investment_opportunity(valuation_id: int):
    """Publicar/despublicar un avalúo como oportunidad de inversión (landing de inversionistas)"""
    try:
        with Session(engine) as session:
            valuation = session.get(Valuation, valuation_id)

            if not valuation:
                return {"status": "error", "message": "Avalúo no encontrado"}

            valuation.investment_opportunity = not valuation.investment_opportunity
            valuation.updated_at = get_local_now()
            session.add(valuation)
            session.commit()

            estado = "publicado como" if valuation.investment_opportunity else "retirado de"
            return {
                "status": "success",
                "message": f"Avalúo '{valuation.valuation_name}' {estado} oportunidad de inversión",
                "investment_opportunity": valuation.investment_opportunity
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.put("/valuations/favorites/reorder")
async def reorder_favorites(order: dict):
    """Reordenar los avalúos favoritos
    
    Args:
        order: Diccionario con IDs de valuaciones como keys y orden como values
               Ejemplo: {"12": 1, "5": 2, "8": 3}
    """
    try:
        with Session(engine) as session:
            for valuation_id_str, new_order in order.items():
                valuation_id = int(valuation_id_str)
                valuation = session.get(Valuation, valuation_id)
                
                if valuation and valuation.is_favorite:
                    valuation.favorite_order = new_order
                    valuation.updated_at = get_local_now()
                    session.add(valuation)
            
            session.commit()
            
            return {
                "status": "success",
                "message": "Orden de favoritos actualizado exitosamente"
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}
