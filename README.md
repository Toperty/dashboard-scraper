# 📊 Dashboard Scraper — Toperty

Plataforma interna de Toperty (bienes raíces en Colombia) que reúne, en un solo dashboard, tres dominios:

1. **Monitoreo de scrapers** — estado operacional de los scrapers de propiedades por ciudad.
2. **Avalúos (valuación)** — predicción de precios con modelos de Machine Learning.
3. **Presentaciones de inversionistas / planes de pago** — genera dashboards públicos con token, presentaciones de Google Slides, cartas de aprobación y PDFs.

Es un único repositorio con **dos aplicaciones desplegadas por separado**:

| App | Stack | Ubicación | Despliegue |
|-----|-------|-----------|------------|
| Frontend | Next.js 14 (App Router) · React 19 · TypeScript · Tailwind v4 · Radix UI | raíz del repo | Vercel |
| Backend | FastAPI 0.105 · SQLModel · PostgreSQL · Python 3.11 | `backend/` | Google Cloud Run |

El frontend se comunica con el backend **solo por HTTP** (`NEXT_PUBLIC_API_URL`, por defecto `http://localhost:8000`). No comparten código. La interfaz, los comentarios y los mensajes de commit están en **español**.

---

## 🚀 Quick Start

### Opción A — Docker (frontend + backend con hot-reload)

