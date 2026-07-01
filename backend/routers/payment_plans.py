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
from datetime import datetime, timedelta
from typing import Dict, Any
import asyncio
import aiohttp

router = APIRouter(prefix="/api", tags=["payment-plans"])


def _is_sheet_data_complete(data: Any) -> bool:
    """
    Determina si los datos sincronizados del sheet están completos, es decir,
    si las fórmulas ya fueron calculadas. Consideramos completo si alguna de las
    secciones financieras clave tiene al menos un valor significativo.
    """
    if not isinstance(data, dict) or not data:
        return False
    for section in ('resumen', 'flujo_interno'):
        sec = data.get(section)
        if isinstance(sec, dict) and any(
            v not in (None, '', 0, '0', '0.0') for v in sec.values()
        ):
            return True
    return False


def _sync_full_sheet_data(sheet_id: str, max_attempts: int = 4) -> Optional[Dict[str, Any]]:
    """
    Sincroniza los datos completos del sheet desde el Apps Script reader, con
    reintentos y backoff para dar tiempo a que Google Sheets calcule las fórmulas.

    Devuelve el dict de datos cuando los considera completos. Si nunca quedan
    "completos" pero se obtuvo alguna respuesta válida, devuelve la última
    (mejor que descartar datos parciales). Devuelve None si no se pudo sincronizar.
    """
    apps_script_reader_url = os.getenv('GOOGLE_APPS_SCRIPT_READER_URL', '')
    if not apps_script_reader_url or not sheet_id:
        return None

    import time
    last_data: Optional[Dict[str, Any]] = None
    for attempt in range(1, max_attempts + 1):
        # Backoff creciente (3s, 4s, 5s, 6s) para esperar el cálculo de fórmulas
        time.sleep(min(2 + attempt, 6))
        try:
            resp = requests.get(
                f"{apps_script_reader_url}?sheetId={sheet_id}",
                timeout=60
            )
            if resp.status_code != 200:
                print(f"[sync] sheet {sheet_id} intento {attempt}/{max_attempts}: HTTP {resp.status_code}")
                continue

            result = resp.json()
            if not result.get('success'):
                print(f"[sync] sheet {sheet_id} intento {attempt}/{max_attempts}: success=false")
                continue

            data = result.get('data', {}) or {}
            last_data = data
            if _is_sheet_data_complete(data):
                print(f"[sync] sheet {sheet_id} completo en intento {attempt} (keys: {list(data.keys())})")
                return data

            print(f"[sync] sheet {sheet_id} intento {attempt}/{max_attempts}: datos incompletos, reintentando")
        except Exception as e:
            print(f"[sync] sheet {sheet_id} intento {attempt}/{max_attempts}: error {e}")

    if last_data is not None:
        print(f"[sync] sheet {sheet_id}: nunca quedó completo, devolviendo última respuesta parcial")
    return last_data


def _deep_merge_sheet_data(base: Any, override: Any) -> Any:
    """
    Combina recursivamente dos estructuras de sheet_data. `override` (datos
    sincronizados desde el Sheet) gana sobre `base` (datos básicos del formulario),
    PERO sin eliminar claves que el Sheet no devuelve ni pisar con valores vacíos.

    Esto evita que el sync borre campos de 'Para Envío Usuario' que solo existen en
    el formulario y nunca vuelven desde el Sheet (client_id, co_applicant_name,
    co_applicant_id, etc.).
    """
    if not isinstance(base, dict) or not isinstance(override, dict):
        return override

    merged = dict(base)
    for key, ov in override.items():
        bv = merged.get(key)
        if isinstance(bv, dict) and isinstance(ov, dict):
            merged[key] = _deep_merge_sheet_data(bv, ov)
        elif ov is None or (isinstance(ov, str) and ov.strip() == ''):
            # No sobrescribir con vacío si ya hay un valor en base
            if key not in merged:
                merged[key] = ov
        else:
            merged[key] = ov
    return merged


