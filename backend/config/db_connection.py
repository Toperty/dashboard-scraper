"""
Database connection configuration using SQLModel and PostgreSQL
"""
import os
from sqlmodel import SQLModel, create_engine
from typing import Optional

# Get database configuration from environment variables
ADMIN_USER = os.getenv("ADMIN_USER", "postgres")
PASSWORD = os.getenv("PASSWORD", "password")
HOST = os.getenv("HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "dashboard_db")
DB_PORT = os.getenv("DB_PORT", "5432")

# Create PostgreSQL connection string
DATABASE_URL = f"postgresql://{ADMIN_USER}:{PASSWORD}@{HOST}:{DB_PORT}/{DB_NAME}"

# Create SQLModel engine
engine = create_engine(
    DATABASE_URL,
    echo=bool(os.getenv("DEBUG", "false").lower() == "true"),
    pool_size=5,
    max_overflow=10
)

def init_db():
    """Initialize database tables"""
    SQLModel.metadata.create_all(engine)

def get_database_url() -> str:
    """Get the database URL for external use"""
    return DATABASE_URL