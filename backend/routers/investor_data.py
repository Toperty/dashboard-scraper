from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select
from config.db_connection import engine
from models.payment_plan_dashboard import PaymentPlanDashboard

router = APIRouter(prefix="/api", tags=["investor-data"])

@router.get("/dashboard/{token}/investor-data")
async def get_investor_data(token: str):
    """
    Endpoint súper rápido que solo devuelve los datos financieros básicos para inversionistas
    """
    try:
        with Session(engine) as session:
            # Consulta directa solo por los campos financieros necesarios
            statement = select(PaymentPlanDashboard.sheet_data).where(
                PaymentPlanDashboard.access_token == token
            )
            result = session.exec(statement).first()
            
            if result is None:
                raise HTTPException(status_code=404, detail="Dashboard not found")
            
            # Extraer solo los campos necesarios del JSON
            sheet_data = result or {}
            flujo_interno = sheet_data.get('flujo_interno', {})
            
            return {
                "precio_compra": flujo_interno.get('average_purchase_value'),
                "gastos_cierre": flujo_interno.get('closing_costs'), 
                "cuota_inicial_usuario": flujo_interno.get('user_down_payment'),
                "cuota_administracion": sheet_data.get('cuota_administracion'),
                "piso": sheet_data.get('piso'),
                "descripcion_detallada": sheet_data.get('descripcion_detallada'),
                "ingresos_mensuales_certificados": sheet_data.get('ingresos_mensuales_certificados'),
                "cuota_mensual_total": sheet_data.get('cuota_mensual_total')
            }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving investor data: {str(e)}")