def ensure_dashboard_synced(dashboard, session) -> bool:
    """
    Garantiza que un dashboard tenga datos completos antes de consumirlos en
    cualquier parte (presentación, vista, edición, PDF, etc.).

    Si los datos están incompletos (el sync al crear el plan falló o las fórmulas
    no habían terminado de calcular), re-sincroniza con reintentos y persiste.
    Devuelve True si tras esto los datos quedaron completos.

    Es idempotente y barato cuando ya están completos: no hace ninguna llamada
    externa en ese caso.
    """
    if not dashboard:
        return False
    if _is_sheet_data_complete(dashboard.sheet_data):
        return True
    if not dashboard.sheet_id:
        return False

    print(f"[ensure] dashboard {dashboard.id} con datos incompletos, re-sincronizando...")
    resynced = _sync_full_sheet_data(dashboard.sheet_id)
    if resynced:
        # Merge para no perder campos del formulario ('Para Envío Usuario')
        dashboard.sheet_data = _deep_merge_sheet_data(dashboard.sheet_data or {}, resynced)
        dashboard.last_sync_at = datetime.utcnow()
        session.add(dashboard)
        session.commit()
        session.refresh(dashboard)

    complete = _is_sheet_data_complete(dashboard.sheet_data)
    print(f"[ensure] dashboard {dashboard.id} {'completo' if complete else 'aún incompleto'} tras re-sync")
    return complete


def refresh_dashboard_expiration(dashboard, session, days: int = 10) -> None:
    """
    Renueva la validez de un dashboard: lo reactiva y empuja su expiración a al
    menos `days` días desde hoy. Nunca acorta una expiración mayor existente.

    Se usa, por ejemplo, al generar la presentación para que el link del dashboard
    de inversionista siga vigente.
    """
    if not dashboard:
        return
    new_expiration = datetime.utcnow() + timedelta(days=days)
    dashboard.is_active = True
    if not dashboard.expires_at or dashboard.expires_at < new_expiration:
        dashboard.expires_at = new_expiration
    session.add(dashboard)
    session.commit()
    session.refresh(dashboard)
    print(f"[expire] dashboard {dashboard.id} renovado, expira {dashboard.expires_at.isoformat()}")