```bash
# Requiere un .env en la raíz con las variables descritas más abajo
docker-compose up
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Documentación interactiva (Swagger): http://localhost:8000/docs

### Opción B — Local

**Backend** (desde `backend/`):
```bash
pip install -r requirements.txt
uvicorn main_refactored:app --reload --port 8000
```

> ⚠️ El punto de entrada real es **`main_refactored:app`** (arquitectura modular). Los archivos `main.py`/`start.py` mencionados en versiones antiguas ya no aplican. Tanto `docker-compose`, como `Dockerfile.dev` y `Dockerfile.production` usan `main_refactored`.

**Frontend** (desde la raíz, usa **pnpm**):
```bash
pnpm install
pnpm dev        # http://localhost:3000
```

### Scripts del frontend

```bash
pnpm dev          # Desarrollo
pnpm build        # Build de producción (next build)
pnpm start        # Servidor de producción
pnpm lint         # ESLint (eslint .)
```

> ⚠️ `next.config.mjs` tiene `eslint.ignoreDuringBuilds` y `typescript.ignoreBuildErrors` activados, además de `images.unoptimized`. Un `pnpm build` exitoso **no** garantiza que los tipos o el lint estén sanos; verifícalos aparte. No hay suite de tests en el proyecto.

---

## 🏗️ Arquitectura del Backend (`backend/`)

Arquitectura por capas, registrada en `main_refactored.py`:

```
backend/
├── main_refactored.py     # App FastAPI: CORS abierto, init_db(), registro de routers
├── config/
│   ├── db_connection.py    # Construye DATABASE_URL desde env y expone el `engine` compartido
│   └── gcs_config.py        # Cliente de Google Cloud Storage (bucket de imágenes de avalúos)
├── routers/                 # Un APIRouter por funcionalidad (ver tabla de endpoints)
├── services/                # Lógica de negocio compartida entre routers
├── models/                  # Tablas SQLModel
├── repositories/            # (vacío actualmente)
├── ml_models/               # Modelos LightGBM + metadata.json + city_centroids.json + train.py
├── scripts/                 # Scripts puntuales (migraciones, limpieza, AppScript)
├── uploads/                 # Imágenes subidas (git-ignored)
├── init_db.py               # Inicializador de tablas standalone (city, property, scraper_log)
├── requirements.txt
├── Dockerfile.dev           # Imagen de desarrollo (uvicorn :8000, healthcheck)
└── Dockerfile.production    # Imagen para Cloud Run (puerto 8080, libs de imágenes/mapas)
```

### Flujo de arranque
`main_refactored.py` importa los modelos, llama a `init_db()` (que ejecuta `SQLModel.metadata.create_all`) y registra los routers. **No hay sistema de migraciones**: los cambios de esquema se hacen editando los modelos; los backfills/migraciones puntuales viven en `backend/scripts/` (p. ej. `run_migration.py` para ejecutar `.sql`). Al agregar un modelo nuevo, **impórtalo en `main_refactored.py`** antes de `init_db()` para que se cree la tabla. Los routers abren `Session(engine)` directamente.

CORS está configurado con `allow_origins=["*"]`.

### Servicios (`services/`)
- **`stats_service.py`** — agregaciones del dashboard de monitoreo (`get_city_status`, `get_recent_logs`, `get_next_executions`, `get_property_stats`, `get_avg_speed`, `get_last_execution_time`, `get_recent_errors_count`, `get_system_alerts`) y `get_local_now()` (zona horaria local, vía `pytz`).
- **`google_sheets_reader.py`** — clase `GoogleSheetsReader` que lee Google Sheets con la API oficial (credenciales de cuenta de servicio vía `PRIVATE_KEY`/`CLIENT_EMAIL`).
- **`geo_service.py`** — `calculate_distance` (Haversine), `geocode_address` y `filter_properties_by_distance` para filtros por radio.
- **`property_filters.py`** — constructores de filtros SQLModel para el inventario (habitaciones, baños, garajes, estrato, antigüedad, tipo de propiedad, rangos de precio) y `format_antiquity`.

### Modelos (`models/`)
| Modelo | Tabla | Propósito |
|--------|-------|-----------|
| `City` | `city` | Estado del scraper por ciudad: offsets/límites de páginas de venta y renta, ciclo completado, última actualización. |
| `Property` | `property` | Inventario de propiedades scrapeadas (PK `fr_property_id`); área, precio, oferta (`sell`/`rent`), coordenadas, estrato, etc. FK a `city`. |
| `ScraperLog` | `scraper_logs` | Logs de actividad del scraper con `LogLevel` (info/warning/error/success) y `LogType`, tiempos de ejecución, conteos. |
| `Valuation` | — | Avalúo guardado: características del inmueble, resultados ML (cap rate, precios por m², precio final), favoritos (1–5), descripción (≤680 chars). Nombre único. |
| `InvestorTenantInfo` | — | Datos del inquilino para presentación a inversionistas (ingresos, cuota, ratios de cobertura, score crediticio). FK a `valuation`. |
| `PropertyImage` | — | Imágenes del inmueble para el PDF (ruta, orden, caption, marca de fachada). FK a `valuation`. |
| `PaymentPlanDashboard` | — | Dashboard público con token de acceso de 32 chars y expiración (10 días por defecto); guarda `sheet_id`/`sheet_url`, `sheet_data` (JSON), datos de la presentación de Slides, `view_count`, `is_active`. |

### Modelos de Machine Learning (`ml_models/`)
Dos modelos **LightGBM** (ver `metadata.json` con features + métricas), cacheados a nivel de módulo (se cargan una sola vez, no por request) y servidos por `POST /api/valuation`. Objetivo: `log1p(precio/m²)`; el serving aplica `expm1`.
- **Renta**: `model_rent_lightgbm.txt` (R²≈0.64)
- **Venta**: `model_sell_lightgbm.txt` (R²≈0.64) — antes CatBoost; migrado a LightGBM por mejores métricas y para unificar el serving.

Ambos usan las mismas 14 features: `area, rooms, baths, garages, stratum, latitude, longitude, antiquity, is_new, area_per_room, age_bucket, has_garage, city_id, property_type`.

Códigos de `property_type`: `0` Otro · `1` Apartamento · `2` Casa · `3` Oficina · `4` Local · `5` Bodega · `6` Lote · `7` Estudio · `8` Penthouse · `9` Duplex.

**Alineación frontend ↔ modelo (crítico):** el formulario del avalúo manda los categóricos en un formato distinto al de entrenamiento, así que `valuations.py` los **normaliza** antes de predecir:
- `city_id`: se **deriva de lat/lon** por centroide más cercano (`city_centroids.json`) — el formulario no elige ciudad pero sí trae coordenadas; `city_id` pesa ~17% (renta) y ~26% (venta).
- `age_bucket`: etiquetas del formulario (`0-1`, `1-8`, …) → buckets de entrenamiento (`menos_1_ano`, `1_a_8_anos`, …).
- `is_new`: `si`/`no` → `true`/`false`.

**Reentrenamiento:** pipeline reproducible en `ml_models/train.py` (reemplaza al notebook exploratorio). Toma las credenciales de la BD por variable de entorno (`TRAIN_DB_URI`) y escribe directamente los archivos que carga el backend + `metadata.json`. Ver `ml_models/README.md`.

### Integraciones externas (Google)
El flujo de inversionistas/planes de pago se apoya en varias **Google Apps Script web apps** (URLs en variables de entorno) y en la API de Sheets/Slides/Drive:
- `GOOGLE_APPS_SCRIPT_URL` — crea/escribe el Google Sheet del plan de pago.
- `GOOGLE_APPS_SCRIPT_READER_URL` — lee de vuelta los datos calculados del Sheet. Como las fórmulas de Sheets se calculan de forma asíncrona, `payment_plans.py` **consulta con reintentos y backoff** hasta que los datos lucen "completos" antes de servirlos.
- `APPSCRIPT_PRESENTATION_URL` — genera la presentación de Google Slides (código fuente en `scripts/appscript_final.gs`, que usa permisos de Drive/Slides/Sheets).
- `APPSCRIPT_APPROVAL_LETTER_URL` — genera la carta de aprobación.

Los PDFs se generan del lado del servidor con **reportlab** y también del lado del cliente con **jsPDF + html2canvas** (`lib/investor-pdf-generator.ts`). Las imágenes de avalúos se suben a **Google Cloud Storage** (bucket `appraisals-images`).

### Scripts (`backend/scripts/`)
- `cleanup_dashboards.py` — desactiva dashboards públicos expirados; pensado para correr como cron golpeando `GET /api/dashboard/cleanup`.
- `run_migration.py` — ejecuta un archivo `.sql` de migración manual.
- `update_image_urls.py` — actualiza las URLs de imágenes existentes a URLs firmadas.
- `appscript_final.gs` — fuente del Apps Script de presentaciones.

---

## 📡 Endpoints de la API

Casi todos los routers se montan bajo el prefijo `/api` (excepto `approval_letter`, montado en `/api/approval-letter`, e `image_proxy` en `/api/images`).

### Dashboard de monitoreo (`routers/dashboard.py`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/dashboard` | Dashboard completo con datos reales de BD |
| GET | `/api/summary` | Resumen con cambios porcentuales |
| GET | `/api/health` | Health check |
| GET | `/api/cities/list` | Lista de ciudades para filtros |

