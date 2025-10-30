# 📊 Dashboard de Monitoreo de Scrapers

Sistema completo de monitoreo operacional para scrapers de bienes raíces con frontend en Next.js y backend en FastAPI.

## 🏗️ Arquitectura

### Frontend (Next.js + React + TypeScript)
- **Framework**: Next.js 16.0.0 con React 19.2.0
- **UI**: Tailwind CSS + Radix UI components
- **Gráficos**: Recharts para visualizaciones
- **Estado**: React hooks para manejo de estado
- **Deployment**: Vercel

### Backend (FastAPI + PostgreSQL)
- **Framework**: FastAPI 0.105.0
- **Base de Datos**: PostgreSQL con SQLModel
- **API**: REST endpoints + tiempo real
- **CORS**: Configurado para Vercel

## 🚀 Quick Start

### 1. Configurar Backend
```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales de BD
pip install -r requirements.txt
python start.py
```

### 2. Configurar Frontend
```bash
# En la raíz del proyecto
pnpm install
pnpm dev
```

### 3. Verificar Funcionamiento
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/dashboard
- Documentación: http://localhost:8000/docs

## 📁 Estructura del Proyecto

```
dashboard-scraper/
├── backend/                 # FastAPI backend
│   ├── config/
│   │   └── db_connection.py # Configuración de BD
│   ├── models/              # Modelos SQLModel
│   │   ├── city.py
│   │   ├── property.py
│   │   └── scraper_log.py
│   ├── main.py             # API endpoints
│   ├── start.py            # Script de inicio
│   ├── requirements.txt    # Dependencias Python
│   └── .env.example       # Variables de entorno
├── app/                    # Next.js app directory
├── components/             # React components
├── lib/                    # Utilities
├── styles/                 # CSS styles
├── public/                 # Static assets
├── package.json           # Dependencias Node.js
└── README.md              # Este archivo
```

## 🔧 Configuración de Base de Datos

### Variables de Entorno (.env)
```bash
ADMIN_USER=tu_usuario_db
PASSWORD=tu_password_db
HOST=localhost
DB_NAME=tu_nombre_db
DB_PORT=5432
```

### Tablas Requeridas
El backend espera estas tablas en PostgreSQL:
- `city` - Estado de scrapers por ciudad
- `property` - Inventario de propiedades
- `scraper_logs` - Logs de actividad

## 📊 API Endpoints

- `GET /api/dashboard` - Datos completos del dashboard
- `GET /api/summary` - Resumen ejecutivo
- `GET /api/cities` - Estado de ciudades
- `GET /api/alerts` - Alertas del sistema
- `GET /api/health` - Health check

## 🌐 Deployment

### Frontend (Vercel)
El frontend está configurado para deployment automático en Vercel.

### Backend
Puedes desplegar el backend en:
- **Docker**: Dockerfile incluido
- **Heroku**: Compatible
- **AWS/GCP**: Deploy directo

## ⚙️ Scripts Disponibles

### Frontend
```bash
pnpm dev          # Desarrollo
pnpm build        # Construcción
pnpm start        # Producción
pnpm lint         # Linting
```

### Backend
```bash
python start.py           # Iniciar servidor
uvicorn main:app --reload # Desarrollo con reload
```

## 🔗 Links

- **Frontend Live**: [Vercel Deployment](https://vercel.com/nicolasmaldonadojs-projects/v0-dashboard-de-monitoreo)
- **v0.app Project**: [Continue Building](https://v0.app/chat/projects/GMtKVkI7Tqr)

## 📝 Próximos Pasos

1. **Configurar .env**: Añadir credenciales de BD
2. **Inicializar tablas**: Crear esquema en PostgreSQL
3. **Conectar APIs**: Verificar comunicación frontend-backend
4. **Deploy backend**: Subir a servicio cloud
5. **Configurar CORS**: Actualizar URLs de producción