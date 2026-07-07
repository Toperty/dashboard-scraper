"""
Router de autenticación: intercambia el `credential` de Google por una sesión propia
del backend. Es el ÚNICO endpoint de escritura exento del guard de sesión (porque
todavía no hay sesión cuando se llama).
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from auth import (
    verify_google_credential,
    is_allowed_email,
    is_read_only,
    create_session,
)

router = APIRouter(prefix="/api/auth")


class SessionRequest(BaseModel):
    credential: str


@router.post("/session")
def create_session_endpoint(body: SessionRequest):
    # 1. Verificar el ID token contra Google (firma + audience + expiración).
    try:
        info = verify_google_credential(body.credential)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Token de Google inválido: {e}")

    email = (info.get("email") or "").lower().strip()

    # 2. Validar permiso en el SERVIDOR (no confiar solo en el cliente).
    if not is_allowed_email(email):
        raise HTTPException(status_code=403, detail="Correo no autorizado")

    # 3. Emitir sesión propia (7 días).
    token = create_session(email, info.get("name", ""))

    return {
        "token": token,
        "user": {
            "email": email,
            "name": info.get("name", ""),
            "picture": info.get("picture", ""),
            "readonly": is_read_only(email),
        },
    }