### Propiedades (`routers/properties.py`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/properties` | Inventario paginado con filtros |
| GET | `/api/properties/by-zone` | Propiedades por zona |
| POST | `/api/properties/send-excel` | Envía propiedades por email en formato Excel |

### Avalúos (`routers/valuations.py`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/valuation` | Calcula avalúo con los modelos ML |
| POST | `/api/save-valuation` | Guarda o actualiza un avalúo |
| GET | `/api/valuations` | Lista paginada de avalúos guardados |
| DELETE | `/api/valuations/{id}` | Elimina un avalúo |
| PUT | `/api/valuations/{id}/favorite` | Marca/desmarca como favorito |
| PUT | `/api/valuations/favorites/reorder` | Reordena favoritos |

### Análisis de zonas (`routers/zones.py`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/zone-statistics` | Estadísticas por zona |
| GET | `/api/zone-statistics-full` | Estadísticas completas por zona |
| GET | `/api/zone-details` | Detalle de una zona |
| GET | `/api/all-postal-codes` | Códigos postales por ciudad |

### Planes de pago / dashboards públicos (`routers/payment_plans.py`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/google-sheets` | Crea un Google Sheet con los datos del plan de pago |
| GET | `/api/dashboard/check/{valuation_name}` | Verifica si ya existe un dashboard (incluye `is_expired`; la UI ofrece "Ampliar plazo" si expiró) |
| GET | `/api/dashboard/data/{valuation_name}` | Datos del plan de pago para edición |
| GET | `/api/dashboard/{access_token}` | Dashboard completo (público) |
| GET | `/api/dashboard/{access_token}/user` | Vista enfocada al usuario |
| GET | `/api/dashboard/{access_token}/investor` | Vista enfocada al inversionista |
| POST | `/api/dashboard/{access_token}/extend` | Extiende la expiración y reactiva (`days` 1–10, tope validado en backend) |
| POST | `/api/dashboard/{access_token}/sync` | Fuerza sincronización con Google Sheets |
| DELETE | `/api/dashboard/{access_token}` | Soft delete del dashboard |
| GET | `/api/dashboard/cleanup` | Reporta/desactiva dashboards expirados (cron) |

