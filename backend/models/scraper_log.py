"""
Scraper Log model - Tracks scraper activity and events
"""
from datetime import datetime
from typing import Optional
from enum import Enum
from sqlmodel import SQLModel, Field

class LogLevel(str, Enum):
    """Log level enumeration"""
    info = "info"
    warning = "warning"
    error = "error"
    success = "success"

class LogType(str, Enum):
    """Log type enumeration for different scraper events"""
    scrape_start = "scrape_start"
    scrape_end = "scrape_end"
    scrape_scheduled = "scrape_scheduled"
    page_processed = "page_processed"
    properties_found = "properties_found"
    error_occurred = "error_occurred"
    validation_completed = "validation_completed"

class ScraperLog(SQLModel, table=True):
    __tablename__ = "scraper_logs"
    """Scraper logs table for tracking all scraper activity"""
    
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(), description="When the log entry was created")
    
    # Scraper identification
    scraper_name: str = Field(max_length=50, description="Name of the scraper")
    city_code: Optional[str] = Field(default=None, max_length=50, description="City code being scraped")
    offer_type: Optional[str] = Field(default=None, max_length=10, description="'sell' or 'rent'")
    
    # Page information
    page_number: Optional[int] = Field(default=None, description="Page number being processed")
    
    # Log details
    log_level: LogLevel = Field(description="Log level: info, warning, error, success")
    log_type: LogType = Field(description="Type of event being logged")
    message: str = Field(description="Log message")
    
    # Performance metrics
    execution_time_ms: Optional[float] = Field(default=None, description="Execution time in milliseconds")
    properties_found: Optional[int] = Field(default=None, description="Number of properties found")
    properties_validated: Optional[int] = Field(default=None, description="Number of properties validated")
    
    # Error tracking
    error_type: Optional[str] = Field(default=None, max_length=100, description="Type of error if applicable")
    
    # Session tracking
    session_id: Optional[str] = Field(default=None, max_length=100, description="Session identifier")
    scheduled_time: Optional[datetime] = Field(default=None, description="When this scrape was scheduled for")
    
