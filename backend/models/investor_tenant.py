"""
Investor Tenant Info model - Información del inquilino para PDF de inversionistas
"""
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import ForeignKey, Integer

class InvestorTenantInfo(SQLModel, table=True):
    """Información del inquilino para propuestas de inversión"""
    
    __tablename__ = "investor_tenant_info"
    
    id: Optional[int] = Field(default=None, primary_key=True, description="Unique ID")
    
    # Relación con valuación (uno a uno)
    valuation_id: int = Field(
        sa_column=Column(Integer, ForeignKey("valuation.id", ondelete="CASCADE"), unique=True),
        description="ID de la valuación asociada"
    )
    
    # Información financiera del inquilino
    monthly_income: Optional[float] = Field(default=None, description="Ingresos mensuales certificados del núcleo familiar")
    monthly_payment: Optional[float] = Field(default=None, description="Cuota mensual total")
    income_coverage_ratio: Optional[float] = Field(default=None, description="Cobertura ingresos/cuota")
    payment_to_income_ratio: Optional[float] = Field(default=None, description="Ratio cuota/ingresos")
    
    # Información laboral y crediticia
    employer: Optional[str] = Field(max_length=255, default=None, description="Empleador")
    credit_score: Optional[int] = Field(default=None, description="Score crediticio promedio del núcleo familiar")
    score_date: Optional[datetime] = Field(default=None, description="Fecha del score crediticio")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Last update timestamp")
    
    def calculate_ratios(self):
        """Calcular ratios automáticamente basado en ingresos y pagos"""
        if self.monthly_income and self.monthly_payment:
            self.income_coverage_ratio = round(self.monthly_income / self.monthly_payment, 2)
            self.payment_to_income_ratio = round(self.monthly_payment / self.monthly_income, 2)