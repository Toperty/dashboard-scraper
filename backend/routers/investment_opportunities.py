"""
Investment opportunities router.

Feed público (solo lectura) de los avalúos publicados como oportunidad de
inversión (valuation.investment_opportunity = true), consumido por el landing
de inversionistas (inversionistas.toperty.co). Devuelve un payload
denormalizado por inmueble: datos físicos, foto de fachada con URL firmada
fresca y el resumen financiero cacheado del plan de pagos.
"""
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter
from sqlmodel import Session, select

from config.db_connection import engine
from config.gcs_config import gcs_client
from models.valuation import Valuation
from models.property_images import PropertyImage
from models.payment_plan_dashboard import PaymentPlanDashboard

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["investment-opportunities"])

# Claves del resumen financiero que expone el feed (sheet_data['resumen'])
RESUMEN_KEYS = [
    "direccion",
    "ciudad",
    "valor_comercial_toperty",
    "valor_compra",
    "descuento",
    "canon_arrendamiento",
    "gastos_cierre",
    "cuota_inicial_usuario",
    "monto_total_inversion",
    "multiplo_inversion",
    "cash_on_cash_yield",
    "retornos_estimados",
    "valorizacion",
]


def _fresh_image_url(image_path: Optional[str]) -> Optional[str]:
    """URL firmada fresca (las almacenadas expiran a los 7 días)."""
    if not image_path:
        return None
    if image_path.startswith("http") and gcs_client and gcs_client.client:
        fresh = gcs_client.regenerate_signed_url(image_path)
        if fresh:
            return fresh
    return image_path


def _resumen_snapshot(sheet_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not sheet_data or not isinstance(sheet_data, dict):
        return {}
    resumen = sheet_data.get("resumen")
    if not isinstance(resumen, dict):
        return {}
    return {k: resumen.get(k) for k in RESUMEN_KEYS if resumen.get(k) not in (None, "")}


@router.get("/investment-opportunities")
async def list_investment_opportunities():
    """Listar los inmuebles publicados como oportunidad de inversión"""
    try:
        with Session(engine) as session:
            valuations = session.exec(
                select(Valuation)
                .where(Valuation.investment_opportunity == True)  # noqa: E712
                .order_by(Valuation.updated_at.desc())
            ).all()

            opportunities = []
            for v in valuations:
                # Foto de fachada (o la primera por orden) con URL fresca
                images = session.exec(
                    select(PropertyImage)
                    .where(PropertyImage.valuation_id == v.id)
                    .order_by(PropertyImage.is_facade.desc(), PropertyImage.image_order)
                ).all()
                facade_url = _fresh_image_url(images[0].image_path) if images else None

                # Resumen financiero del plan de pagos más reciente activo
                dashboard = session.exec(
                    select(PaymentPlanDashboard)
                    .where(
                        PaymentPlanDashboard.valuation_id == v.id,
                        PaymentPlanDashboard.is_active == True,  # noqa: E712
                    )
                    .order_by(PaymentPlanDashboard.created_at.desc())
                ).first()
                resumen = _resumen_snapshot(dashboard.sheet_data if dashboard else None)

                opportunities.append(
                    {
                        "id": v.id,
                        "valuation_name": v.valuation_name,
                        "area": v.area,
                        "property_type": v.property_type,
                        "rooms": v.rooms,
                        "baths": v.baths,
                        "garages": v.garages,
                        "stratum": v.stratum,
                        "final_price": v.final_price,
                        "total_rent_price": v.total_rent_price,
                        "description": v.description,
                        "image_url": facade_url,
                        "resumen": resumen,
                        "updated_at": v.updated_at.isoformat() if v.updated_at else None,
                    }
                )

            return {"status": "success", "count": len(opportunities), "opportunities": opportunities}
    except Exception as e:
        logger.error(f"Error listando oportunidades de inversión: {e}")
        return {"status": "error", "detail": str(e), "opportunities": []}
