"""
Google Cloud Storage configuration for image uploads
"""
import os
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Try to import Google Cloud Storage
try:
    from google.cloud import storage
    GCS_AVAILABLE = True
    # Module loaded
except ImportError as e:
    GCS_AVAILABLE = False
    storage = None
    logger.warning(f"Google Cloud Storage not available: {e}")

# GCS Configuration - usa variables de entorno para mayor seguridad
BUCKET_NAME = os.getenv('GCS_BUCKET_NAME', 'appraisals-images')  # Using hyphens as underscores are not allowed in bucket names
BUCKET_REGION = os.getenv('GCS_BUCKET_REGION', 'us-east1')
GCS_PUBLIC_URL = f"https://storage.googleapis.com/{BUCKET_NAME}"
PROJECT_ID = os.getenv('GCP_PROJECT_ID', os.getenv('GOOGLE_CLOUD_PROJECT'))  # Project where the bucket is created

class GCSClient:
    """Google Cloud Storage client for image uploads"""
    
    def __init__(self):
        self.client = None
        self.bucket = None
        self.initialize()
    
    def initialize(self):
        """Initialize GCS client"""
        if not GCS_AVAILABLE:
            logger.warning("GCS module not available, using local storage only")
            return
            
        try:
            # Detect if running in Google Cloud environment
            is_gcp = os.getenv("K_SERVICE") or os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT")
            
            if is_gcp:
                # Running in GCP (Cloud Run, App Engine, etc.) - use automatic credentials
                logger.info("Detected GCP environment, using automatic credentials")
                self.client = storage.Client()
            else:
                # Local development - try service account file
                creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
                
                if creds_path and os.path.exists(creds_path):
                    logger.info("Using service account file for local development")
                    if PROJECT_ID:
                        self.client = storage.Client.from_service_account_json(creds_path, project=PROJECT_ID)
                    else:
                        self.client = storage.Client.from_service_account_json(creds_path)
                else:
                    # Try Application Default Credentials (gcloud auth)
                    try:
                        logger.info("Trying Application Default Credentials")
                        self.client = storage.Client()
                    except Exception as e:
                        raise Exception(f"No valid credentials found for local development: {e}")
            
            self.bucket = self.client.bucket(BUCKET_NAME)
            # GCS client initialized
        except Exception as e:
            logger.warning(f"Could not initialize GCS client: {e}. Will use local storage.")
    
    def upload_image(self, file_content: bytes, filename: str, content_type: str = "image/jpeg") -> Optional[str]:
        """
        Upload image to GCS and return a signed URL
        
        Args:
            file_content: Image bytes
            filename: Filename to save in GCS
            content_type: MIME type of the image
            
        Returns:
            Signed URL of the uploaded image (valid for 7 days) or None if failed
        """
        if not self.client or not self.bucket:
            return None
        
        try:
            blob = self.bucket.blob(f"property-images/{filename}")
            blob.upload_from_string(file_content, content_type=content_type)
            # Image uploaded successfully
        except Exception as upload_error:
            logger.error(f"Failed to upload image: {upload_error}")
            return None
        
        # Generate signed URL - REQUIRED
        try:
            from datetime import timedelta
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(days=7),  # 7 days max expiration allowed by GCS
                method="GET"
            )
            # Signed URL generated successfully
            return signed_url
        except Exception as sign_error:
            logger.error(f"Failed to generate signed URL: {sign_error}")
            logger.error(f"Error type: {type(sign_error).__name__}")
            logger.error(f"This usually means missing service account key file or permissions")
            
            # No fallback - signed URL is required
            return None
    
    def delete_image(self, gcs_url: str) -> bool:
        """
        Delete image from GCS
        
        Args:
            gcs_url: Full URL or path in GCS
            
        Returns:
            True if deleted successfully, False otherwise
        """
        if not self.client or not self.bucket:
            logger.error("GCS client or bucket not initialized")
            return False
        
        try:
            # Extract the blob path from the URL
            blob_path = None
            
            if gcs_url.startswith("https://storage.googleapis.com/"):
                # Remove the base URL and any query parameters (for signed URLs)
                # Example: https://storage.googleapis.com/bucket/path/file.jpg?X-Goog-Algorithm=...
                # We want: path/file.jpg
                
                # Remove query parameters if present
                url_without_params = gcs_url.split('?')[0]
                
                # Extract bucket and path
                # Format: https://storage.googleapis.com/bucket-name/path/to/file.jpg
                parts = url_without_params.replace("https://storage.googleapis.com/", "").split('/', 1)
                
                if len(parts) == 2:
                    bucket_name = parts[0]
                    blob_path = parts[1]
                    
                    # Verify we're deleting from the correct bucket
                    if bucket_name != BUCKET_NAME:
                        logger.warning(f"Attempting to delete from different bucket: {bucket_name} (expected: {BUCKET_NAME})")
                        # Try anyway if it's one of our buckets
                        if bucket_name not in ['appraisals-images', 'toperty-appraisals', 'toperty-public-images']:
                            logger.error(f"Refusing to delete from unknown bucket: {bucket_name}")
                            return False
                else:
                    logger.error(f"Could not parse GCS URL: {gcs_url}")
                    return False
            else:
                # Assume it's already a blob path
                blob_path = gcs_url
            
            if not blob_path:
                logger.error(f"Could not extract blob path from: {gcs_url}")
                return False
            
            # Delete the blob
            blob = self.bucket.blob(blob_path)
            
            # Check if blob exists before trying to delete
            if blob.exists():
                blob.delete()
                # Successfully deleted image from GCS
                return True
            else:
                logger.warning(f"Blob does not exist in GCS: {blob_path}")
                return True  # Return True since the file doesn't exist anyway
                
        except Exception as e:
            logger.error(f"Failed to delete image from GCS: {e}")
            logger.error(f"Error type: {type(e).__name__}")
            return False

# Initialize GCS client
gcs_client = GCSClient()