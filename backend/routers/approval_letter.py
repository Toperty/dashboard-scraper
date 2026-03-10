"""
Router para generar cartas de aprobación
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import httpx
import os
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

class AdditionalClient(BaseModel):
    """Modelo para clientes adicionales"""
    fullName: str
    idType: Optional[str] = None
    idNumber: Optional[str] = None

class ApprovalLetterRequest(BaseModel):
    # Cliente principal
    full_name: str
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    max_approved_amount: float
    min_initial_payment: float
    # Clientes adicionales (hasta 3 más para total de 4)
    additional_clients: List[AdditionalClient] = []
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
        all_names = [extract_first_name(request.full_name)]
        for client in request.additional_clients:
            if client.fullName:
                all_names.append(extract_first_name(client.fullName))
        
        # Formar el string de nombres: "Juan", "Juan y Sara", "Juan, Sara y Pedro", etc.
        if len(all_names) == 1:
            primer_nombre = all_names[0]
        elif len(all_names) == 2:
            primer_nombre = f"{all_names[0]} y {all_names[1]}"
        else:
            primer_nombre = ", ".join(all_names[:-1]) + f" y {all_names[-1]}"
        
        # Preparar datos individuales para cada cliente adicional
        # Cliente 2 (primer adicional - secondary)
        secondary_data = {}
        if len(request.additional_clients) > 0 and request.additional_clients[0].fullName:
            secondary_data = {
                "secondary_nombre_completo": capitalize_name(request.additional_clients[0].fullName),
                "secondary_tipo_id": request.additional_clients[0].idType or "",
                "secondary_numero_id": request.additional_clients[0].idNumber or ""
            }
        else:
            # Si no hay cliente secundario, enviar strings vacíos
            secondary_data = {
                "secondary_nombre_completo": "",
                "secondary_tipo_id": "",
                "secondary_numero_id": ""
            }
        
        # Cliente 3 (segundo adicional - third)
        third_data = {}
        if len(request.additional_clients) > 1 and request.additional_clients[1].fullName:
            third_data = {
                "third_nombre_completo": capitalize_name(request.additional_clients[1].fullName),
                "third_tipo_id": request.additional_clients[1].idType or "",
                "third_numero_id": request.additional_clients[1].idNumber or ""
            }
        else:
            third_data = {
                "third_nombre_completo": "",
                "third_tipo_id": "",
                "third_numero_id": ""
            }
        
        # Cliente 4 (tercer adicional - fourth)
        fourth_data = {}
        if len(request.additional_clients) > 2 and request.additional_clients[2].fullName:
            fourth_data = {
                "fourth_nombre_completo": capitalize_name(request.additional_clients[2].fullName),
                "fourth_tipo_id": request.additional_clients[2].idType or "",
                "fourth_numero_id": request.additional_clients[2].idNumber or ""
            }
        else:
            fourth_data = {
                "fourth_nombre_completo": "",
                "fourth_tipo_id": "",
                "fourth_numero_id": ""
            }
        
        script_data = {
            "action": "generate_approval_letter",
            "template_id": "1EqtfWm1jpAWhh9DRalak9kbwBAkzUQDLiOD58QKbQdw",
            "previous_approval_id": request.payment_plan_id,  # Usar payment_plan_id como referencia para eliminar carta anterior
            "data": {
                "primer_nombre": primer_nombre,
                "cupo_maximo": format_currency(request.max_approved_amount),
                "cuota_inicial_min": format_currency(request.min_initial_payment),
                "cuota_cupo": calculate_payment_percentage(request.min_initial_payment, request.max_approved_amount),
                "tipo_id": request.id_type or "",
                "numero_id": request.id_number or "",
                "nombre_completo": capitalize_name(request.full_name),
                # Agregar los datos de cada cliente adicional
                **secondary_data,
                **third_data,
                **fourth_data,
                "total_clients": len(all_names)  # Total de clientes (1 a 4)
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