### Formulario de inversionistas (`routers/investor_form.py`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST/GET | `/api/investor-form/tenant-info/{valuation_id}` | Crea/obtiene info del inquilino |
| POST/GET | `/api/investor-form/images/{valuation_id}` | Sube/lista imágenes del inmueble |
| DELETE | `/api/investor-form/images/{image_id}` | Elimina imagen y su archivo |
| PUT | `/api/investor-form/valuation/{valuation_id}` | Actualiza campos opcionales del avalúo |
| GET | `/api/investor-form/financial-data/{valuation_id}` | Datos financieros desde el dashboard (sin persistir) |
| GET | `/api/investor-form/financial-data-fast/{valuation_id}` | Versión optimizada (solo datos básicos) |
| GET | `/api/investor-form/data/{valuation_id}` | Todos los datos para generar el PDF |
| GET | `/api/investor-form/validate/{valuation_id}` | Valida que estén completos los campos del PDF |

### Presentación de inversionistas (`routers/investor_presentation.py`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/investor-presentation/generate` | Genera presentación de Slides vía AppScript |
| GET | `/api/investor-presentation/check-dashboard/{valuation_id}` | Verifica qué datos de dashboard existen |
| GET | `/api/investor-presentation/debug/{valuation_id}` | Debug de los datos enviados al AppScript |
| GET | `/api/investor-presentation/template-variables` | Variables disponibles para la plantilla |

### Otros
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/approval-letter/generate` | Genera carta de aprobación vía Apps Script |
| GET | `/api/images/proxy` | Proxy de imágenes desde GCS o almacenamiento local |
| GET | `/api/dashboard/{token}/client-name` | Nombre del cliente del dashboard |
| GET | `/api/dashboard/{token}/investor-data` | Datos del inversionista del dashboard |
| GET | `/` y `/health` | Root y healthcheck de la app (en `main_refactored.py`) |

---

## 🖥️ Arquitectura del Frontend (raíz)

```
app/                                  # Next.js App Router
├── layout.tsx                        # Layout raíz: fuentes corporativas (Satoshi self-hosted, Switzer, Inter) + providers (Alert/Confirm/Toast/Tooltip)
├── page.tsx                          # Dashboard interno, envuelto en <AuthGate>
├── boundaries/page.tsx               # Redirige a "/" (legacy)
└── dashboard/payment-plan/[token]/   # Dashboards PÚBLICOS con token (sin AuthGate)
    ├── page.tsx                      #   vista por defecto
    ├── user/page.tsx                 #   vista usuario
    └── investor/page.tsx             #   vista inversionista
components/                            # Componentes de funcionalidad
│   AuthGate · monitoring-dashboard · dashboard-view · property-database-view ·
│   property-valuation · property-inventory · city-status-table · general-status ·
│   alerts-panel · upcoming-executions · payment-plan-dashboard · investor-pdf-form ·
│   simple-google-map · toperty-logo · theme-provider
└── ui/                               # Primitivas shadcn/Radix (button, card, dialog, table, tabs, …)
lib/
├── api.ts                            # Cliente tipado ÚNICO hacia el backend
├── api-interceptor.ts                # Parche de window.fetch: Bearer de sesión + eventos 401/403
├── auth.ts                           # Google OAuth + sesión del backend (AuthService, singleton)
├── excel-export.ts                   # Export CSV/Excel de propiedades
├── geocoding.ts                      # GeocodingService
├── investor-pdf-generator.ts         # PDF de inversionista (jsPDF + html2canvas)
├── inter-font.ts                     # Carga la fuente Inter en los PDFs
└── utils.ts                          # cn() (clsx + tailwind-merge)
contexts/geocoding-context.tsx        # Contexto de geocodificación
hooks/                                # use-toast · use-confirm · use-alert · use-geocoding
```

### Identidad visual (Design System)
La UI sigue la marca corporativa de Toperty (design system de Framer). Los tokens viven en `app/globals.css`:
- **Colores**: navy `#001845` (principal) y cyan `#6EFAFB` (accent); mapeados a los tokens shadcn (`--primary`, `--accent`, charts, feedback) + utilidades de marca (`bg-brand-navy`, `text-brand-cyan`, `text-success`, etc.).
- **Tipografía**: **Satoshi** (cuerpo/UI, self-hosted en `public/fonts/`), **Switzer** (display, vía Fontshare) e **Inter** (nav). Presets `t-h1…t-caption`.
- **Logo**: `components/toperty-logo.tsx` con variantes `navy` (fondos claros) y `white` (fondos navy). Assets en `public/logo-toperty-{dark,light}.png`; favicon en `app/icon.png`.
- Patrones de marca aplicados: headers navy con logo blanco, botón CTA cyan/navy, tabs activos navy, badges circulares navy + ícono cyan.

