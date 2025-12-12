"""
Valuation model - Represents property valuations/appraisals
"""
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field

class Valuation(SQLModel, table=True):
    """Valuation table for storing property appraisals"""
    
    __tablename__ = "valuation"
    
    id: Optional[int] = Field(default=None, primary_key=True, description="Unique valuation ID")
    
    # Valuation identification
    valuation_name: str = Field(max_length=255, description="Name/description of the valuation", unique=True)
    
    # Property details
    area: float = Field(description="Property area in square meters")
    property_type: int = Field(description="Property type (1=Apartment, 2=House, etc.)")
    rooms: int = Field(description="Number of rooms")
    baths: int = Field(description="Number of bathrooms") 
    garages: int = Field(description="Number of garages")
    stratum: int = Field(description="Property stratum")
    antiquity: int = Field(description="Property age in years")
    
    # Location coordinates
    latitude: float = Field(description="Property latitude coordinate")
    longitude: float = Field(description="Property longitude coordinate")
    
    # Capitalization rate
    capitalization_rate: Optional[float] = Field(default=None, description="Monthly capitalization rate")
    
    # Pricing results
    sell_price_per_sqm: Optional[float] = Field(default=None, description="Sale price per square meter")
    rent_price_per_sqm: Optional[float] = Field(default=None, description="Rental price per square meter")
    total_sell_price: Optional[float] = Field(default=None, description="Total sale price")
    total_rent_price: Optional[float] = Field(default=None, description="Total rental price")
    final_price: Optional[float] = Field(default=None, description="Final appraised value")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Last update timestamp")