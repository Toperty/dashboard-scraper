from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select
from config.db_connection import engine
from models.payment_plan_dashboard import PaymentPlanDashboard

router = APIRouter(prefix="/api", tags=["client-name"])

@router.get("/dashboard/{token}/client-name")
async def get_client_name(token: str):
    """
    Endpoint súper rápido que solo devuelve el client_name de la tabla payment_plan_dashboard
    """
    try:
        with Session(engine) as session:
            # Consulta directa solo por client_name
            statement = select(PaymentPlanDashboard.client_name).where(
                PaymentPlanDashboard.access_token == token
            )
            result = session.exec(statement).first()
            
            if result is None:
                raise HTTPException(status_code=404, detail="Dashboard not found")
            
            return {"client_name": result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving client name: {str(e)}")