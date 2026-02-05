"""
Backend API - Dashboard Scraper
Versión refactorizada con arquitectura modular
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# Crear aplicación FastAPI
app = FastAPI(title="Dashboard API", version="2.0.0")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Importar y registrar modelos para SQLModel
from models.valuation import Valuation
from models.payment_plan_dashboard import PaymentPlanDashboard
from models.investor_tenant import InvestorTenantInfo
from models.property_images import PropertyImage

# Inicializar base de datos al arrancar
from config.db_connection import init_db
init_db()
print("✅ Database tables initialized")

# Importar routers
from routers.dashboard import router as dashboard_router
from routers.properties import router as properties_router
from routers.valuations import router as valuations_router
from routers.payment_plans import router as payment_plans_router
from routers.zones import router as zones_router
from routers.investor_form import router as investor_form_router
from routers.investor_presentation import router as investor_presentation_router
from routers.image_proxy import router as image_proxy_router
from routers.approval_letter import router as approval_letter_router

# Registrar routers
app.include_router(dashboard_router)
app.include_router(properties_router)
app.include_router(valuations_router)
app.include_router(payment_plans_router)
app.include_router(zones_router)
app.include_router(investor_form_router)
app.include_router(investor_presentation_router)
app.include_router(image_proxy_router)
app.include_router(approval_letter_router, prefix="/api/approval-letter")

# Importar servicio de estadísticas para el root endpoint
from services.stats_service import get_local_now


@app.get("/")
async def root():
    """Endpoint raíz"""
    return {"message": "Dashboard API is running", "timestamp": get_local_now(), "version": "2.0.0"}


@app.get("/health")
async def health():
    """Endpoint de healthcheck para Docker"""
    return {"status": "healthy", "timestamp": get_local_now()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
