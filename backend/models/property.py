"""
Property model - Represents real estate properties scraped from websites
"""
from datetime import date
from typing import Optional
from sqlmodel import SQLModel, Field

class Property(SQLModel, table=True):
    """Property table for storing scraped real estate data"""
    
    __tablename__ = "property"
    
    fr_property_id: int = Field(primary_key=True, description="Property ID from the real estate website")
    
    # Property details
    area: Optional[float] = Field(default=None, description="Property area in square meters")
    rooms: Optional[int] = Field(default=None, description="Number of rooms")
    price: Optional[float] = Field(default=None, description="Property price")
    offer: str = Field(max_length=10, description="Type of offer: 'sell' or 'rent'")
    
    # Tracking dates
    creation_date: Optional[date] = Field(default=None, description="Date when property was first scraped")
    last_update: Optional[date] = Field(default=None, description="Date when property was last updated")
    
    # Foreign key to city
    city_id: Optional[int] = Field(default=None, foreign_key="city.id", description="ID of the city where property is located")
    
    # Location coordinates
    latitude: Optional[float] = Field(default=None, description="Property latitude coordinate")
    longitude: Optional[float] = Field(default=None, description="Property longitude coordinate")
    
    # Additional fields from database
    title: Optional[str] = Field(default=None, description="Property title")
    location_main: Optional[str] = Field(default=None, description="Main location description")
    stratum: Optional[int] = Field(default=None, description="Property stratum")
    baths: Optional[int] = Field(default=None, description="Number of bathrooms")
    garages: Optional[int] = Field(default=None, description="Number of garages")
    antiquity: Optional[int] = Field(default=None, description="Property age in years")
    is_new: Optional[bool] = Field(default=None, description="Whether property is new")
    