### Navegación
El dashboard interno (`MonitoringDashboard`) tiene cuatro pestañas:
1. **Dashboard** (`DashboardView`) — monitoreo de scrapers.
2. **Propiedades** (`PropertyDatabaseView`) — inventario.
3. **Análisis de Mercado** (`SimpleGoogleMap`) — mapa de Google.
4. **Avalúo** (`PropertyValuation`) — calculadora ML.

### Autenticación y sesiones del backend
`AuthGate` exige login con **Google OAuth** para el dashboard interno. Solo se permiten correos de los dominios `@toperty.co` y `@valio.com.co` (más una allowlist puntual). La validación ya **no es solo del cliente**: el frontend envía el credential de Google a `POST /api/auth/session` y el **backend lo verifica contra Google** (firma + audience, `backend/auth.py`), valida el dominio y emite una **sesión propia** (token HMAC-SHA256 firmado con `SESSION_SECRET`, 7 días). `lib/api-interceptor.ts` parchea `window.fetch` una sola vez para adjuntar esa sesión como `Authorization: Bearer` a todas las llamadas al backend (no hay que tocar cada componente).

Reglas del guard (middleware en `main_refactored.py`):
- Toda **mutación** (POST/PUT/PATCH/DELETE) exige sesión válida → **401** si falta o venció. Un 401 emite el evento `api-session-expired` y `AuthGate` fuerza re-login (en vez de fallar en silencio).
- Las **cuentas de solo lectura** (allowlist `READ_ONLY_EMAILS` en `backend/auth.py`) entran y **ven todo** — no se ocultan vistas ni botones — pero las mutaciones devuelven **403 con el header `X-Readonly-Block: 1`** (distingue este 403 de cualquier otro) y la UI muestra un toast "Modo solo lectura". El header muestra el badge "Solo lectura" (flag `readonly` devuelto en el login).
- Los POST de **solo cómputo** (p. ej. `/api/valuation`, que solo corre los modelos ML sin escribir) sí se permiten a las cuentas de solo lectura.
- Exentos del guard: `/api/auth/*` (login) y `/api/dashboard/{token}/sync` (sync del share-link público). Las lecturas (GET) quedan abiertas como antes.
- Sin `SESSION_SECRET` el backend **no arranca** (fail-fast en el startup), para no desplegar un login roto.

Los dashboards públicos de planes de pago (`/dashboard/payment-plan/[token]`) **no** pasan por `AuthGate`; su seguridad es el token de acceso.

### Notas del cliente API (`lib/api.ts`)
- Todas las llamadas usan `cache: 'no-store'`.
- **Los helpers atrapan errores y devuelven datos vacíos o de prueba** (`getMockData`) ante un fallo. Si el dashboard muestra cifras sospechosas o de relleno, probablemente la llamada al backend falló en silencio. Agrega nuevas llamadas al backend aquí.

---

## ⚙️ Variables de entorno

El backend lee la configuración de Postgres y las integraciones desde el entorno; el frontend usa variables `NEXT_PUBLIC_*`. Plantillas disponibles: `.env.oauth.example` y `.env.production.example`.

