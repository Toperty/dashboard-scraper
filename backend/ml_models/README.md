# Modelos de Machine Learning para Avalúos

Este directorio contiene los modelos entrenados para realizar avalúos de propiedades.

## Modelos

Ambos modelos son **LightGBM** y predicen `log1p(precio/m²)` (el backend aplica
`expm1` en inferencia). Archivos en esta carpeta:

1. `model_rent_lightgbm.txt` - precios de **renta** (R²≈0.64)
2. `model_sell_lightgbm.txt` - precios de **venta** (R²≈0.64)
3. `metadata.json` - orden de features, categóricas y métricas por modelo
4. `city_centroids.json` - lat/lon mediano por `city_id`; el serving deriva la
   ciudad desde las coordenadas del avalúo (el formulario no elige ciudad)

> Nota: antes venta usaba CatBoost (`model_sell_catboost.cbm`); se migró a
> LightGBM porque mejora las métricas y unifica el serving en un solo formato.

## Reentrenamiento

El pipeline reproducible está en `train.py` (reemplaza al notebook, que era
solo exploratorio). Toma las credenciales de la BD por variables de entorno —
**nunca** las hardcodee:

```bash
export TRAIN_DB_URI="postgresql+psycopg2://USER:PASS@HOST:5432/toperty_appraisals"
python train.py     # escribe model_*.txt + metadata.json en esta carpeta
```

Requiere `lightgbm`, `pandas`, `numpy`, `scikit-learn`, `sqlalchemy`,
`psycopg2`. Genera exactamente los nombres de archivo que carga el backend
(`routers/valuations.py`).

## Estructura de Datos de Entrada

Los modelos esperan las siguientes características:

```python
{
    "area": float,              # Área en m²
    "rooms": int,               # Número de habitaciones
    "baths": int,               # Número de baños
    "garages": int,             # Número de garajes
    "stratum": int,             # Estrato socioeconómico (1-6)
    "latitude": float,          # Latitud
    "longitude": float,         # Longitud
    "antiquity": int,           # Antigüedad en años
    "is_new": str,              # "yes" o "no"
    "location_main": str,       # Ubicación principal
    "area_per_room": float,     # Área por habitación (calculado automáticamente)
    "age_bucket": str,          # Rango de edad (calculado automáticamente)
    "has_garage": int,          # 1 si tiene garage, 0 si no (calculado automáticamente)
    "city_id": str,             # ID de la ciudad
    "property_type": int        # Tipo de propiedad (ver códigos abajo)
}
```

## Códigos de Tipos de Propiedad

- 0: Otro
- 1: Apartamento
- 2: Casa
- 3: Oficina
- 4: Local
- 5: Bodega
- 6: Lote
- 7: Estudio
- 8: Penthouse
- 9: Duplex