#!/usr/bin/env python3
"""
Script para actualizar todas las URLs de imágenes existentes a URLs firmadas

CÓMO EJECUTAR ESTE SCRIPT:
==========================
1. Desde el host (fuera del contenedor):
   docker cp scripts/update_image_urls.py dashboard_backend_dev:/app/scripts/
   docker-compose exec backend python /app/scripts/update_image_urls.py

2. O programar en cron para ejecutar semanalmente:
   0 0 * * 0 cd /home/camilo/toperty/dashboard-scraper && docker-compose exec -T backend python /app/scripts/update_image_urls.py

NOTA: Las URLs firmadas expiran en 7 días, por lo que este script debe ejecutarse semanalmente.
"""
import os
import sys
from datetime import timedelta
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlmodel import Session, create_engine, select
from models.property_images import PropertyImage
from google.cloud import storage
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration - usa las variables de entorno existentes
DATABASE_URL = f"postgresql://{os.getenv('ADMIN_USER')}:{os.getenv('PASSWORD')}@{os.getenv('HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
engine = create_engine(DATABASE_URL)

# GCS configuration - usa las variables de entorno existentes
BUCKET_NAME = os.getenv('GCS_BUCKET_NAME')
PROJECT_ID = os.getenv('GCP_PROJECT_ID', os.getenv('GOOGLE_CLOUD_PROJECT'))

def generate_signed_url(image_path: str, client: storage.Client) -> str:
    """Generate a signed URL for an existing image"""
    
    # Skip if already has signed URL parameters
    if 'X-Goog-Algorithm' in image_path:
        logger.info(f"Image already has signed URL: {image_path[:80]}...")
        return image_path
    
    # Skip if not a GCS URL
    if not image_path.startswith('https://storage.googleapis.com/'):
        logger.warning(f"Not a GCS URL, skipping: {image_path}")
        return image_path
    
    try:
        # Extract bucket and path from URL
        url_parts = image_path.replace('https://storage.googleapis.com/', '').split('/', 1)
        if len(url_parts) != 2:
            logger.error(f"Invalid URL format: {image_path}")
            return image_path
        
        bucket_name = url_parts[0]
        blob_path = url_parts[1]
        
        # Get the bucket and blob
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        
        # Generate signed URL with 7 days expiration (max allowed)
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(days=7),  # 7 days max expiration allowed by GCS
            method="GET"
        )
        
        logger.info(f"Generated signed URL for {blob_path}")
        return signed_url
        
    except Exception as e:
        logger.error(f"Error generating signed URL for {image_path}: {e}")
        return image_path

def update_all_image_urls():
    """Update all image URLs to signed URLs"""
    
    # Initialize GCS client
    try:
        # Try with service account if available
        creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if creds_path and os.path.exists(creds_path):
            # Use PROJECT_ID if available, otherwise let the client auto-detect
            if PROJECT_ID:
                client = storage.Client.from_service_account_json(creds_path, project=PROJECT_ID)
            else:
                client = storage.Client.from_service_account_json(creds_path)
            logger.info(f"Using service account credentials")
        else:
            # Use default credentials
            client = storage.Client()
            logger.info("Using default credentials")
    except Exception as e:
        logger.error(f"Failed to initialize GCS client: {e}")
        return
    
    # Get all images from database
    with Session(engine) as session:
        images = session.exec(select(PropertyImage)).all()
        
        total = len(images)
        updated = 0
        failed = 0
        skipped = 0
        
        logger.info(f"Found {total} images to process")
        
        for i, image in enumerate(images, 1):
            logger.info(f"Processing image {i}/{total}: ID={image.id}")
            
            # Skip if already has signed URL
            if 'X-Goog-Algorithm' in image.image_path:
                logger.info(f"  Skipping - already has signed URL")
                skipped += 1
                continue
            
            # Generate signed URL
            new_url = generate_signed_url(image.image_path, client)
            
            if new_url != image.image_path:
                # Update the database
                image.image_path = new_url
                session.add(image)
                session.commit()
                updated += 1
                logger.info(f"  Updated successfully")
            else:
                if 'X-Goog-Algorithm' not in new_url:
                    failed += 1
                    logger.warning(f"  Failed to generate signed URL")
                else:
                    skipped += 1
        
        logger.info(f"""
        ========================================
        Update completed:
        - Total images: {total}
        - Updated: {updated}
        - Skipped: {skipped}
        - Failed: {failed}
        ========================================
        """)

if __name__ == "__main__":
    logger.info("Starting image URL update script...")
    logger.info(f"Using bucket: {BUCKET_NAME}")
    update_all_image_urls()
    logger.info("Script completed!")