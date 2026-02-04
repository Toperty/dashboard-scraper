"""
Image proxy router to serve images from GCS or local storage
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
import requests
import os
from pathlib import Path

router = APIRouter(prefix="/api/images", tags=["images"])

@router.get("/proxy")
async def proxy_image(url: str):
    """Proxy para servir imágenes desde GCS o almacenamiento local"""
    
    if not url:
        raise HTTPException(status_code=400, detail="URL parameter is required")
    
    if url.startswith("http"):
        # Es una URL de GCS, hacer fetch y devolver
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                return Response(
                    content=response.content,
                    media_type=response.headers.get("content-type", "image/jpeg"),
                    headers={
                        "Cache-Control": "public, max-age=3600",
                        "Access-Control-Allow-Origin": "*"
                    }
                )
            else:
                raise HTTPException(status_code=404, detail=f"Image not found: {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"Request error proxying image: {e}")
            raise HTTPException(status_code=502, detail=f"Failed to fetch image: {str(e)}")
            
    elif url.startswith("/uploads"):
        # Es una ruta local
        try:
            file_path = Path(url.lstrip('/'))
            if file_path.exists() and file_path.is_file():
                with open(file_path, "rb") as f:
                    content = f.read()
                
                # Determinar el tipo MIME
                ext = file_path.suffix.lower()
                mime_types = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.webp': 'image/webp'
                }
                media_type = mime_types.get(ext, 'image/jpeg')
                
                return Response(
                    content=content,
                    media_type=media_type,
                    headers={
                        "Cache-Control": "public, max-age=3600",
                        "Access-Control-Allow-Origin": "*"
                    }
                )
            else:
                raise HTTPException(status_code=404, detail=f"Local image not found: {file_path}")
        except Exception as e:
            print(f"Error reading local file: {e}")
            raise HTTPException(status_code=500, detail=f"Error reading local file: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail=f"Invalid image URL format: {url}")