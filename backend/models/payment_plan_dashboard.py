"""
Payment Plan Dashboard model - Represents temporary dashboards for payment plans
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlmodel import SQLModel, Field, JSON, Column
import secrets
import string

def generate_access_token(length: int = 32) -> str:
    """Generate a secure random access token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def get_expiration_date(days: int = 10) -> datetime:
    """Get expiration date X days from now"""
    return datetime.utcnow() + timedelta(days=days)

class PaymentPlanDashboard(SQLModel, table=True):
    """Payment Plan Dashboard table for temporary dashboard access"""
    
    __tablename__ = "payment_plan_dashboard"
    
    id: Optional[int] = Field(default=None, primary_key=True, description="Unique dashboard ID")
    
    # Google Sheets reference
    sheet_id: str = Field(max_length=255, description="Google Sheets document ID", index=True)
    sheet_url: str = Field(description="Full Google Sheets URL")
    
    # Valuation reference
    valuation_id: Optional[int] = Field(default=None, foreign_key="valuation.id", description="Related valuation ID")
    valuation_name: str = Field(max_length=255, description="Name of the valuation")
    
    # Access control
    access_token: str = Field(
        default_factory=generate_access_token,
        max_length=64,
        unique=True,
        index=True,
        description="Unique access token for dashboard"
    )
    dashboard_url: str = Field(default="", description="Public dashboard URL")
    
    # Cached data from Google Sheets
    sheet_data: Dict[str, Any] = Field(
        default={},
        sa_column=Column(JSON),
        description="Cached data from Google Sheets"
    )
    
    # Client information
    client_name: str = Field(max_length=255, description="Client name")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    expires_at: datetime = Field(
        default_factory=lambda: get_expiration_date(10),
        description="Expiration timestamp (10 days from creation)"
    )
    last_sync_at: Optional[datetime] = Field(default=None, description="Last synchronization with Google Sheets")
    
    # Status
    is_active: bool = Field(default=True, description="Whether dashboard is active")
    view_count: int = Field(default=0, description="Number of times dashboard was viewed")
    
    @property
    def is_expired(self) -> bool:
        """Check if dashboard has expired"""
        return datetime.utcnow() > self.expires_at
    
    @property
    def days_remaining(self) -> int:
        """Calculate days remaining until expiration"""
        if self.is_expired:
            return 0
        delta = self.expires_at - datetime.utcnow()
        return max(0, delta.days)
    
    @property
    def sync_needed(self) -> bool:
        """Check if sync is needed (more than 5 minutes since last sync)"""
        if not self.last_sync_at:
            return True
        delta = datetime.utcnow() - self.last_sync_at
        return delta.total_seconds() > 300  # 5 minutes