# Modelos de Machine Learning para Avalúos

Este directorio contiene los modelos entrenados para realizar avalúos de propiedades.

## Modelos Requeridos

Coloque los siguientes archivos en esta carpeta:

1. `model_rent_lightgbm.txt` - Modelo LightGBM para predecir precios de renta
2. `model_sell_catboost.cbm` - Modelo CatBoost para predecir precios de venta

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