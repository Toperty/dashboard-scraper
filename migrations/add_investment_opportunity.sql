-- Oportunidad de inversión: publica el inmueble en el landing de inversionistas
-- Ejecutar con: python backend/scripts/run_migration.py migrations/add_investment_opportunity.sql
ALTER TABLE valuation ADD COLUMN IF NOT EXISTS investment_opportunity boolean NOT NULL DEFAULT false;
