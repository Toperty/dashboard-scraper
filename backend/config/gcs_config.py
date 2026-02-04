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
    logger.info("Google Cloud Storage module loaded successfully")
except ImportError as e:
    GCS_AVAILABLE = False
    storage = None
    logger.warning(f"Google Cloud Storage not available: {e}")

# GCS Configuration
BUCKET_NAME = "appraisals-images"  # Using hyphens as underscores are not allowed in bucket names
BUCKET_REGION = "us-east1"
GCS_PUBLIC_URL = f"https://storage.googleapis.com/{BUCKET_NAME}"
PROJECT_ID = "alpine-shade-475114-r1"  # Project where the bucket is created

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
            # Try multiple authentication methods in order
            
            # 1. Check for explicit service account credentials
            creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            logger.info(f"GOOGLE_APPLICATION_CREDENTIALS env var: {creds_path}")
            logger.info(f"File exists: {os.path.exists(creds_path) if creds_path else 'No path set'}")
            
            if creds_path and os.path.exists(creds_path):
                logger.info(f"Using service account from: {creds_path}")
                # Use the project where the bucket exists, not the service account's project
                self.client = storage.Client.from_service_account_json(creds_path, project=PROJECT_ID)
            else:
                # 2. Try Application Default Credentials (gcloud auth)
                # This will work if user has run 'gcloud auth application-default login'
                try:
                    self.client = storage.Client()
                    logger.info("Using Application Default Credentials")
                except Exception as adc_error:
                    # 3. Try to use gcloud config credentials directly
                    try:
                        # Set project explicitly if available
                        project = os.getenv("GCP_PROJECT") or os.getenv("GOOGLE_CLOUD_PROJECT")
                        if project:
                            self.client = storage.Client(project=project)
                        else:
                            self.client = storage.Client()
                        logger.info("Using gcloud default credentials")
                    except Exception as gcloud_error:
                        raise Exception(f"No valid credentials found. ADC: {adc_error}, gcloud: {gcloud_error}")
            
            self.bucket = self.client.bucket(BUCKET_NAME)
            logger.info(f"GCS client initialized for bucket: {BUCKET_NAME}")
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
            
            # Generate a signed URL valid for 7 days
            from datetime import timedelta
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(days=7),
                method="GET"
            )
            
            # Store the GCS path for reference
            # Return the signed URL for immediate access
            logger.info(f"Image uploaded to GCS: gs://{BUCKET_NAME}/property-images/{filename}")
            return signed_url
        except Exception as e:
            logger.error(f"Failed to upload image to GCS: {e}")
            # Try without signed URL if that fails (for public buckets)
            try:
                return f"https://storage.googleapis.com/{BUCKET_NAME}/property-images/{filename}"
            except:
                return None
    
    def delete_image(self, gcs_path: str) -> bool:
        """
        Delete image from GCS
        
        Args:
            gcs_path: Path in GCS (e.g., 'property-images/uuid.jpg')
            
        Returns:
            True if deleted successfully, False otherwise
        """
        if not self.client or not self.bucket:
            return False
        
        try:
            # Extract path from full URL if necessary
            if gcs_path.startswith("http"):
                gcs_path = gcs_path.replace(f"{GCS_PUBLIC_URL}/", "")
            
            blob = self.bucket.blob(gcs_path)
            blob.delete()
            return True
        except Exception as e:
            logger.error(f"Failed to delete image from GCS: {e}")
            return False

# Initialize GCS client
gcs_client = GCSClient()