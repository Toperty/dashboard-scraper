#!/usr/bin/env python3
"""
Pipeline de entrenamiento de los modelos de avalúo (precio por m²).

- RENTA  -> LightGBM  -> model_rent_lightgbm.txt
- VENTA  -> LightGBM  -> model_sell_lightgbm.txt

Reproduce fielmente la metodología del notebook original
(real_estate_price_per_m2_pipeline), pero:
  * escribe los archivos con el nombre exacto que carga el backend
    (routers/valuations.py), en esta misma carpeta,
  * escribe metadata.json con rutas relativas (forward-slash),
  * toma las credenciales de la BD desde variables de entorno
    (nunca hardcodeadas).

Uso:
    export TRAIN_DB_URI="postgresql+psycopg2://user:pass@host:5432/db"
    # (o bien PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD)
    python train.py

El objetivo es log1p(price_per_m2); el backend aplica expm1 en inferencia.
"""

import os
import re
import json
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import quote_plus

import numpy as np
import pandas as pd
from sqlalchemy import create_engine
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import lightgbm as lgb

# --------------------------------------------------------------------------- #
# Configuración
# --------------------------------------------------------------------------- #
TABLE_NAME = os.environ.get("TRAIN_TABLE", "property")
OUT_DIR = Path(os.environ.get("OUT_DIR", Path(__file__).resolve().parent))

FEATURES = [
    "area", "rooms", "baths", "garages", "stratum", "latitude", "longitude",
    "antiquity", "is_new", "area_per_room",
    "age_bucket", "has_garage", "city_id", "property_type",
]
CAT_FEATURES = ["is_new", "age_bucket", "city_id"]


def get_engine():
    uri = os.environ.get("TRAIN_DB_URI")
    if not uri:
        host = os.environ["PGHOST"]
        port = os.environ.get("PGPORT", "5432")
        db = os.environ["PGDATABASE"]
        user = os.environ["PGUSER"]
        pwd = quote_plus(os.environ["PGPASSWORD"])
        uri = f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{db}"
    return create_engine(uri)


# --------------------------------------------------------------------------- #
# Métricas
# --------------------------------------------------------------------------- #
def rmse(y_true, y_pred):
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


def mape(y_true, y_pred):
    denom = np.where(y_true == 0, 1e-8, y_true)
    return float(np.mean(np.abs((y_true - y_pred) / denom)) * 100)


# --------------------------------------------------------------------------- #
# Limpieza / feature engineering (fiel al notebook)
# --------------------------------------------------------------------------- #
def remove_outliers_iqr(df_in, column):
    q1 = df_in[column].quantile(0.25)
    q3 = df_in[column].quantile(0.75)
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    return df_in[(df_in[column] >= lo) & (df_in[column] <= hi)]


def extract_stratum(val):
    if pd.isna(val):
        return np.nan
    if isinstance(val, (int, float)):
        return val
    m = re.search(r"\d+", str(val))
    return int(m.group()) if m else np.nan


def convert_antiquity(val):
    if pd.isna(val) or val is None or val == "":
        return 0
    if isinstance(val, (int, float)):
        return int(val) if val in [0, 1, 2, 3, 4, 5] else 0
    v = str(val).upper().strip()
    if v in ["LESS_THAN_1_YEAR", "MENOS DE 1 AÑO", "1", "NEW", "NUEVO"]:
        return 1
    if v in ["FROM_1_TO_8_YEARS", "1 A 8 AÑOS", "2"]:
        return 2
    if v in ["FROM_9_TO_15_YEARS", "9 A 15 AÑOS", "3"]:
        return 3
    if v in ["FROM_16_TO_30_YEARS", "16 A 30 AÑOS", "4"]:
        return 4
    if v in ["MORE_THAN_30_YEARS", "MÁS DE 30 AÑOS", "MAS DE 30 AÑOS", "5"]:
        return 5
    return 0


def extract_property_type(title):
    if pd.isna(title):
        return 0
    t = str(title).lower()
    if "apartamento" in t or "apto" in t:
        return 1
    if "casa" in t:
        return 2
    if "oficina" in t:
        return 3
    if "local" in t:
        return 4
    if "bodega" in t:
        return 5
    if "lote" in t or "terreno" in t:
        return 6
    if "estudio" in t:
        return 7
    if "penthouse" in t or "pent house" in t:
        return 8
    if "duplex" in t or "dúplex" in t:
        return 9
    return 0


