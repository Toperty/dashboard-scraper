#!/usr/bin/env python3
"""
Initialize database tables
"""
import os
from sqlmodel import SQLModel, create_engine
from models.city import City
from models.property import Property
from models.scraper_log import ScraperLog

# Get database configuration from environment variables
ADMIN_USER = os.getenv("ADMIN_USER", "postgres")
PASSWORD = os.getenv("PASSWORD", "dashboard_password")
HOST = os.getenv("HOST", "postgres")
DB_NAME = os.getenv("DB_NAME", "dashboard_db")
DB_PORT = os.getenv("DB_PORT", "5432")

# Create PostgreSQL connection string
DATABASE_URL = f"postgresql://{ADMIN_USER}:{PASSWORD}@{HOST}:{DB_PORT}/{DB_NAME}"

def init_tables():
    """Initialize all tables"""
    print(f"Connecting to database: {DATABASE_URL}")
    
    engine = create_engine(DATABASE_URL, echo=True)
    
    print("Creating tables...")
    SQLModel.metadata.create_all(engine)
    print("Tables created successfully!")

if __name__ == "__main__":
    init_tables()