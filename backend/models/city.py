"""
City model - Represents cities where scrapers operate
"""
from datetime import date
from typing import Optional
from sqlmodel import SQLModel, Field

class City(SQLModel, table=True):
    """City table for tracking scraper progress by location"""
    
    __tablename__ = "city"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, description="Human readable city name like 'Bogotá'")
    website_name: str = Field(max_length=50, description="URL code like 'bogota'")
    
    # Scraping progress tracking
    current_sell_offset: int = Field(default=0, description="Current page for sell offers")
    current_rent_offset: int = Field(default=0, description="Current page for rent offers")
    sell_pages_limit: int = Field(default=0, description="Total pages for sell offers")
    rent_pages_limit: int = Field(default=0, description="Total pages for rent offers")
    
    # Status tracking
    updated: bool = Field(default=False, description="Whether the cycle is completed")
    last_updated: Optional[date] = Field(default=None, description="Last update date")
    properties_updated: int = Field(default=0, description="Number of properties updated")
    