### Backend
```bash
# PostgreSQL
ADMIN_USER=        # usuario de BD
PASSWORD=          # password de BD
HOST=              # host de BD
DB_NAME=           # nombre de la BD
DB_PORT=5432

# Google / integraciones
GOOGLE_API_KEY=                       # Google Maps (geocoding/distancias)
GOOGLE_CLOUD_PROJECT=                 # proyecto GCP
GOOGLE_APPLICATION_CREDENTIALS=       # ruta al JSON de cuenta de servicio (GCS)
GCS_BUCKET_NAME=appraisals-images     # (opcional) bucket de imágenes
GOOGLE_APPS_SCRIPT_URL=               # Apps Script: crear/escribir el Sheet
GOOGLE_APPS_SCRIPT_READER_URL=        # Apps Script: leer datos calculados
APPSCRIPT_PRESENTATION_URL=           # Apps Script: presentación de Slides
APPSCRIPT_APPROVAL_LETTER_URL=        # Apps Script: carta de aprobación
PRIVATE_KEY=                          # clave privada de cuenta de servicio (Sheets API)
CLIENT_EMAIL=                         # email de cuenta de servicio (Sheets API)

# Autenticación (sesiones + solo lectura)
SESSION_SECRET=                       # firma HMAC de las sesiones (OBLIGATORIO: el backend no arranca sin él; alias JWT_SECRET)
GOOGLE_CLIENT_ID=                     # client id de Google OAuth para verificar el credential del login (alias NEXT_PUBLIC_GOOGLE_CLIENT_ID)

# SMTP (envío de Excel/emails)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
FROM_EMAIL=

# Operación
DEBUG=false        # 'true' activa echo de SQL
LOG_LEVEL=INFO
```

### Frontend
```bash
NEXT_PUBLIC_API_URL=                  # URL del backend
NEXT_PUBLIC_GOOGLE_CLIENT_ID=         # OAuth de Google (login)
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_GOOGLE_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAP_ID=
NEXT_PUBLIC_MAPBOX_TOKEN=

# IDs de plantillas de presentación por programa
NEXT_PUBLIC_TEMPLATE_PROGRAMA_GENERAL=
NEXT_PUBLIC_TEMPLATE_PROGRAMA_SOLE=
NEXT_PUBLIC_TEMPLATE_PROGRAMA_B75=
NEXT_PUBLIC_TEMPLATE_PROGRAMA_D89=
NEXT_PUBLIC_TEMPLATE_PROGRAMA_C84=
NEXT_PUBLIC_TEMPLATE_PROGRAMA_A68=
NEXT_PUBLIC_TEMPLATE_PROGRAMA_ALUNA=
```

> 🔐 Los archivos de credenciales (`backend/gcs-credentials.json`, `backend/service-account.json`, `backend/service-account-gcs.json`) son secretos y están en `.gitignore` — nunca se versionan. Los `.env*` también están ignorados.

---

## 🌐 Despliegue

- **Frontend → Vercel.** Build con `pnpm build` (`Dockerfile.frontend` disponible como alternativa). Recuerda que el build ignora errores de TS/ESLint.
- **Backend → Google Cloud Run** con `backend/Dockerfile.production`: imagen `python:3.11-slim`, expone el puerto `8080`, instala librerías de sistema para procesamiento de imágenes (Pillow) y mapas, copia `public/` para los headers/footers de los PDFs, y arranca con `uvicorn main_refactored:app --host 0.0.0.0 --port $PORT`. Para desarrollo se usa `backend/Dockerfile.dev` (puerto `8000`, healthcheck contra `/api/health`).
- **`docker-compose.yml`** levanta ambos servicios con hot-reload para desarrollo local.

---

## 📦 Stack y dependencias principales

**Backend:** FastAPI · SQLModel · psycopg2 · pandas/numpy · LightGBM · geopandas/shapely · reportlab · Pillow · google-cloud-storage · openpyxl · aiohttp/httpx/requests · pytz (ver `backend/requirements.txt`).

**Frontend:** Next.js 14 · React 19 · Tailwind v4 · Radix UI · Recharts · react-hook-form + zod · date-fns · jsPDF · html2canvas · lucide-react · sonner (ver `package.json`).
