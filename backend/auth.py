"""
Autenticación e identidad de servidor para el dashboard-scraper.

Hasta ahora el backend NO tenía autenticación: cualquiera en internet podía llamar
los endpoints de escritura. Este módulo introduce identidad real:

  1. En el login, el frontend envía el `credential` de Google (ID token). Aquí se
     VERIFICA contra Google (firma + audience) y se valida el dominio permitido.
  2. Se emite una SESIÓN propia (token firmado con HMAC-SHA256 y `SESSION_SECRET`,
     7 días) para no depender de la expiración de 1h del token de Google ni hacer
     una llamada a Google en cada request.
  3. El middleware exige esa sesión en toda MUTACIÓN (POST/PUT/PATCH/DELETE) y
     rechaza a las cuentas de SOLO LECTURA con 403. Las lecturas (GET) quedan
     abiertas como hasta ahora.

Sin dependencias nuevas: `google.oauth2.id_token` ya viene con `google-cloud-storage`
(instalado) y la firma de sesión usa la stdlib (`hmac`, `hashlib`, `base64`).

ENV requeridas:
  - GOOGLE_CLIENT_ID (o NEXT_PUBLIC_GOOGLE_CLIENT_ID): client id de Google OAuth.
  - SESSION_SECRET (o JWT_SECRET): secreto para firmar la sesión. OBLIGATORIO.
"""
import os
import json
import time
import hmac
import base64
import hashlib
from typing import Optional

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "")
SESSION_SECRET = os.getenv("SESSION_SECRET") or os.getenv("JWT_SECRET", "")

# Mismos permisos que el frontend (ahora validados también en el servidor).
ALLOWED_DOMAINS = ("@toperty.co", "@valio.com.co")
ALLOWED_EMAILS = ("pipesanchezt2@gmail.com", "marivigonzalezb@gmail.com")

# Cuentas de SOLO LECTURA: entran y ven todo, pero no pueden mutar.
READ_ONLY_EMAILS = ("marivigonzalezb@gmail.com",)

SESSION_TTL_SECONDS = 7 * 24 * 3600


def is_allowed_email(email: Optional[str]) -> bool:
    if not email:
        return False
    e = email.lower().strip()
    return e in ALLOWED_EMAILS or any(e.endswith(d) for d in ALLOWED_DOMAINS)


def is_read_only(email: Optional[str]) -> bool:
    if not email:
        return False
    return email.lower().strip() in READ_ONLY_EMAILS


def verify_google_credential(credential: str) -> dict:
    """Verifica el ID token de Google. Lanza ValueError si es inválido."""
    if not GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID no está configurado en el backend")
    # Import perezoso: `google.oauth2` viene con `google-cloud-storage` (ya instalado);
    # solo se necesita al verificar un credential, no al cargar el módulo.
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests

    info = google_id_token.verify_oauth2_token(
        credential, google_requests.Request(), GOOGLE_CLIENT_ID
    )
    # `verify_oauth2_token` ya valida firma, audience y expiración.
    if not info.get("email"):
        raise ValueError("El token de Google no contiene email")
    return info


def _b64u_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64u_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def create_session(email: str, name: str = "") -> str:
    """Crea un token de sesión firmado (body.firma) con expiración."""
    if not SESSION_SECRET:
        raise ValueError("SESSION_SECRET no está configurado en el backend")
    payload = {
        "email": email.lower().strip(),
        "name": name,
        "readonly": is_read_only(email),
        "exp": int(time.time()) + SESSION_TTL_SECONDS,
    }
    body = _b64u_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _b64u_encode(hmac.new(SESSION_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify_session(token: Optional[str]) -> Optional[dict]:
    """Verifica firma + expiración de la sesión. Devuelve el payload o None."""
    if not token or not SESSION_SECRET:
        return None
    try:
        body, sig = token.split(".", 1)
        expected = _b64u_encode(
            hmac.new(SESSION_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
        )
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(_b64u_decode(body))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None
