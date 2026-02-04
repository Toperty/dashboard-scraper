"""
Property Images model - Imágenes del inmueble para PDF de inversionistas
"""
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import ForeignKey, Integer

class PropertyImage(SQLModel, table=True):
    """Imágenes del inmueble para propuestas de inversión"""
    
    __tablename__ = "property_images"
    
    id: Optional[int] = Field(default=None, primary_key=True, description="Unique image ID")
    
    # Relación con valuación (muchos a uno)
    valuation_id: int = Field(
        sa_column=Column(Integer, ForeignKey("valuation.id", ondelete="CASCADE")),
        description="ID de la valuación asociada"
    )
    
    # Información de la imagen
    image_path: str = Field(description="Ruta relativa de la imagen almacenada")
    image_order: int = Field(default=0, description="Orden de aparición en el PDF")
    caption: Optional[str] = Field(max_length=255, default=None, description="Descripción de la imagen")
    
    # Metadata
    original_filename: Optional[str] = Field(max_length=255, default=None, description="Nombre original del archivo")
    file_size: Optional[int] = Field(default=None, description="Tamaño del archivo en bytes")
    mime_type: Optional[str] = Field(max_length=50, default=None, description="Tipo MIME de la imagen")
    
    # Timestamps
    uploaded_at: datetime = Field(default_factory=datetime.utcnow, description="Upload timestamp")
    
    class Config:
        schema_extra = {
            "example": {
                "valuation_id": 1,
                "image_path": "/uploads/property-images/abc123.jpg",
                "image_order": 1,
                "caption": "Vista frontal del inmueble",
                "original_filename": "fachada.jpg",
                "file_size": 2048576,
                "mime_type": "image/jpeg"
            }
        }