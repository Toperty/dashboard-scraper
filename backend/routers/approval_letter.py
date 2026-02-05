"""
Router para generar cartas de aprobación
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import os
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

class ApprovalLetterRequest(BaseModel):
    # Cliente principal
    full_name: str
    id_type: str
    id_number: str
    max_approved_amount: float
    min_initial_payment: float
    # Cliente secundario (opcional)
    has_secondary_client: bool = False
    secondary_full_name: Optional[str] = None
    secondary_id_type: Optional[str] = None
    secondary_id_number: Optional[str] = None
    # ID del plan de pagos para referencia
    payment_plan_id: Optional[int] = None

def format_currency(amount: float) -> str:
    """Formatear número en formato de miles con puntos"""
    return f"{amount:,.0f}".replace(",", ".")

def capitalize_name(name: str) -> str:
    """Capitalizar cada palabra del nombre"""
    return " ".join([word.capitalize() for word in name.split()])

def extract_first_name(full_name: str) -> str:
    """Extraer el primer nombre"""
    return full_name.split()[0].capitalize()

def calculate_payment_percentage(payment: float, amount: float) -> str:
    """Calcular porcentaje de cuota inicial"""
    if amount == 0:
        return "0"
    percentage = (payment / amount) * 100
    if percentage % 1 == 0:
        return f"{int(percentage)}"
    else:
        return f"{percentage:.2f}".rstrip('0').rstrip('.')

@router.post("/generate")
async def generate_approval_letter(request: ApprovalLetterRequest):
    """Generar carta de aprobación usando Google Apps Script"""
    try:
        logger.info(f"Generando carta de aprobación para: {request.full_name}")
        
        # Preparar datos para el Apps Script
        # Combinar nombres según la cantidad de clientes
        if request.has_secondary_client and request.secondary_full_name:
            # Con dos clientes: "Juan y Sara"
            primer_nombre = f"{extract_first_name(request.full_name)} y {extract_first_name(request.secondary_full_name)}"
        else:
            # Con un cliente: "Juan"
            primer_nombre = extract_first_name(request.full_name)
        
        script_data = {
            "action": "generate_approval_letter",
            "template_id": "1EqtfWm1jpAWhh9DRalak9kbwBAkzUQDLiOD58QKbQdw",
            "previous_approval_id": request.payment_plan_id,  # Usar payment_plan_id como referencia para eliminar carta anterior
            "data": {
                "primer_nombre": primer_nombre,
                "cupo_maximo": format_currency(request.max_approved_amount),
                "cuota_inicial_min": format_currency(request.min_initial_payment),
                "cuota_cupo": calculate_payment_percentage(request.min_initial_payment, request.max_approved_amount),
                "tipo_id": request.id_type,
                "numero_id": request.id_number,
                "nombre_completo": capitalize_name(request.full_name),
                # Datos del cliente secundario para la firma
                "has_secondary_client": request.has_secondary_client,
                "secondary_nombre_completo": capitalize_name(request.secondary_full_name) if request.secondary_full_name else "",
                "secondary_tipo_id": request.secondary_id_type if request.secondary_id_type else "",
                "secondary_numero_id": request.secondary_id_number if request.secondary_id_number else "",
            }
        }
        
        # URL del Apps Script específico para cartas de aprobación
        apps_script_url = os.getenv('APPSCRIPT_APPROVAL_LETTER_URL')
        if not apps_script_url:
            raise HTTPException(status_code=500, detail="URL del Apps Script para cartas de aprobación no configurada")
        
        logger.info(f"Enviando datos a Apps Script: {script_data}")
        
        # Llamar al Apps Script
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            response = await client.post(
                apps_script_url,
                json=script_data,
                headers={'Content-Type': 'application/json'}
            )
            
            logger.info(f"Respuesta del Apps Script - Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"Resultado: {result}")
                
                if result.get('success'):
                    # Log de los detalles del Apps Script
                    if result.get('logs'):
                        logger.info("=== LOGS DEL APPS SCRIPT ===")
                        for log_line in result.get('logs', []):
                            logger.info(f"Apps Script: {log_line}")
                        logger.info("=== FIN LOGS APPS SCRIPT ===")
                    
                    return {
                        "success": True,
                        "message": "Carta de aprobación generada exitosamente",
                        "approval_letter_url": result.get('presentation_url'),
                        "data": script_data["data"],
                        "logs": result.get('logs', [])  # Incluir logs en la respuesta
                    }
                else:
                    raise HTTPException(
                        status_code=500, 
                        detail=result.get('error', 'Error desconocido al generar la carta')
                    )
            else:
                logger.error(f"Error en Apps Script: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"Error del servidor: {response.status_code}"
                )
                
    except httpx.TimeoutException:
        logger.error("Timeout al llamar al Apps Script")
        raise HTTPException(
            status_code=408, 
            detail="Timeout al generar la carta. Por favor, intente nuevamente."
        )
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"Error inesperado: {str(e)}")
        logger.error(f"Traceback completo: {error_traceback}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error interno del servidor: {str(e)}"
        )