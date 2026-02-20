"""
Router de Investor PDF - Endpoints para generar PDF de inversionistas
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from sqlmodel import Session, select
from config.db_connection import engine
from models.valuation import Valuation
from models.investor_tenant import InvestorTenantInfo
from models.property_images import PropertyImage
from datetime import datetime
import os
import uuid
import shutil
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Try to import GCS client, but make it optional
try:
    from config.gcs_config import gcs_client
except ImportError:
    logger.warning("Google Cloud Storage not available. Using local file storage only.")
    gcs_client = None

router = APIRouter(prefix="/api/investor-form", tags=["investor-form"])

# Configuración de uploads
UPLOAD_DIR = Path("uploads/property-images")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
MAX_IMAGES_PER_PROPERTY = 10

class TenantInfoRequest(BaseModel):
    """Modelo para información del inquilino"""
    monthly_income: float
    monthly_payment: float
    employer: str
    credit_score: int
    score_date: datetime

class ValuationUpdateRequest(BaseModel):
    """Modelo para actualizar campos opcionales de valuación"""
    description: Optional[str] = None
    floor: Optional[int] = None
    administration_fee: Optional[float] = None

@router.post("/tenant-info/{valuation_id}")
async def create_or_update_tenant_info(valuation_id: int, tenant_data: TenantInfoRequest):
    """Crear o actualizar información del inquilino"""
    try:
        with Session(engine) as session:
            # Verificar que la valuación existe
            valuation = session.get(Valuation, valuation_id)
            if not valuation:
                raise HTTPException(status_code=404, detail="Valuación no encontrada")
            
            # Buscar info existente o crear nueva
            tenant_info = session.exec(
                select(InvestorTenantInfo).where(InvestorTenantInfo.valuation_id == valuation_id)
            ).first()
            
            if not tenant_info:
                tenant_info = InvestorTenantInfo(valuation_id=valuation_id)
                session.add(tenant_info)
            
            # Actualizar campos
            tenant_info.monthly_income = tenant_data.monthly_income
            tenant_info.monthly_payment = tenant_data.monthly_payment
            tenant_info.employer = tenant_data.employer
            tenant_info.credit_score = tenant_data.credit_score
            tenant_info.score_date = tenant_data.score_date
            tenant_info.updated_at = datetime.utcnow()
            
            # Calcular ratios
            tenant_info.calculate_ratios()
            
            session.commit()
            session.refresh(tenant_info)
            
            return {"success": True, "data": tenant_info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tenant-info/{valuation_id}")
async def get_tenant_info(valuation_id: int):
    """Obtener información del inquilino"""
    with Session(engine) as session:
        tenant_info = session.exec(
            select(InvestorTenantInfo).where(InvestorTenantInfo.valuation_id == valuation_id)
        ).first()
        
        if not tenant_info:
            return {"success": False, "data": None}
        
        return {"success": True, "data": tenant_info}

from typing import Union

@router.post("/images/{valuation_id}")
async def upload_property_images(
    valuation_id: int,
    images: List[UploadFile] = File(...),
    captions: Optional[Union[str, List[str]]] = Form(default=None),  # Puede ser string o lista
    is_facade: Optional[str] = Form(default=None)  # Indicador si es imagen de fachada
):
    """Subir imágenes del inmueble"""
    logger.info(f"Uploading {len(images)} images for valuation {valuation_id}")
    
    # Normalizar captions a lista para manejo consistente
    if isinstance(captions, str):
        captions = [captions]
    elif captions is None:
        captions = []
    
    try:
        with Session(engine) as session:
            # Verificar que la valuación existe
            valuation = session.get(Valuation, valuation_id)
            if not valuation:
                raise HTTPException(status_code=404, detail="Valuación no encontrada")
            
            # Verificar cantidad actual de imágenes
            current_images = session.exec(
                select(PropertyImage).where(PropertyImage.valuation_id == valuation_id)
            ).all()
            
            if len(current_images) + len(images) > MAX_IMAGES_PER_PROPERTY:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Máximo {MAX_IMAGES_PER_PROPERTY} imágenes por propiedad"
                )
            
            saved_images = []
            
            for i, image in enumerate(images):
                # Validar extensión
                file_ext = Path(image.filename).suffix.lower()
                if file_ext not in ALLOWED_EXTENSIONS:
                    continue
                
                # Validar tamaño
                contents = await image.read()
                if len(contents) > MAX_FILE_SIZE:
                    await image.seek(0)
                    continue
                
                # Generar nombre único
                unique_filename = f"{uuid.uuid4()}{file_ext}"
                
                # ONLY upload to GCS - no local storage option
                if not gcs_client or not gcs_client.client:
                    logger.error("GCS client not available - cannot upload images")
                    raise HTTPException(
                        status_code=503,
                        detail="Google Cloud Storage is not configured. Images cannot be uploaded."
                    )
                
                logger.info(f"Uploading to GCS: {unique_filename}")
                gcs_url = gcs_client.upload_image(
                    file_content=contents,
                    filename=unique_filename,
                    content_type=image.content_type or "image/jpeg"
                )
                
                if not gcs_url:
                    logger.error(f"Failed to upload {unique_filename} to GCS")
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to upload image to Google Cloud Storage"
                    )
                
                # Use the GCS URL (signed or public)
                image_path = gcs_url
                logger.info(f"Image uploaded to GCS successfully")
                
                # Crear registro en BD
                # Si is_facade está presente y es "true", marcar la imagen como fachada
                is_facade_image = is_facade == "true" and i == 0  # Solo la primera imagen puede ser fachada
                
                property_image = PropertyImage(
                    valuation_id=valuation_id,
                    image_path=image_path,
                    image_order=7 if is_facade_image else len(current_images) + i,  # Fachada siempre es imagen #7
                    caption=captions[i] if captions and i < len(captions) else None,
                    original_filename=image.filename,
                    file_size=len(contents),
                    mime_type=image.content_type,
                    is_facade=is_facade_image
                )
                
                session.add(property_image)
                saved_images.append(property_image)
                
                await image.seek(0)
            
            session.commit()
            
            # Refresh saved images to get the updated signed URLs from GCS
            for img in saved_images:
                session.refresh(img)
            
            return {
                "success": True,
                "uploaded": len(saved_images),
                "images": [{"id": img.id, "path": img.image_path} for img in saved_images]
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading images: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/images/{valuation_id}")
async def get_property_images(valuation_id: int):
    """Obtener lista de imágenes del inmueble"""
    with Session(engine) as session:
        images = session.exec(
            select(PropertyImage)
            .where(PropertyImage.valuation_id == valuation_id)
            .order_by(PropertyImage.image_order)
        ).all()
        
        return {
            "success": True,
            "images": images
        }

@router.delete("/images/{image_id}")
async def delete_property_image(image_id: int):
    """Eliminar una imagen y su archivo asociado"""
    try:
        with Session(engine) as session:
            image = session.get(PropertyImage, image_id)
            if not image:
                raise HTTPException(status_code=404, detail="Imagen no encontrada")
            
            deletion_status = {
                "database": False,
                "storage": False,
                "storage_message": ""
            }
            
            # Delete from GCS or local storage
            if image.image_path.startswith("http"):
                # Delete from GCS
                logger.info(f"Attempting to delete from GCS: {image.image_path[:100]}...")
                
                if gcs_client and gcs_client.client:
                    success = gcs_client.delete_image(image.image_path)
                    if success:
                        deletion_status["storage"] = True
                        deletion_status["storage_message"] = "Imagen eliminada de GCS"
                        logger.info(f"Successfully deleted image from GCS")
                    else:
                        deletion_status["storage_message"] = "No se pudo eliminar de GCS (puede que ya no exista)"
                        logger.warning(f"Failed to delete image from GCS, but continuing with DB deletion")
                else:
                    deletion_status["storage_message"] = "Cliente GCS no disponible"
                    logger.warning(f"GCS client not available to delete: {image.image_path[:100]}...")
            else:
                # Delete from local storage
                try:
                    file_path = Path(image.image_path.lstrip('/'))
                    if file_path.exists():
                        file_path.unlink()
                        deletion_status["storage"] = True
                        deletion_status["storage_message"] = "Imagen eliminada del almacenamiento local"
                    else:
                        deletion_status["storage_message"] = "Archivo no encontrado en almacenamiento local"
                except Exception as e:
                    deletion_status["storage_message"] = f"Error eliminando archivo local: {str(e)}"
            
            # Always delete from database, even if storage deletion failed
            session.delete(image)
            session.commit()
            deletion_status["database"] = True
            
            logger.info(f"Image {image_id} deleted - DB: {deletion_status['database']}, Storage: {deletion_status['storage']}")
            
            return {
                "success": True, 
                "message": "Imagen eliminada de la base de datos",
                "details": deletion_status
            }
    except Exception as e:
        logger.error(f"Error deleting image {image_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/valuation/{valuation_id}")
async def update_valuation_investor_fields(valuation_id: int, update_data: ValuationUpdateRequest):
    """Actualizar campos opcionales de valuación para inversionistas"""
    try:
        with Session(engine) as session:
            valuation = session.get(Valuation, valuation_id)
            if not valuation:
                raise HTTPException(status_code=404, detail="Valuación no encontrada")
            
            # Actualizar solo campos proporcionados
            if update_data.description is not None:
                # Validar longitud de descripción
                if len(update_data.description) > 680:
                    raise HTTPException(status_code=400, detail="La descripción no puede exceder 680 caracteres")
                valuation.description = update_data.description
            
            if update_data.floor is not None:
                valuation.floor = update_data.floor
            
            if update_data.administration_fee is not None:
                valuation.administration_fee = update_data.administration_fee
            
            valuation.updated_at = datetime.utcnow()
            
            session.commit()
            session.refresh(valuation)
            
            return {"success": True, "data": valuation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/financial-data/{valuation_id}")
async def get_financial_data_from_dashboard(valuation_id: int):
    """Obtener datos financieros directamente del dashboard sin guardar en BD"""
    try:
        with Session(engine) as session:
            valuation = session.get(Valuation, valuation_id)
            if not valuation:
                raise HTTPException(status_code=404, detail="Valuación no encontrada")
            
            # Obtener datos del dashboard
            from models.payment_plan_dashboard import PaymentPlanDashboard
            dashboard = session.exec(
                select(PaymentPlanDashboard).where(
                    PaymentPlanDashboard.valuation_name == valuation.valuation_name
                )
            ).first()
            
            if not dashboard or not dashboard.sheet_data:
                # Si no hay dashboard, usar valores por defecto del avalúo
                return {
                    "success": True,
                    "data": {
                        "purchase_price": valuation.final_price or 0,
                        "closing_costs": (valuation.final_price or 0) * 0.0323,  # 3.23% basado en datos reales
                        "user_down_payment": (valuation.final_price or 0) * 0.10,  # 10% típico
                        "total_investment": 0  # Se calculará en frontend
                    },
                    "source": "calculated"
                }
            
            # Obtener datos del dashboard
            flujo_interno = dashboard.sheet_data.get('flujo_interno', {})
            
            # Función auxiliar para limpiar valores monetarios
            def clean_currency(value_str: str) -> float:
                if not value_str:
                    return 0
                clean_str = str(value_str).replace(',', '').replace('$', '').strip()
                try:
                    return float(clean_str)
                except ValueError:
                    return 0
            
            # Obtener valores del dashboard
            commercial_value = clean_currency(flujo_interno.get('commercial_value', 0))
            purchase_price = clean_currency(flujo_interno.get('average_purchase_value', 0))
            user_down_payment = clean_currency(flujo_interno.get('user_down_payment', 0))
            
            # Calcular gastos de cierre
            # Basado en ejemplo real: $48.132.396 / $1.490.167.072 = 3.23%
            closing_costs = purchase_price * 0.0323 if purchase_price > 0 else 0
            
            # Calcular inversión total
            # Monto Total Inversión = Valor de Compra + Gastos de Cierre - Cuota Inicial
            total_investment = purchase_price + closing_costs - user_down_payment
            
            # Obtener métricas adicionales del dashboard
            # Estas métricas vienen del template y son más precisas
            metrics = {}
            
            # Obtener datos del cash flow si está disponible
            cash_flow_data = dashboard.sheet_data.get('cash_flow', [])
            if cash_flow_data and len(cash_flow_data) > 1:
                # El cash flow tiene los datos de proyección
                # Buscar métricas en los datos para calcular rentabilidad
                try:
                    # Obtener duración del programa
                    program_months = int(flujo_interno.get('program_months', 60))
                    
                    # La rentabilidad anual se puede calcular desde el flujo mensual
                    # Esto es un estimado basado en los pagos mensuales del usuario
                    monthly_payment = clean_currency(flujo_interno.get('user_monthly_payment', 0))
                    if monthly_payment == 0 and len(cash_flow_data) > 2:
                        # Intentar obtener el pago mensual de la tabla de flujo
                        try:
                            # Asumiendo que la columna 2 o 3 tiene el pago mensual
                            monthly_payment = clean_currency(cash_flow_data[2][2] if len(cash_flow_data[2]) > 2 else 0)
                        except:
                            monthly_payment = 0
                    
                    metrics['program_months'] = program_months
                    metrics['monthly_payment'] = monthly_payment
                    
                    # Calcular rentabilidad anual estimada
                    if total_investment > 0 and monthly_payment > 0:
                        annual_return = (monthly_payment * 12) / total_investment * 100
                        metrics['annual_return'] = annual_return
                    else:
                        metrics['annual_return'] = 0
                        
                except Exception as e:
                    logger.warning(f"Could not calculate metrics: {e}")
                    metrics['annual_return'] = 0
            
            return {
                "success": True,
                "data": {
                    "commercial_value": commercial_value,  # Avalúo comercial
                    "purchase_price": purchase_price,      # Valor de compra
                    "closing_costs": closing_costs,        # Gastos de cierre
                    "user_down_payment": user_down_payment,  # Cuota inicial usuario
                    "total_investment": total_investment,   # Monto total inversión
                    "metrics": metrics                      # Métricas adicionales
                },
                "source": "dashboard"
            }
            
    except Exception as e:
        logger.error(f"Error getting financial data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/data/{valuation_id}")
async def get_investor_pdf_data(valuation_id: int):
    """Obtener todos los datos necesarios para generar el PDF de inversionista"""
    try:
        with Session(engine) as session:
            # Obtener valuación
            valuation = session.get(Valuation, valuation_id)
            if not valuation:
                raise HTTPException(status_code=404, detail="Valuación no encontrada")
            
            # Obtener información del inquilino
            tenant_info = session.exec(
                select(InvestorTenantInfo).where(InvestorTenantInfo.valuation_id == valuation_id)
            ).first()
            
            # Obtener imágenes
            images = session.exec(
                select(PropertyImage)
                .where(PropertyImage.valuation_id == valuation_id)
                .order_by(PropertyImage.image_order)
            ).all()
            
            # Las imágenes ya deberían tener URLs firmadas guardadas en la BD
            # Solo regenerar si no tienen firma o si la URL es simple
            for img in images:
                if img.image_path and img.image_path.startswith('https://storage.googleapis.com/'):
                    # Si ya tiene parámetros de firma, usar tal cual
                    if 'X-Goog-Algorithm' in img.image_path:
                        continue  # Ya tiene URL firmada
                    
                    # Si no tiene firma y tenemos GCS client, generar URL firmada
                    if gcs_client and gcs_client.client:
                        try:
                            # Extraer el path del blob desde la URL
                            path_parts = img.image_path.replace('https://storage.googleapis.com/', '').split('/', 1)
                            if len(path_parts) == 2:
                                bucket_name = path_parts[0]
                                blob_path = path_parts[1]
                                
                                # Generar URL firmada con 7 días de validez (máximo permitido)
                                bucket = gcs_client.client.bucket(bucket_name)
                                blob = bucket.blob(blob_path)
                                
                                from datetime import timedelta
                                signed_url = blob.generate_signed_url(
                                    version="v4",
                                    expiration=timedelta(days=7),  # URL válida por 7 días (máximo)
                                    method="GET"
                                )
                                img.image_path = signed_url
                                
                                # Actualizar en la BD para no regenerar cada vez
                                session.add(img)
                                session.commit()
                                logger.info(f"Updated image {img.id} with signed URL")
                        except Exception as e:
                            logger.warning(f"Could not generate signed URL for image {img.id}: {e}")
                            # Keep the original URL if signing fails
            
            # Nota: La inversión total ahora se calcula dinámicamente desde el dashboard
            
            return {
                "success": True,
                "data": {
                    "valuation": valuation,
                    "tenant_info": tenant_info,
                    "images": images,
                    "is_complete": all([
                        valuation.description,
                        tenant_info,
                        len(images) > 0
                    ])
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/validate/{valuation_id}")
async def validate_investor_pdf_data(valuation_id: int):
    """Validar que todos los campos necesarios estén completos para generar el PDF"""
    try:
        with Session(engine) as session:
            valuation = session.get(Valuation, valuation_id)
            if not valuation:
                raise HTTPException(status_code=404, detail="Valuación no encontrada")
            
            tenant_info = session.exec(
                select(InvestorTenantInfo).where(InvestorTenantInfo.valuation_id == valuation_id)
            ).first()
            
            images = session.exec(
                select(PropertyImage).where(PropertyImage.valuation_id == valuation_id)
            ).all()
            
            missing_fields = []
            
            # Validar campos de valuación
            if not valuation.description:
                missing_fields.append("Descripción del inmueble")
            
            # Validar información del inquilino
            if not tenant_info:
                missing_fields.append("Información del inquilino")
            elif not all([tenant_info.monthly_income, tenant_info.monthly_payment, tenant_info.employer]):
                missing_fields.append("Información completa del inquilino")
            
            # Validar imágenes
            if len(images) == 0:
                missing_fields.append("Al menos una imagen del inmueble")
            
            is_valid = len(missing_fields) == 0
            
            return {
                "success": True,
                "is_valid": is_valid,
                "missing_fields": missing_fields
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint de generación de PDF eliminado - ahora se usa Google Slides via AppScript