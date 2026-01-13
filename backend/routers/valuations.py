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


@router.post("/valuation")
async def calculate_valuation(data: PropertyValuationRequest):
    """Calcular avalúo de propiedad usando modelos ML"""
    import pandas as pd
    import numpy as np
    import lightgbm as lgb
    from catboost import CatBoostRegressor
    import os
    import json
    
    try:
        # Rutas de archivos
        base_path = os.path.join(os.path.dirname(__file__), '..', 'ml_models')
        metadata_path = os.path.join(base_path, 'metadata.json')
        rent_model_path = os.path.join(base_path, 'model_rent_lightgbm.txt')
        sell_model_path = os.path.join(base_path, 'model_sell_catboost.cbm')
        
        # Preparar datos procesados
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
        
        results = {}
        
        # Leer metadata para obtener el orden correcto de features
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
            rent_features_order = metadata.get('rent', {}).get('lightgbm', {}).get('features', [])
            sell_features_order = metadata.get('sell', {}).get('catboost', {}).get('features', [])
        else:
            # Orden por defecto si no hay metadata
            rent_features_order = ['area', 'rooms', 'baths', 'garages', 'stratum', 
                                   'latitude', 'longitude', 'antiquity', 'is_new',
                                   'area_per_room', 'has_garage', 'city_id', 'property_type']
            sell_features_order = rent_features_order
        
        # Modelo de renta (LightGBM)
        if os.path.exists(rent_model_path):
            try:
                with open(rent_model_path, 'r') as f:
                    model_str = f.read()
                rent_model = lgb.Booster(model_str=model_str)
                
                df_rent = pd.DataFrame([processed_data])
                if rent_features_order:
                    df_rent = df_rent[rent_features_order]
                
                # Convertir variables categóricas
                categorical_features = ["is_new", "age_bucket", "city_id"]
                for cat_feat in categorical_features:
                    if cat_feat in df_rent.columns:
                        df_rent[cat_feat] = pd.Categorical(df_rent[cat_feat].astype(str))
                
                rent_prediction = rent_model.predict(df_rent)[0]
                rent_price = float(np.expm1(rent_prediction))
                
                results['rent_price_per_sqm'] = round(rent_price, 2)
                results['total_rent_price'] = round(rent_price * data.area, 2)
            except Exception as e:
                results['rent_error'] = str(e)
                print(f"Error modelo renta: {e}")
        
        # Modelo de venta (CatBoost)
        if os.path.exists(sell_model_path):
            try:
                sell_model = CatBoostRegressor()
                sell_model.load_model(sell_model_path)
                
                df_sell = pd.DataFrame([processed_data])
                if sell_features_order:
                    df_sell = df_sell[sell_features_order]
                
                sell_prediction = sell_model.predict(df_sell)[0]
                sell_price = float(np.expm1(sell_prediction))
                
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
async def get_valuations(page: int = 1, limit: int = 10):
    """Obtener lista de avalúos con paginación"""
    try:
        with Session(engine) as session:
            # Contar total
            from sqlmodel import func
            total_count = session.exec(select(func.count(Valuation.id))).first() or 0
            
            # Obtener avalúos paginados
            offset = (page - 1) * limit
            valuations_query = select(Valuation).order_by(Valuation.created_at.desc()).offset(offset).limit(limit)
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