def apply_recommended_filters(df_in):
    df = df_in.copy()
    df["rooms"] = pd.to_numeric(df["rooms"], errors="coerce")
    df["baths"] = pd.to_numeric(df["baths"], errors="coerce")
    df["stratum"] = df["stratum"].apply(extract_stratum)
    df["garages"] = pd.to_numeric(df["garages"], errors="coerce")
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    df["antiquity"] = df["antiquity"].apply(convert_antiquity)

    # 1. Área (rent 15-500, sell 15-1000)
    df = df[(df["area"] >= 15) & (
        ((df["offer"] == "rent") & (df["area"] <= 500)) |
        ((df["offer"] == "sell") & (df["area"] <= 1000))
    )]
    # 2. Habitaciones
    df = df[(df["rooms"].isna()) | ((df["rooms"] >= 0) & (df["rooms"] <= 10))]
    df["rooms"] = df["rooms"].fillna(df["rooms"].median() if pd.notna(df["rooms"].median()) else 3)
    # 3. Baños
    df = df[(df["baths"].isna()) | ((df["baths"] >= 0) & (df["baths"] <= 8))]
    df["baths"] = df["baths"].fillna(df["baths"].median() if pd.notna(df["baths"].median()) else 2)
    # 4. Estrato
    df["stratum"] = df["stratum"].fillna(0)
    df = df[(df["stratum"] >= 0) & (df["stratum"] <= 6)]
    # 5. Coordenadas Colombia
    df = df[(df["latitude"].isna()) | (
        (df["latitude"] >= -5) & (df["latitude"] <= 15) &
        (df["longitude"] >= -82) & (df["longitude"] <= -66)
    )]
    df["latitude"] = df["latitude"].fillna(4.65)
    df["longitude"] = df["longitude"].fillna(-74.1)
    # 6. Garajes
    df["garages"] = df["garages"].fillna(0)
    df = df[(df["garages"] >= 0) & (df["garages"] <= 10)]
    # 7. Antigüedad
    df = df[(df["antiquity"] >= 0) & (df["antiquity"] <= 5)]
    # 8. Área/habitación
    df["area_per_room"] = np.where(df["rooms"] > 0, df["area"] / df["rooms"], df["area"])
    df = df[(df["area_per_room"] >= 5) & (df["area_per_room"] <= 150)]
    return df


AGE_MAP = {
    0: "sin_especificar", 1: "menos_1_ano", 2: "1_a_8_anos",
    3: "9_a_15_anos", 4: "16_a_30_anos", 5: "mas_30_anos",
}


def add_features(df_in):
    df = df_in.copy()
    df["offer"] = df["offer"].astype(str).str.lower().str.strip()
    df["is_new"] = df["is_new"].astype(str).str.lower()
    df["property_type"] = (
        df["title"].apply(extract_property_type) if "title" in df.columns else 0
    )
    rooms_safe = df["rooms"].replace({-1: np.nan, 0: np.nan})
    df["area_per_room"] = df["area"] / rooms_safe
    df["area_per_room"] = np.where(
        df["area_per_room"].isna() | np.isinf(df["area_per_room"]),
        df["area"], df["area_per_room"],
    )
    df["age_bucket"] = df["antiquity"].map(AGE_MAP).fillna("sin_especificar")
    df["has_garage"] = (df["garages"] > 0).astype(int)
    df["price_per_m2_log"] = np.log1p(df["price_per_m2"])
    return df


def prepare_Xy(df_local):
    X = df_local[FEATURES].copy()
    for c in X.columns:
        if c in CAT_FEATURES:
            if pd.api.types.is_numeric_dtype(X[c]):
                X[c] = X[c].fillna(-1).astype(str)
            else:
                X[c] = X[c].astype(object).fillna("missing").astype(str)
            X[c] = X[c].astype("category")
        else:
            X[c] = pd.to_numeric(X[c], errors="coerce").fillna(-1)
            X[c] = X[c].replace([np.inf, -np.inf], -1)
    y = df_local["price_per_m2_log"].values
    return X, y


