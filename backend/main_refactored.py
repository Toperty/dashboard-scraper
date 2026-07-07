"""
Backend API - Dashboard Scraper
Versión refactorizada con arquitectura modular
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import re

from auth import verify_session, is_read_only

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

# ─── GUARD DE AUTENTICACIÓN + SOLO LECTURA ──────────────────────────────────
# Toda MUTACIÓN (POST/PUT/PATCH/DELETE) exige una sesión válida; las cuentas de
# SOLO LECTURA reciben 403. Las lecturas (GET) quedan abiertas como antes.
# Esto además cierra el hueco previo: los endpoints de escritura ya NO están
# abiertos a internet sin identidad.
_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
# Escrituras exentas de sesión:
#  - /api/auth/*  → login (aún no hay sesión)
#  - /api/dashboard/{token}/sync → sync del share-link público de plan de pagos
_PUBLIC_WRITE_PREFIXES = ("/api/auth/",)
_PUBLIC_WRITE_REGEXES = (re.compile(r"^/api/dashboard/[^/]+/sync/?$"),)


@app.middleware("http")
async def auth_and_readonly_guard(request: Request, call_next):
    if request.method in _MUTATING_METHODS:
        path = request.url.path
        exempt = path.startswith(_PUBLIC_WRITE_PREFIXES) or any(
            rx.match(path) for rx in _PUBLIC_WRITE_REGEXES
        )
        if not exempt:
            auth_header = request.headers.get("authorization", "")
            token = auth_header[7:].strip() if auth_header[:7].lower() == "bearer " else None
            claims = verify_session(token)
            # El early-return del middleware salta el CORSMiddleware, así que
            # replicamos las cabeceras CORS para que el navegador pueda leer el error.
            cors_headers = {
                "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
                "Access-Control-Allow-Credentials": "true",
            }
            if claims is None:
                return JSONResponse(
                    {"detail": "No autenticado"}, status_code=401, headers=cors_headers
                )
            if is_read_only(claims.get("email")):
                return JSONResponse(
                    {"detail": "Modo solo lectura: no puedes realizar esta acción."},
                    status_code=403,
                    headers=cors_headers,
                )
    return await call_next(request)

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
from routers.client_name import router as client_name_router
from routers.investor_data import router as investor_data_router
from routers.auth import router as auth_router

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
app.include_router(client_name_router)
app.include_router(investor_data_router)
app.include_router(auth_router)

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