class PaymentPlanRequest(BaseModel):
    """Request model for payment plan data"""
    valuation_name: str
    # Configuración del Programa
    programa: str  # ID del programa (programa_1 a programa_7)
    template_sheet_id: str  # ID del template de Google Sheets
    valor_lanzamiento: str  # descuento | comercial
    tipo_programa: str  # lineal | gradiente
    tipo_vivienda: str  # nueva | usada
    alistamiento_acabados: str  # si | no
    financiacion_gastos: str  # si | no
    # Flujo Toperty Interno
    area: str
    commercial_value: str
    average_purchase_value: str
    asking_price: str
    user_down_payment: str
    program_months: str
    potential_down_payment: str
    bank_mortgage_rate: str
    dupla_bank_rate: str
    # Para Envío Usuario
    client_name: str
    address: str
    city: str
    country: str
    construction_year: str
    stratum: str
    apartment_type: str
    private_parking: str
    # Co-aplicante
    client_id: str = ""
    co_applicant_name: str = ""
    co_applicant_id: str = ""
    # Campos para hoja Resumen
    rooms: str = ""
    garages: str = ""


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
        
        response = requests.get(full_url, allow_redirects=True, timeout=60)
        
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
                            'configuracion_programa': {
                                'programa': payment_plan_data.programa,
                                'template_sheet_id': payment_plan_data.template_sheet_id,
                                'valor_lanzamiento': payment_plan_data.valor_lanzamiento,
                                'tipo_programa': payment_plan_data.tipo_programa,
                                'tipo_vivienda': payment_plan_data.tipo_vivienda,
                                'alistamiento_acabados': payment_plan_data.alistamiento_acabados,
                                'financiacion_gastos': payment_plan_data.financiacion_gastos
                            },
                            'flujo_interno': {
                                'area': payment_plan_data.area,
                                'commercial_value': payment_plan_data.commercial_value,
                                'average_purchase_value': payment_plan_data.average_purchase_value,
                                'asking_price': payment_plan_data.asking_price,
                                'user_down_payment': payment_plan_data.user_down_payment,
                                'program_months': payment_plan_data.program_months,
                                'potential_down_payment': payment_plan_data.potential_down_payment,
                                'bank_mortgage_rate': payment_plan_data.bank_mortgage_rate,
                                'dupla_bank_rate': payment_plan_data.dupla_bank_rate
                            },
                            'para_usuario': {
                                'client_name': payment_plan_data.client_name,
                                'client_id': payment_plan_data.client_id,
                                'address': payment_plan_data.address,
                                'city': payment_plan_data.city,
                                'country': payment_plan_data.country,
                                'construction_year': payment_plan_data.construction_year,
                                'stratum': payment_plan_data.stratum,
                                'apartment_type': payment_plan_data.apartment_type,
                                'private_parking': payment_plan_data.private_parking,
                                'co_applicant_name': payment_plan_data.co_applicant_name,
                                'co_applicant_id': payment_plan_data.co_applicant_id
                            }
                        }
                        
                        if existing_dashboard:
                            existing_dashboard.sheet_id = sheet_id
                            existing_dashboard.sheet_url = sheet_url
                            # Merge de los básicos del formulario SOBRE la data completa previa
                            # (no reemplazo). Así los valores recién editados se aplican de
                            # inmediato y, si el sync fallara, el dashboard conserva el resto de
                            # la data completa anterior (resumen, flujos, gráficas) en vez de
                            # quedar solo con lo básico (que el read ya no autocura por verse
                            # "completo").
                            existing_dashboard.sheet_data = _deep_merge_sheet_data(
                                existing_dashboard.sheet_data or {}, sheet_data
                            )

                            session.commit()
                            session.refresh(existing_dashboard)

                            # Ahora sincronizar (con reintentos) para traer los valores recalculados del Sheet
                            synced_data = _sync_full_sheet_data(sheet_id)
                            if synced_data:
                                # Merge en vez de overwrite: conserva 'Para Envío Usuario' del formulario
                                existing_dashboard.sheet_data = _deep_merge_sheet_data(
                                    existing_dashboard.sheet_data or {}, synced_data
                                )
                                existing_dashboard.last_sync_at = datetime.utcnow()
                                session.commit()
                                session.refresh(existing_dashboard)
                                print(f"Successfully synced full data after edit - data keys: {list(existing_dashboard.sheet_data.keys())}")
                            else:
                                print("Warning: Could not sync full data after edit, dashboard conserva data completa previa + nuevos básicos")

                            # Construir URL completa para la respuesta
                            base_url = os.getenv('NEXT_PUBLIC_API_URL', 'http://localhost:3000')
                            full_dashboard_url = f"{base_url}{existing_dashboard.dashboard_url}"
                            
                            return PaymentPlanResponse(
                                success=True,
                                sheet_url=sheet_url,
                                dashboard_url=full_dashboard_url,
                                message=f'Plan de pagos actualizado exitosamente. Dashboard válido por {existing_dashboard.days_remaining} días.'
                            )
                        else:
                            # Crear dashboard con datos básicos
                            dashboard = PaymentPlanDashboard(
                                sheet_id=sheet_id,
                                sheet_url=sheet_url,
                                valuation_id=valuation_id,
                                valuation_name=valuation_name_to_use,
                                client_name=payment_plan_data.client_name,
                                sheet_data=sheet_data
                            )
                            
                            # Guardar solo el path relativo (sin base URL)
                            dashboard.dashboard_url = f"/dashboard/payment-plan/{dashboard.access_token}"
                            
                            session.add(dashboard)
                            session.commit()
                            session.refresh(dashboard)

                            # Ahora sincronizar (con reintentos) para obtener datos completos
                            synced_data = _sync_full_sheet_data(sheet_id)
                            if synced_data:
                                # Merge en vez de overwrite: conserva 'Para Envío Usuario' del formulario
                                dashboard.sheet_data = _deep_merge_sheet_data(
                                    dashboard.sheet_data or {}, synced_data
                                )
                                dashboard.last_sync_at = datetime.utcnow()
                                session.commit()
                                session.refresh(dashboard)
                                print(f"Successfully synced full data for new plan - data keys: {list(dashboard.sheet_data.keys())}")
                            else:
                                print("Warning: Could not sync full data for new plan, dashboard keeps basic data")

                            # Construir URL completa para la respuesta
                            base_url = os.getenv('NEXT_PUBLIC_API_URL', 'http://localhost:3000')
                            full_dashboard_url = f"{base_url}{dashboard.dashboard_url}"
                            
                            return PaymentPlanResponse(
                                success=True,
                                sheet_url=sheet_url,
                                dashboard_url=full_dashboard_url,
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
            # Construir URL completa para la respuesta
            base_url = os.getenv('NEXT_PUBLIC_API_URL', 'http://localhost:3000')
            full_dashboard_url = f"{base_url}{dashboard.dashboard_url}"
            
            return {
                "exists": True,
                "dashboard_url": full_dashboard_url,
                "sheet_url": dashboard.sheet_url,
                "expires_at": dashboard.expires_at.isoformat(),
                "days_remaining": dashboard.days_remaining
            }
        
        return {"exists": False}


@router.get("/dashboard/data/{valuation_name}")
async def get_dashboard_data(valuation_name: str):
    """Get payment plan data for editing"""
    from models.payment_plan_dashboard import PaymentPlanDashboard
    
    with Session(engine) as session:
        dashboard = session.query(PaymentPlanDashboard).filter(
            PaymentPlanDashboard.valuation_name == valuation_name,
            PaymentPlanDashboard.is_active == True
        ).first()
        
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        # Simplemente devolver los datos tal como están guardados
        if dashboard.sheet_data:
            return {
                "success": True,
                "data": dashboard.sheet_data,
                "client_name": dashboard.client_name
            }
        
        # Si no hay datos almacenados, devolver estructura vacía
        return {
            "success": True,
            "data": {
                "configuracion_programa": {},
                "flujo_interno": {},
                "para_usuario": {}
            },
            "client_name": dashboard.client_name
        }


def process_percentage_values(data: dict) -> dict:
    """
    Procesa valores de porcentaje que vienen como decimales (0.17) y los convierte a porcentajes (17)
    """
    if not isinstance(data, dict):
        return data
    
    processed = {}
    percentage_fields = ['tir', 'retornos_estimados', 'cash_on_cash_yield', 'descuento', 'bank_mortgage_rate', 
                        'dupla_bank_rate', 'projected_roi', 'inflacion_anual', 'inflacion_mensual', 
                        'tasa_valorizacion_usuario', 'estimated_return']
    
    for key, value in data.items():
        if isinstance(value, dict):
            # Recursivamente procesar diccionarios anidados
            processed[key] = process_percentage_values(value)
        elif key in percentage_fields and value is not None:
            # Si es un campo de porcentaje y el valor es menor a 1, multiplicar por 100
            try:
                num_value = float(value) if isinstance(value, str) else value
                if 0 < num_value < 1:
                    processed[key] = num_value * 100
                else:
                    processed[key] = num_value
            except (ValueError, TypeError):
                processed[key] = value
        else:
            processed[key] = value
    
    return processed

async def get_dashboard_by_type(access_token: str, dashboard_type: str = "full", t: Optional[str] = Query(None)):
    """Get payment plan dashboard by access token"""
    from models.payment_plan_dashboard import PaymentPlanDashboard
    
    with Session(engine) as session:
        dashboard = session.query(PaymentPlanDashboard).filter_by(
            access_token=access_token
        ).first()

        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        # El link de inversionistas nunca expira; solo el de cliente ("user"/"full")
        # está sujeto a vencimiento. Para inversionistas se ignora is_expired.
        if dashboard_type != "investor":
            # Expired takes precedence over inactive so the frontend can offer to extend.
            # Soft-deleted dashboards (inactive but not expired) still resolve to 404.
            if dashboard.is_expired:
                raise HTTPException(status_code=410, detail="Dashboard has expired")

        if not dashboard.is_active:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        dashboard.view_count += 1

        # La base de datos es la fuente de verdad: la información completa se guarda
        # al crear/editar el plan desde el formulario (sync 'full' con merge). Las
        # lecturas NO sincronizan con Google Sheets — se sirven directo desde la BD,
        # lo que ahorra varios segundos por request.
        #
        # Única excepción (red de seguridad): si por algún motivo los datos guardados
        # quedaron incompletos (el sync al crear falló o las fórmulas aún no estaban
        # calculadas), se re-sincroniza esta vez para autocurar el registro. Cuando los
        # datos ya están completos, esto no hace ninguna llamada externa.
        should_sync = bool(dashboard.sheet_id) and not _is_sheet_data_complete(dashboard.sheet_data)

        # Only sync if needed - use longer timeout with retries
        if should_sync:
            apps_script_url = os.getenv('GOOGLE_APPS_SCRIPT_READER_URL', '')
            if apps_script_url:
                # Use async request with longer timeout and retry logic
                max_retries = 3
                for attempt in range(max_retries + 1):
                    try:
                        async with aiohttp.ClientSession() as http_session:
                            async with http_session.get(
                                # type=full para que la auto-cura deje SIEMPRE el registro
                                # completo (user + investor), sin importar qué vista se pidió.
                                f"{apps_script_url}?sheetId={dashboard.sheet_id}&type=full",
                                timeout=aiohttp.ClientTimeout(total=60)  # 60 seconds timeout
                            ) as response:
                                if response.status == 200:
                                    result = await response.json()
                                    if result.get('success'):
                                        # Procesar porcentajes antes de guardar
                                        raw_data = result.get('data', {})
                                        # Merge para conservar campos del formulario ('Para Envío Usuario')
                                        dashboard.sheet_data = _deep_merge_sheet_data(
                                            dashboard.sheet_data or {}, process_percentage_values(raw_data)
                                        )
                                        dashboard.last_sync_at = datetime.utcnow()
                                        # Solo terminar si los datos quedaron completos; si las
                                        # fórmulas aún no estaban listas, reintentar dentro del
                                        # presupuesto para no persistir datos incompletos.
                                        if _is_sheet_data_complete(dashboard.sheet_data) or attempt >= max_retries:
                                            break
                                        print(f"Sync de dashboard {dashboard.id} incompleto, reintentando ({attempt + 1}/{max_retries + 1})...")
                                        await asyncio.sleep(1)
                    except asyncio.TimeoutError:
                        if attempt < max_retries:
                            print(f"Timeout syncing with Apps Script for dashboard {dashboard.id}, attempt {attempt + 1}/{max_retries + 1}, retrying...")
                            await asyncio.sleep(1)  # Wait 1 second before retry
                        else:
                            print(f"Timeout syncing with Apps Script for dashboard {dashboard.id} after {max_retries + 1} attempts, using cached data")
                        # Continue with cached data if available
                    except Exception as e:
                        print(f"Error syncing with Apps Script: {e}")
                        break  # Don't retry on non-timeout errors
        
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


@router.post("/dashboard/{access_token}/extend")
async def extend_dashboard_expiration(access_token: str, days: int = 10):
    """Extend dashboard expiration date and reactivate if expired"""
    from models.payment_plan_dashboard import PaymentPlanDashboard
    from datetime import timedelta, datetime
    
    with Session(engine) as session:
        # Don't filter by is_active=True to allow reactivating expired dashboards
        dashboard = session.query(PaymentPlanDashboard).filter_by(
            access_token=access_token
        ).first()
        
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        # Only extend if dashboard is expired or inactive
        if dashboard.is_expired or not dashboard.is_active:
            dashboard.is_active = True
            # Reset expiration from today if expired
            dashboard.expires_at = datetime.utcnow() + timedelta(days=days)
            session.commit()
            
            return {
                "message": "Dashboard expiration extended successfully",
                "new_expiration_date": dashboard.expires_at.isoformat(),
                "days_extended": days,
                "is_active": dashboard.is_active,
                "was_extended": True
            }
        else:
            # Dashboard is active and not expired, no need to extend
            return {
                "message": "Dashboard is active and not expired",
                "new_expiration_date": dashboard.expires_at.isoformat(),
                "days_remaining": dashboard.days_remaining,
                "is_active": dashboard.is_active,
                "was_extended": False
            }


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
            response = requests.get(f"{apps_script_url}?sheetId={dashboard.sheet_id}")
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
    """Report expired dashboards.

    Ya NO se desactivan los dashboards vencidos: el link de inversionista nunca
    expira y comparte el mismo registro que el de cliente, así que poner
    is_active=False mataría también el acceso de inversionista. El vencimiento
    del cliente se controla con is_expired (410) en el endpoint de lectura, sin
    necesidad de desactivar el registro. is_active queda reservado para borrado
    manual explícito.
    """
    from models.payment_plan_dashboard import PaymentPlanDashboard

    with Session(engine) as session:
        expired_count = session.query(PaymentPlanDashboard).filter(
            PaymentPlanDashboard.expires_at < datetime.utcnow(),
            PaymentPlanDashboard.is_active == True
        ).count()

        return {"success": True, "message": f"{expired_count} dashboards de cliente vencidos (inversionista sigue activo)"}