# --------------------------------------------------------------------------- #
# Entrenamiento — LightGBM afinado para AMBAS ofertas.
#
# Elegido tras comparar LightGBM vs CatBoost (split train/val/test): LightGBM
# afinado gana en renta (R²≈0.65 vs 0.62) y en venta (R²≈0.62 vs 0.60), y unifica
# el serving en un solo formato. Params: más capacidad (num_leaves=96) + más
# rondas con early stopping + regularización (L1/L2, subsampling).
# --------------------------------------------------------------------------- #
LGB_PARAMS = {
    "objective": "regression", "metric": "rmse",
    "learning_rate": 0.03, "num_leaves": 63, "min_child_samples": 50,
    "feature_fraction": 0.8, "bagging_fraction": 0.8, "bagging_freq": 1,
    "lambda_l1": 1.0, "lambda_l2": 2.0,
    "num_threads": int(os.environ.get("NTHREADS", "8")),
    "verbose": -1, "seed": 42, "bagging_seed": 42, "feature_fraction_seed": 42,
}


def train_lgb(df_offer):
    X, y = prepare_Xy(df_offer)
    Xtr, Xva, ytr, yva = train_test_split(X, y, test_size=0.2, random_state=42)
    cat = [f for f in CAT_FEATURES if f in Xtr.columns]
    dtr = lgb.Dataset(Xtr, label=ytr, categorical_feature=cat)
    dva = lgb.Dataset(Xva, label=yva, reference=dtr, categorical_feature=cat)
    model = lgb.train(
        LGB_PARAMS, dtr, valid_sets=[dva], num_boost_round=5000,
        callbacks=[lgb.early_stopping(stopping_rounds=200, verbose=False),
                   lgb.log_evaluation(1000)],
    )
    yp = model.predict(Xva)
    metrics = {"rmse": rmse(yva, yp), "mape": mape(np.expm1(yva), np.expm1(yp)),
               "r2": float(r2_score(yva, yp)), "n": int(len(X)),
               "best_iteration": int(model.best_iteration or model.num_trees())}
    return model, metrics, list(X.columns)


def main():
    print(f"→ Cargando tabla '{TABLE_NAME}' desde la BD…")
    engine = get_engine()
    df_raw = pd.read_sql_table(TABLE_NAME, engine)
    print(f"  {df_raw.shape[0]:,} filas, {df_raw.shape[1]} columnas")

    # Base + price_per_m2
    df = df_raw.copy()
    df.columns = [c.strip() for c in df.columns]
    df = df[(df["area"].notnull()) & (df["area"] > 0) & (df["price"].notnull())]
    df["price_per_m2"] = df["price"] / df["area"]
    print(f"  tras filtro básico área/precio: {len(df):,}")

    # Outliers IQR (price, area, price_per_m2)
    df = remove_outliers_iqr(df, "price")
    df = remove_outliers_iqr(df, "area")
    df["price_per_m2"] = df["price"] / df["area"]
    df = remove_outliers_iqr(df, "price_per_m2")
    print(f"  tras outliers IQR: {len(df):,}")

    # Filtros recomendados + feature engineering
    df = apply_recommended_filters(df)
    df["price_per_m2_log"] = np.log1p(df["price_per_m2"])
    df = add_features(df)
    print(f"  tras filtros recomendados + features: {len(df):,}")
    print(f"  distribución offer: {df['offer'].value_counts().to_dict()}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    metadata = {}

    for offer, out_name in [("rent", "model_rent_lightgbm.txt"),
                            ("sell", "model_sell_lightgbm.txt")]:
        df_offer = df[df["offer"] == offer].copy()
        print(f"\n=== {offer.upper()} (LightGBM) — n={len(df_offer):,} ===")
        model, metrics, feat = train_lgb(df_offer)
        path = OUT_DIR / out_name
        model.save_model(str(path))
        print(f"  RMSE={metrics['rmse']:.4f}  R²={metrics['r2']:.4f}  "
              f"MAPE={metrics['mape']:.2f}%  best_iter={metrics['best_iteration']}  → {path.name}")
        metadata[offer] = {"lightgbm": {
            "model_path": out_name, "features": feat,
            "cat_features": CAT_FEATURES, "target": "log1p(price_per_m2)",
            "metrics": metrics,
            "trained_at": datetime.now(timezone.utc).isoformat(),
        }}

    with open(OUT_DIR / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"\n✅ Modelos + metadata.json escritos en {OUT_DIR}")


if __name__ == "__main__":
    main()
