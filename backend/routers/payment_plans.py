"""
Router de Planes de Pago - Endpoints de Google Sheets y dashboards
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from sqlmodel import Session
from config.db_connection import engine
from services.stats_service import get_local_now
import os
import requests
from urllib.parse import urlencode
from datetime import datetime

router = APIRouter(prefix="/api", tags=["payment-plans"])


class PaymentPlanRequest(BaseModel):
    """Request model for payment plan data"""
    valuation_name: str
    area: str
    commercial_value: str
    average_purchase_value: str
    asking_price: str
    user_down_payment: str
    program_months: str
    potential_down_payment: str
    bank_mortgage_rate: str
    dupla_bank_rate: str
    client_name: str
    address: str
    city: str
    country: str
    construction_year: str
    stratum: str
    apartment_type: str
    private_parking: str


class PaymentPlanResponse(BaseModel):
    """Response model for payment plan creation"""
    success: bool
    sheet_url: str = ""
    dashboard_url: str = ""
    message: str = ""


@router.post("/google-sheets", response_model=PaymentPlanResponse)
async def create_payment_plan_sheet(payment_plan_data: PaymentPlanRequest):
    """Create a new Google Sheets document with payment plan data"""
    from models.payment_plan_dashboard import PaymentPlanDashboard
    
    try:
        forms_url = os.getenv('GOOGLE_APPS_SCRIPT_URL')
        if not forms_url:
            raise HTTPException(status_code=500, detail="Google Apps Script URL not configured")
        
        if not payment_plan_data.client_name.strip():
            raise HTTPException(status_code=400, detail="Client name is required")
        
        data_dict = payment_plan_data.model_dump()
        params = urlencode(data_dict)
        full_url = f"{forms_url}?{params}"
        
        response = requests.get(full_url, allow_redirects=True, timeout=30)
        
        if response.status_code == 200:
            try:
                result = response.json()
                if result.get('success'):
                    sheet_url = result.get('sheet_url', '')
                    sheet_id = sheet_url.split('/d/')[1].split('/')[0] if '/d/' in sheet_url else ''
                    
                    with Session(engine) as session:
                        valuation_id = None
                        valuation_name_to_use = payment_plan_data.valuation_name or payment_plan_data.client_name
                        
                        if payment_plan_data.valuation_name:
                            from models.valuation import Valuation
                            valuation = session.query(Valuation).filter_by(
                                valuation_name=payment_plan_data.valuation_name
                            ).first()
                            if valuation:
                                valuation_id = valuation.id
                        
                        existing_dashboard = session.query(PaymentPlanDashboard).filter(
                            PaymentPlanDashboard.valuation_name == valuation_name_to_use,
                            PaymentPlanDashboard.is_active == True
                        ).first()
                        
                        sheet_data = {
                            'flujo_interno': {
                                'area': payment_plan_data.area,
                                'commercial_value': payment_plan_data.commercial_value,
                                'asking_price': payment_plan_data.asking_price,
                                'user_down_payment': payment_plan_data.user_down_payment,
                                'program_months': payment_plan_data.program_months,
                                'potential_down_payment': payment_plan_data.potential_down_payment,
                                'bank_mortgage_rate': payment_plan_data.bank_mortgage_rate,
                                'dupla_bank_rate': payment_plan_data.dupla_bank_rate
                            },
                            'para_usuario': {
                                'client_name': payment_plan_data.client_name,
                                'address': payment_plan_data.address,
                                'city': payment_plan_data.city,
                                'country': payment_plan_data.country,
                                'construction_year': payment_plan_data.construction_year,
                                'stratum': payment_plan_data.stratum,
                                'apartment_type': payment_plan_data.apartment_type,
                                'private_parking': payment_plan_data.private_parking
                            }
                        }
                        
                        if existing_dashboard:
                            existing_dashboard.sheet_id = sheet_id
                            existing_dashboard.sheet_url = sheet_url
                            existing_dashboard.sheet_data = sheet_data
                            existing_dashboard.updated_at = datetime.utcnow()
                            
                            session.commit()
                            session.refresh(existing_dashboard)
                            
                            return PaymentPlanResponse(
                                success=True,
                                sheet_url=sheet_url,
                                dashboard_url=existing_dashboard.dashboard_url,
                                message=f'Plan de pagos actualizado exitosamente. Dashboard válido por {existing_dashboard.days_remaining} días.'
                            )
                        else:
                            dashboard = PaymentPlanDashboard(
                                sheet_id=sheet_id,
                                sheet_url=sheet_url,
                                valuation_id=valuation_id,
                                valuation_name=valuation_name_to_use,
                                client_name=payment_plan_data.client_name,
                                sheet_data=sheet_data
                            )
                            
                            base_url = os.getenv('NEXT_PUBLIC_API_URL', 'http://localhost:3000')
                            dashboard.dashboard_url = f"{base_url}/dashboard/payment-plan/{dashboard.access_token}"
                            
                            session.add(dashboard)
                            session.commit()
                            session.refresh(dashboard)
                            
                            return PaymentPlanResponse(
                                success=True,
                                sheet_url=sheet_url,
                                dashboard_url=dashboard.dashboard_url,
                                message=f'Plan de pagos creado exitosamente. Dashboard válido por {dashboard.days_remaining} días.'
                            )
                else:
                    raise HTTPException(status_code=500, detail=f"Error en Apps Script: {result.get('error', 'Unknown error')}")
            except Exception as json_error:
                raise HTTPException(status_code=500, detail=f"Error parsing Apps Script response: {str(json_error)}")
        else:
            raise HTTPException(status_code=500, detail=f"Error calling Apps Script: {response.status_code}")
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in create_payment_plan_sheet: {e}")
        raise HTTPException(status_code=500, detail="Error al crear el plan de pagos en Google Sheets")


@router.get("/dashboard/check/{valuation_name}")
async def check_dashboard_exists(valuation_name: str):
    """Check if a dashboard already exists for a valuation"""
    from models.payment_plan_dashboard import PaymentPlanDashboard
    
    with Session(engine) as session:
        dashboard = session.query(PaymentPlanDashboard).filter(
            PaymentPlanDashboard.valuation_name == valuation_name,
            PaymentPlanDashboard.is_active == True
        ).first()
        
        if dashboard:
            return {
                "exists": True,
                "dashboard_url": dashboard.dashboard_url,
                "sheet_url": dashboard.sheet_url,
                "expires_at": dashboard.expires_at.isoformat(),
                "days_remaining": dashboard.days_remaining
            }
        
        return {"exists": False}


async def get_dashboard_by_type(access_token: str, dashboard_type: str = "full"):
    """Get payment plan dashboard by access token"""
    from models.payment_plan_dashboard import PaymentPlanDashboard
    
    with Session(engine) as session:
        dashboard = session.query(PaymentPlanDashboard).filter_by(
            access_token=access_token,
            is_active=True
        ).first()
        
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found or expired")
        
        if dashboard.is_expired:
            dashboard.is_active = False
            session.commit()
            raise HTTPException(status_code=410, detail="Dashboard has expired")
        
        dashboard.view_count += 1
        
        # Sync with Google Sheets
        apps_script_url = os.getenv('GOOGLE_APPS_SCRIPT_READER_URL', '')
        if apps_script_url and dashboard.sheet_id:
            try:
                response = requests.get(f"{apps_script_url}?sheetId={dashboard.sheet_id}&type={dashboard_type}")
                if response.status_code == 200:
                    result = response.json()
                    if result.get('success'):
                        dashboard.sheet_data = result.get('data', {})
                        dashboard.last_sync_at = datetime.utcnow()
            except Exception as e:
                print(f"Error syncing with Apps Script: {e}")
        
        session.commit()
        session.refresh(dashboard)
        
        return {
            "dashboard": {
                "id": dashboard.id,
                "valuation_name": dashboard.valuation_name,
                "client_name": dashboard.client_name,
                "sheet_url": dashboard.sheet_url,
                "created_at": dashboard.created_at.isoformat(),
                "expires_at": dashboard.expires_at.isoformat(),
                "days_remaining": dashboard.days_remaining,
                "view_count": dashboard.view_count,
                "last_sync_at": dashboard.last_sync_at.isoformat() if dashboard.last_sync_at else None,
                "data": dashboard.sheet_data
            }
        }


@router.get("/dashboard/{access_token}")
async def get_payment_dashboard(access_token: str):
    """Get full dashboard"""
    return await get_dashboard_by_type(access_token, "full")


@router.get("/dashboard/{access_token}/user")
async def get_user_dashboard(access_token: str):
    """Get user-focused dashboard"""
    return await get_dashboard_by_type(access_token, "user")


@router.get("/dashboard/{access_token}/investor")
async def get_investor_dashboard(access_token: str):
    """Get investor-focused dashboard"""
    return await get_dashboard_by_type(access_token, "investor")


@router.post("/dashboard/{access_token}/sync")
async def sync_dashboard_data(access_token: str):
    """Force sync dashboard data with Google Sheets"""
    from models.payment_plan_dashboard import PaymentPlanDashboard
    from datetime import timedelta
    
    with Session(engine) as session:
        dashboard = session.query(PaymentPlanDashboard).filter_by(
            access_token=access_token,
            is_active=True
        ).first()
        
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        if dashboard.is_expired:
            raise HTTPException(status_code=410, detail="Dashboard has expired")
        
        # Rate limiting
        if dashboard.last_sync_at:
            delta = datetime.utcnow() - dashboard.last_sync_at
            if delta.total_seconds() < 60:
                raise HTTPException(status_code=429, detail=f"Please wait {60 - int(delta.total_seconds())} seconds")
        
        apps_script_url = os.getenv('GOOGLE_APPS_SCRIPT_READER_URL', '')
        if not apps_script_url:
            raise HTTPException(status_code=500, detail="Apps Script URL not configured")
        
        try:
            response = requests.get(f"{apps_script_url}?sheetId={dashboard.sheet_id}&type=full")
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to connect to Google Sheets")
            
            result = response.json()
            if not result.get('success'):
                raise HTTPException(status_code=500, detail=f"Error reading sheet: {result.get('error')}")
            
            dashboard.sheet_data = result.get('data', {})
            dashboard.last_sync_at = datetime.utcnow()
            
        except requests.RequestException as e:
            raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")
        
        session.commit()
        session.refresh(dashboard)
        
        return {
            "success": True,
            "message": "Data synced successfully",
            "last_sync_at": dashboard.last_sync_at.isoformat(),
            "data": dashboard.sheet_data
        }


@router.delete("/dashboard/{access_token}")
async def delete_dashboard(access_token: str):
    """Soft delete a dashboard"""
    from models.payment_plan_dashboard import PaymentPlanDashboard
    
    with Session(engine) as session:
        dashboard = session.query(PaymentPlanDashboard).filter_by(access_token=access_token).first()
        
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        dashboard.is_active = False
        session.commit()
        
        return {"success": True, "message": "Dashboard deleted successfully"}


@router.get("/dashboard/cleanup")
async def cleanup_expired_dashboards():
    """Clean up expired dashboards"""
    from models.payment_plan_dashboard import PaymentPlanDashboard
    
    with Session(engine) as session:
        expired_count = session.query(PaymentPlanDashboard).filter(
            PaymentPlanDashboard.expires_at < datetime.utcnow(),
            PaymentPlanDashboard.is_active == True
        ).update({"is_active": False})
        
        session.commit()
        
        return {"success": True, "message": f"Cleaned up {expired_count} expired dashboards"}
