import os
import uuid
import json
import shutil
import hashlib
from datetime import datetime, timezone
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, status
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text

from backend.app.database.session import get_db, engine, Base
from backend.app.models.entities import Dataset, DatasetColumn, AnalysisRun, ModelResult, AiInsight
from backend.app.schemas.schemas import (
    DatasetSummary, DatasetProfileResponse, DatasetConfigPayload,
    ReadinessAssessmentResponse, FullAnalysisRunResponse, AiInsightResponse
)
from backend.app.core.config import settings
from backend.app.data_engine.profiler import load_clean_dataframe, profile_dataset
from backend.app.data_engine.synthetic_generator import generate_gujarat_solar_campus, generate_himalayan_thermal_campus
from backend.app.ml_engine.readiness import assess_model_readiness, get_data_improvement_advisor
from backend.app.ml_engine.executor import (
    run_linear_regression, run_decision_tree, run_kmeans_clustering, run_pca_decomposition
)
from backend.app.ai_engine.interpreter import interpret_analysis_with_gemini
from backend.app.ai_engine.evidence import build_direct_observations

# Create database tables if they do not exist
Base.metadata.create_all(bind=engine, checkfirst=True)
if "selected_type" not in {column["name"] for column in inspect(engine).get_columns("dataset_columns")} :
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE dataset_columns ADD COLUMN selected_type VARCHAR(50)"))

router = APIRouter()

DUMMY_ENERGY_TARGET = "total_electricity_consumption_kwh"
DUMMY_ENERGY_PREDICTORS = [
    "occupied_residents", "average_temperature_c", "fan_operating_hours_per_day",
    "lighting_operating_hours_per_day", "study_plug_hours_per_resident", "weekend",
    "monsoon_season_flag", "maintenance_activity_flag", "hostel_block",
]
DUMMY_ENERGY_EXCLUDED_PREDICTORS = {
    DUMMY_ENERGY_TARGET, "grid_import_kwh", "grid_export_kwh", "solar_generation_kwh",
    "solar_self_consumption_kwh",
}


def _uses_dummy_energy_feature_policy(df: pd.DataFrame) -> bool:
    return DUMMY_ENERGY_TARGET in df.columns and set(DUMMY_ENERGY_PREDICTORS).issubset(df.columns)

def _validate_supervised_predictors(
    df: pd.DataFrame,
    target: str,
    algorithm: str,
    configured_features: List[str],
    feature_column: Optional[str] = None,
    feature_columns: Optional[str] = None,
) -> List[str]:
    if feature_columns is not None and feature_column:
        raise HTTPException(status_code=422, detail="Specify either feature_column or feature_columns, not both.")
    requested = ([item.strip() for item in feature_columns.split(",") if item.strip()]
                 if feature_columns is not None else [feature_column] if feature_column else list(configured_features))
    if len(requested) != len(set(requested)):
        raise HTTPException(status_code=422, detail="Predictor list contains duplicate columns.")
    if target in requested:
        raise HTTPException(status_code=422, detail=f"Target '{target}' cannot also be used as a predictor.")
    unknown = [name for name in requested if name not in df.columns]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Predictor columns do not exist in the dataset: {', '.join(unknown)}.")

    if _uses_dummy_energy_feature_policy(df):
        if target != DUMMY_ENERGY_TARGET:
            raise HTTPException(status_code=422, detail=f"This dataset's supervised target must be '{DUMMY_ENERGY_TARGET}'.")
        prohibited = sorted(set(requested) & DUMMY_ENERGY_EXCLUDED_PREDICTORS)
        if prohibited:
            raise HTTPException(status_code=422, detail=f"Excluded energy-accounting fields cannot be predictors: {', '.join(prohibited)}.")
        if set(requested) != set(DUMMY_ENERGY_PREDICTORS):
            missing = [name for name in DUMMY_ENERGY_PREDICTORS if name not in requested]
            unexpected = [name for name in requested if name not in DUMMY_ENERGY_PREDICTORS]
            details = []
            if missing: details.append(f"missing required predictors: {', '.join(missing)}")
            if unexpected: details.append(f"unexpected predictors: {', '.join(unexpected)}")
            raise HTTPException(status_code=422, detail=f"{algorithm} must use the exact approved predictor set ({'; '.join(details)}).")
        return list(DUMMY_ENERGY_PREDICTORS)
    return requested

def _file_version(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def _leakage_warnings(df: pd.DataFrame, target: Optional[str], predictors: List[str]) -> List[Dict[str, str]]:
    warnings: List[Dict[str, str]] = []
    if target and target in predictors:
        warnings.append({"level": "CONFIRMED", "code": "target_in_predictors", "message": f"Target '{target}' was requested as a predictor; execution must exclude it."})
    unique_predictors = list(dict.fromkeys(c for c in predictors if c in df.columns and c != target))
    seen: List[str] = []
    for col in unique_predictors:
        duplicate = next((prior for prior in seen if df[col].equals(df[prior])), None)
        if duplicate:
            warnings.append({"level": "POTENTIAL", "code": "duplicate_predictor", "message": f"'{col}' duplicates the values in '{duplicate}'; review whether both are needed."})
        else:
            seen.append(col)
    if target:
        name = target.lower()
        pred_names = {c.lower() for c in unique_predictors}
        if "grid_import" in name and any("consumption" in c or "load" in c for c in pred_names) and any("solar_generation" in c or "pv_generation" in c for c in pred_names):
            warnings.append({"level": "POTENTIAL", "code": "derived_grid_import", "message": "Grid import may be mechanically derived from consumption and solar generation; verify the meter formula and prediction-time availability."})
        if ("self_consumption" in name or "solar_consumption" in name) and any("consumption" in c for c in pred_names) and any("solar_generation" in c or "pv_generation" in c for c in pred_names):
            warnings.append({"level": "POTENTIAL", "code": "derived_solar_self_consumption", "message": "Solar self-consumption may be derived from consumption and solar generation; verify the calculation and time alignment."})
        if "total" in name and "consumption" in name and any("grid_import" in c for c in pred_names) and any("self_consumption" in c or "solar_generation" in c for c in pred_names):
            grid_col = next((c for c in unique_predictors if "grid_import" in c.lower()), None)
            solar_col = next((c for c in unique_predictors if "self_consumption" in c.lower() or "solar_generation" in c.lower()), None)
            target_values = pd.to_numeric(df[target], errors="coerce")
            grid_values = pd.to_numeric(df[grid_col], errors="coerce") if grid_col else pd.Series(dtype=float)
            solar_values = pd.to_numeric(df[solar_col], errors="coerce") if solar_col else pd.Series(dtype=float)
            paired = pd.concat([target_values, grid_values, solar_values], axis=1).dropna()
            residual = (paired.iloc[:, 0] - paired.iloc[:, 1] - paired.iloc[:, 2]).abs() if len(paired) else pd.Series(dtype=float)
            identity_holds = len(residual) >= 10 and float(residual.max()) <= 0.100001
            warnings.append({"level": "CONFIRMED" if identity_holds else "POTENTIAL", "code": "derived_total_consumption" if identity_holds else "possible_derived_total_consumption", "message": (f"The selected target equals grid import plus '{solar_col}' within 0.1 units for {len(residual)} paired rows. These predictors encode the target and the supervised result is invalid for independent prediction." if identity_holds else "The target may be constructed from grid import and solar-side measurements; verify the dataset's accounting equation before interpreting supervised results.")})
        numeric_target = pd.to_numeric(df[target], errors="coerce") if target in df else pd.Series(dtype=float)
        for col in unique_predictors:
            lname = col.lower()
            if any(token in lname for token in ("actual_after", "post_outcome", "final_settlement", "end_of_day_total")):
                warnings.append({"level": "POTENTIAL", "code": "post_outcome_predictor", "message": f"'{col}' may only be available after the target period; confirm it exists at prediction time."})
            candidate = pd.to_numeric(df[col], errors="coerce")
            paired = pd.concat([numeric_target, candidate], axis=1).dropna()
            if len(paired) >= 10 and paired.iloc[:, 0].nunique() > 1 and paired.iloc[:, 1].nunique() > 1:
                corr = paired.iloc[:, 0].corr(paired.iloc[:, 1])
                if pd.notna(corr) and abs(float(corr)) >= 0.9999:
                    warnings.append({"level": "POTENTIAL", "code": "near_perfect_target_association", "message": f"'{col}' is nearly perfectly associated with the target (r={float(corr):.5f}); inspect for a derived or post-outcome measurement. Correlation alone does not prove leakage."})
    warnings.append({"level": "REVIEW", "code": "prediction_time_availability", "message": "Confirm each predictor is available at the intended prediction time; the file alone cannot establish when a measurement becomes available."})
    return warnings

def _model_provenance(dataset: Dataset, dataset_version: str, run_id: Any, algorithm: str,
                      target: Optional[str], requested: List[str], actual: List[str], excluded: List[str],
                      preprocessing: Dict[str, Any], split: Optional[Dict[str, Any]],
                      parameters: Dict[str, Any], warnings: List[Dict[str, str]]) -> Dict[str, Any]:
    blocking = any(item["level"] == "CONFIRMED" for item in warnings)
    review = any(item["level"] == "POTENTIAL" for item in warnings)
    return {"dataset_id": dataset.id, "dataset_version": dataset_version, "run_id": run_id,
            "algorithm": algorithm, "target_variable": target, "predictor_variables": requested,
            "model_input_variables": actual, "excluded_variables": excluded,
            "preprocessing": preprocessing, "train_test_split": split, "random_seed": 42,
            "model_parameters": parameters, "execution_timestamp": datetime.now(timezone.utc).isoformat(),
            "warnings": warnings, "validation_status": "invalid" if blocking else "review_required" if review else "validated",
            "report_ready": not blocking and not review}

@router.get("/health", tags=["System"])
def health_check():
    return {
        "status": "online",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "gemini_configured": bool(settings.GEMINI_API_KEY)
    }

# --- DATASET MANAGEMENT ---

@router.post("/datasets/upload", response_model=DatasetProfileResponse, tags=["Datasets"])
async def upload_dataset(
    file: UploadFile = File(...),
    description: Optional[str] = Form(""),
    db: Session = Depends(get_db)
):
    # Validate extension
    if not file.filename.lower().endswith(('.csv', '.txt')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a CSV (.csv) dataset."
        )

    # Secure server-side filename generation
    safe_token = str(uuid.uuid4())[:8]
    clean_original = Path(file.filename).name.replace(" ", "_")
    safe_filename = f"{safe_token}_{clean_original}"
    dest_path = settings.UPLOADS_DIR / safe_filename

    # Save file securely
    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    file_size = dest_path.stat().st_size
    if file_size > 50 * 1024 * 1024:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="File exceeds maximum 50MB size limit.")

    # Parse and profile using Adaptive Data Engine
    try:
        df, delimiter = load_clean_dataframe(dest_path)
    except Exception as e:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Could not parse CSV file: {str(e)}")

    # Create Dataset record in SQLite
    dataset_rec = Dataset(
        filename=safe_filename,
        original_name=file.filename,
        file_size_bytes=file_size,
        row_count=int(df.shape[0]),
        col_count=int(df.shape[1]),
        delimiter=delimiter,
        description=description or "",
        is_sample=False
    )
    db.add(dataset_rec)
    db.commit()
    db.refresh(dataset_rec)

    # Profile dataset
    profile_data = profile_dataset(df, dataset_rec.id, dataset_rec.original_name, delimiter)

    # Save Column records
    for col_info in profile_data["columns"]:
        col_rec = DatasetColumn(
            dataset_id=dataset_rec.id,
            name=col_info["name"],
            original_dtype=col_info["original_dtype"],
            inferred_type=col_info["inferred_type"],
            custom_meaning=col_info["custom_meaning"],
            unit=col_info["unit"],
            is_target=col_info["name"] in profile_data["potential_targets"][:1],
            is_feature=col_info["is_feature"],
            is_excluded=col_info["is_excluded"],
            exclusion_reason=col_info["exclusion_reason"],
            missing_count=col_info["missing_count"],
            unique_count=col_info["unique_count"]
        )
        db.add(col_rec)
    db.commit()

    return profile_data

@router.get("/datasets", response_model=List[DatasetSummary], tags=["Datasets"])
def list_datasets(db: Session = Depends(get_db)):
    datasets = db.query(Dataset).order_by(Dataset.uploaded_at.desc()).all()
    return datasets

@router.get("/datasets/{dataset_id}", response_model=DatasetSummary, tags=["Datasets"])
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset

@router.get("/datasets/{dataset_id}/profile", response_model=DatasetProfileResponse, tags=["Datasets"])
def get_dataset_profile(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = settings.UPLOADS_DIR / dataset.filename
    if not file_path.exists():
        # Check in datasets dir
        file_path = settings.DATASETS_DIR / dataset.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dataset file missing on disk")

    df, delimiter = load_clean_dataframe(file_path)
    profile = profile_dataset(df, dataset.id, dataset.original_name, delimiter)
    
    # Enrich with existing database column configs
    db_cols = {c.name: c for c in dataset.columns}
    for col in profile["columns"]:
        if col["name"] in db_cols:
            db_c = db_cols[col["name"]]
            col["custom_meaning"] = db_c.custom_meaning
            col["unit"] = db_c.unit
            col["selected_type"] = db_c.selected_type
            col["effective_type"] = db_c.selected_type or col["inferred_type"]
            if db_c.selected_type is None and db_c.inferred_type != col["inferred_type"]:
                db_c.inferred_type = col["inferred_type"]
                db_c.is_excluded = col["is_excluded"]
                db_c.is_feature = col["is_feature"] and not db_c.is_target
            col["is_target"] = db_c.is_target
            col["is_feature"] = db_c.is_feature
            col["is_excluded"] = db_c.is_excluded
            col["exclusion_reason"] = db_c.exclusion_reason or col["exclusion_reason"]
    db.commit()

    return profile

@router.post("/datasets/{dataset_id}/configure", tags=["Datasets"])
def configure_dataset(
    dataset_id: int,
    payload: DatasetConfigPayload,
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    col_map = {c.name: c for c in dataset.columns}
    allowed_types = {"datetime", "continuous_numerical", "discrete_numerical", "binary", "categorical", "text_identifier", "unknown", "constant"}
    
    for cfg in payload.column_configs:
        if cfg.name in col_map:
            db_col = col_map[cfg.name]
            if cfg.custom_meaning is not None:
                db_col.custom_meaning = cfg.custom_meaning
            if cfg.selected_type is not None:
                if cfg.selected_type and cfg.selected_type not in allowed_types:
                    raise HTTPException(status_code=422, detail=f"Unsupported selected type '{cfg.selected_type}' for column '{cfg.name}'.")
                db_col.selected_type = cfg.selected_type or None
                effective_type = db_col.selected_type or db_col.inferred_type
                db_col.is_excluded = effective_type in {"datetime", "text_identifier", "unknown", "constant"}
                db_col.exclusion_reason = "" if not db_col.is_excluded else f"Excluded by selected type: {effective_type}"
                db_col.is_feature = not db_col.is_excluded and not db_col.is_target
            if cfg.unit is not None:
                db_col.unit = cfg.unit
            if cfg.is_target is not None:
                db_col.is_target = cfg.is_target
            if cfg.is_feature is not None:
                db_col.is_feature = cfg.is_feature
            if cfg.is_excluded is not None:
                db_col.is_excluded = cfg.is_excluded
            if cfg.exclusion_reason is not None:
                db_col.exclusion_reason = cfg.exclusion_reason

    # If payload explicitly designated or cleared the supervised target.
    if "target_column" in payload.model_fields_set:
        if payload.target_column:
            target = col_map.get(payload.target_column)
            target_type = (target.selected_type or target.inferred_type) if target else None
            if not target or target_type in {"datetime", "text_identifier", "unknown", "constant"}:
                raise HTTPException(status_code=422, detail="The selected target must be numeric or categorical; choose a different column or clear the target.")
        for c in dataset.columns:
            c.is_target = bool(payload.target_column) and (c.name == payload.target_column)

    db.commit()
    return {"status": "success", "message": "Dataset column configurations updated successfully."}

@router.post("/datasets/{dataset_id}/readiness", response_model=ReadinessAssessmentResponse, tags=["ML Engine"])
def check_readiness(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = settings.UPLOADS_DIR / dataset.filename
    if not file_path.exists():
        file_path = settings.DATASETS_DIR / dataset.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dataset file missing on disk")

    df, _ = load_clean_dataframe(file_path)

    # Determine target and active features from database
    target_col = None
    feature_cols = []
    excluded_cols = []
    
    for col in dataset.columns:
        effective_type = col.selected_type or col.inferred_type
        if col.is_target:
            target_col = col.name
        elif col.is_excluded or effective_type in {"datetime", "text_identifier", "unknown", "constant"}:
            excluded_cols.append(col.name)
        elif col.is_feature or effective_type in {"continuous_numerical", "discrete_numerical", "binary", "categorical"}:
            feature_cols.append(col.name)

    assessment = assess_model_readiness(
        df=df,
        target_col=target_col,
        feature_cols=feature_cols,
        excluded_cols=excluded_cols
    )
    assessment["dataset_id"] = dataset.id
    return assessment

# --- SAMPLE DATASET LOADER ---

@router.post("/datasets/load-sample/{sample_type}", response_model=DatasetProfileResponse, tags=["Datasets"])
def load_sample_dataset(sample_type: str, db: Session = Depends(get_db)):
    """
    Loads synthetic sample datasets:
    1. 'gujarat' - Western India hot solar campus
    2. 'himalayan' - North India cold thermal battery campus
    3. 'campus_original' - The existing DATA_170225.csv dataset from the workspace!
    """
    if sample_type == "gujarat":
        filename = "synthetic_gujarat_hostel_solar.csv"
        dest_path = settings.DATASETS_DIR / filename
        generate_gujarat_solar_campus(dest_path, n_days=180)
        orig_name = "Gujarat University Hostel (Solar + Cooling Load).csv"
        desc = "Synthetic dataset of 180 days across 3 hostel blocks in Western India featuring ambient temperatures, solar generation, and AC hours."
    elif sample_type == "himalayan":
        filename = "synthetic_himalayan_hostel_thermal.csv"
        dest_path = settings.DATASETS_DIR / filename
        generate_himalayan_thermal_campus(dest_path, n_days=150)
        orig_name = "Himalayan Institute Hostel (Thermal Heating & Battery Storage).csv"
        desc = "Synthetic dataset of 150 days across 2 wings in cold mountain climate featuring heating degree days, geyser loads, and battery storage."
    elif sample_type == "campus_original":
        source_file = Path("d:/PDEU/Sem 3 PDEU/Intro To AI/I2AI IA2/DATA_170225.csv")
        if not source_file.exists():
            raise HTTPException(status_code=404, detail="DATA_170225.csv not found in root workspace.")
        filename = "campus_hostel_data_170225.csv"
        dest_path = settings.DATASETS_DIR / filename
        shutil.copy(source_file, dest_path)
        orig_name = "Campus Building Metered Energy (DATA_170225.csv)"
        desc = "Original campus electrical sub-meter dataset with daily building loads, peak/off-peak pricing, and reactive power."
    else:
        raise HTTPException(status_code=400, detail="Invalid sample type. Choose 'gujarat', 'himalayan', or 'campus_original'.")

    # Load and profile
    df, delimiter = load_clean_dataframe(dest_path)
    file_size = dest_path.stat().st_size

    # Check if already in DB
    existing = db.query(Dataset).filter(Dataset.filename == filename).first()
    if existing:
        db.delete(existing)
        db.commit()

    dataset_rec = Dataset(
        filename=filename,
        original_name=orig_name,
        file_size_bytes=file_size,
        row_count=int(df.shape[0]),
        col_count=int(df.shape[1]),
        delimiter=delimiter,
        description=desc,
        is_sample=True
    )
    db.add(dataset_rec)
    db.commit()
    db.refresh(dataset_rec)

    profile_data = profile_dataset(df, dataset_rec.id, dataset_rec.original_name, delimiter)

    # Save Columns
    for col_info in profile_data["columns"]:
        col_rec = DatasetColumn(
            dataset_id=dataset_rec.id,
            name=col_info["name"],
            original_dtype=col_info["original_dtype"],
            inferred_type=col_info["inferred_type"],
            custom_meaning=col_info["custom_meaning"],
            unit=col_info["unit"],
            is_target=col_info["name"] in profile_data["potential_targets"][:1],
            is_feature=col_info["is_feature"],
            is_excluded=col_info["is_excluded"],
            exclusion_reason=col_info["exclusion_reason"],
            missing_count=col_info["missing_count"],
            unique_count=col_info["unique_count"]
        )
        db.add(col_rec)
    db.commit()

    return profile_data

# --- COMPACT SHARED HOSTEL DATASET CATALOG ---

@router.get("/educational/catalog", tags=["Educational Library"])
def get_educational_catalog():
    """A compact set of shared hostel datasets, usable across all four methods."""
    demos = [
        {"id": "sample_gujarat", "file": "synthetic_gujarat_hostel_solar.csv", "name": "Gujarat Hostel Solar Energy",
         "context": "Synthetic daily measurements for three hostel blocks, including occupancy, weather, electricity and solar output.",
         "rows": 540, "cols": 13, "target_column": "total_energy_kwh",
         "learning_objective": "Explore how weather, occupancy and solar measurements relate to hostel electricity use."},
        {"id": "sample_himalayan", "file": "synthetic_himalayan_hostel_thermal.csv", "name": "Himalayan Hostel Heating",
         "context": "Synthetic daily measurements for two hostel wings, including temperature, heating, occupancy and electricity.",
         "rows": 300, "cols": 11, "target_column": "total_building_kwh",
         "learning_objective": "Compare a second hostel energy dataset and see how the same methods behave on different measurements."},
    ]
    return {method: [dict(item, target_column=item["target_column"] if method in {"linear_regression", "decision_tree"} else None)
                     for item in demos] for method in ("linear_regression", "decision_tree", "kmeans", "pca")}

@router.post("/educational/load/{method}/{dataset_id}", response_model=DatasetProfileResponse, tags=["Educational Library"])
def load_educational_dataset(method: str, dataset_id: str, db: Session = Depends(get_db)):
    """Loads one of the shared hostel demonstrations; retained route for the existing card UI."""
    if method not in {"linear_regression", "decision_tree", "kmeans", "pca"}:
        raise HTTPException(status_code=400, detail=f"Unsupported algorithm: {method}")
    if dataset_id == "sample_gujarat":
        return load_sample_dataset("gujarat", db)
    if dataset_id == "sample_himalayan":
        return load_sample_dataset("himalayan", db)

    raise HTTPException(status_code=404, detail=f"Demonstration dataset '{dataset_id}' is not in the curated catalogue.")

# --- SINGLE ALGORITHM DEDICATED EXECUTION ---

@router.post("/ml/train-single/{dataset_id}/{algorithm}", tags=["ML Engine"])
def train_single_algorithm(
    dataset_id: int,
    algorithm: str,
    target_column: Optional[str] = None,
    feature_column: Optional[str] = None,
    feature_columns: Optional[str] = None,
    n_clusters: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Executes a single algorithm (linear_regression, decision_tree, kmeans, pca) on the dataset.
    Returns the real Scikit-learn outputs, evaluation metrics, and Gemini AI companion interpretation.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = settings.UPLOADS_DIR / dataset.filename
    if not file_path.exists():
        file_path = settings.DATASETS_DIR / dataset.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dataset file missing on disk")

    df, delimiter = load_clean_dataframe(file_path)

    # Supervised runs must carry the exact workspace-selected target. Never
    # substitute a dataset default or a different numeric column.
    target_col = target_column
    if algorithm in {"linear_regression", "decision_tree"}:
        if not target_col:
            raise HTTPException(status_code=422, detail=f"{ 'Linear Regression' if algorithm == 'linear_regression' else 'Decision Tree' } requires an explicitly selected target_column. No fallback target is used.")
        if target_col not in df.columns:
            raise HTTPException(status_code=422, detail=f"Requested target '{target_col}' does not exist in this dataset.")
    elif not target_col:
        # Unsupervised methods may still need the configured target excluded from X.
        target_col = next((column.name for column in dataset.columns if column.is_target), None)

    feature_cols = [c.name for c in dataset.columns if c.is_feature and c.name != target_col and not c.is_excluded and (c.selected_type or c.inferred_type) not in {"datetime", "text_identifier", "unknown", "constant"}]
    excluded_cols = [c.name for c in dataset.columns if c.is_excluded]
    if algorithm in {"linear_regression", "decision_tree"}:
        feature_cols = _validate_supervised_predictors(
            df, target_col, algorithm, feature_cols, feature_column, feature_columns)
        if target_col == DUMMY_ENERGY_TARGET:
            excluded_cols = list(dict.fromkeys(excluded_cols + sorted(DUMMY_ENERGY_EXCLUDED_PREDICTORS)))

    result = {}
    try:
        effective_types = {c.name: (c.selected_type or c.inferred_type) for c in dataset.columns}
        numeric_types = {"continuous_numerical", "discrete_numerical", "binary"}
        typed_df = df.copy()
        if algorithm in {"linear_regression", "decision_tree"}:
            target_type = effective_types.get(target_col)
            if algorithm == "linear_regression" and target_type not in numeric_types:
                raise ValueError(f"Requested regression target '{target_col}' is classified as {target_type or 'unknown'}; choose a numeric target.")
            target_values = df[target_col]
            if target_type in numeric_types or algorithm == "linear_regression":
                target_values = pd.to_numeric(target_values, errors="coerce").replace([np.inf, -np.inf], np.nan)
                valid_targets = int(target_values.notna().sum())
                if valid_targets < 10:
                    raise ValueError(f"Requested target '{target_col}' has only {valid_targets} valid numeric observations; at least 10 are required.")
                typed_df[target_col] = target_values
            elif int(target_values.notna().sum()) < 10:
                raise ValueError(f"Requested target '{target_col}' has fewer than 10 valid observations.")
        numeric_feature_cols = [c for c in feature_cols if effective_types.get(c) in numeric_types]
        for col_name in feature_cols:
            if effective_types.get(col_name) in numeric_types and not pd.api.types.is_numeric_dtype(typed_df[col_name]):
                parsed = pd.to_numeric(typed_df[col_name], errors="coerce")
                if parsed.notna().sum() >= max(1, int(typed_df[col_name].notna().sum() * 0.95)):
                    typed_df[col_name] = parsed
            if effective_types.get(col_name) == "binary" and not pd.api.types.is_numeric_dtype(typed_df[col_name]):
                levels = sorted(typed_df[col_name].dropna().astype(str).unique().tolist())
                if len(levels) != 2:
                    raise ValueError(f"Binary feature '{col_name}' has {len(levels)} observed levels; select a binary type only for exactly two levels.")
                typed_df[col_name] = typed_df[col_name].astype(str).map({levels[0]: 0, levels[1]: 1})
        supervised_df = typed_df.copy()
        for col_name in feature_cols:
            if effective_types.get(col_name) == "categorical":
                supervised_df[col_name] = "category:" + supervised_df[col_name].astype("string").fillna("__MISSING__")
        if algorithm == "linear_regression":
            if not target_col:
                raise ValueError("Linear Regression requires a continuous numerical target column.")
            for selected_feature in feature_cols:
                selected_predictor = next((c for c in dataset.columns if c.name == selected_feature), None)
                predictor_type = (selected_predictor.selected_type or selected_predictor.inferred_type) if selected_predictor else None
                if predictor_type not in {"continuous_numerical", "discrete_numerical", "binary", "categorical"}:
                    raise ValueError(f"'{selected_feature}' is classified as {predictor_type or 'unknown'} and cannot be used directly as a regression predictor.")
            result = run_linear_regression(supervised_df, target_col, feature_cols, excluded_cols)
        elif algorithm == "decision_tree":
            if not target_col:
                raise ValueError("Decision Tree requires a target column.")
            result = run_decision_tree(supervised_df, target_col, feature_cols, excluded_cols)
        elif algorithm == "kmeans":
            result = run_kmeans_clustering(typed_df, numeric_feature_cols, excluded_cols, n_clusters=n_clusters)
        elif algorithm == "pca":
            # PCA consumes selected numeric measurements; user-selected
            # categorical columns are explicitly one-hot encoded first.
            pca_excluded = list(set(excluded_cols + ([target_col] if target_col else [])))
            requested_pca_features = [c.strip() for c in feature_columns.split(",") if c.strip()] if feature_columns else None
            numeric_profile_columns = {c.name for c in dataset.columns if (c.selected_type or c.inferred_type) in numeric_types and not c.is_excluded}
            pca_candidates = requested_pca_features or [c for c in df.columns if c in numeric_profile_columns and c not in pca_excluded]
            pca_frame = typed_df[pca_candidates].copy()
            categorical_pca = [c for c in pca_candidates if effective_types.get(c) == "categorical"]
            if categorical_pca:
                for col_name in categorical_pca:
                    pca_frame[col_name] = pca_frame[col_name].astype("string").fillna("__MISSING__")
                pca_frame = pd.get_dummies(pca_frame, columns=categorical_pca, drop_first=True, dtype=float)
            result = run_pca_decomposition(pca_frame, list(pca_frame.columns), pca_excluded)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported algorithm '{algorithm}'")
        if algorithm in {"linear_regression", "decision_tree"} and result.get("target_variable") != target_col:
            raise RuntimeError(f"Model result target mismatch: requested '{target_col}', received '{result.get('target_variable')}'.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Algorithm execution failed: {str(e)}")

    provenance_predictors = (pca_candidates if algorithm == "pca" else
                             numeric_feature_cols if algorithm == "kmeans" else feature_cols)
    warnings = _leakage_warnings(df, target_col if algorithm in {"linear_regression", "decision_tree"} else None, provenance_predictors)
    result["warnings"] = warnings
    dataset_version = _file_version(file_path)
    experiment_id = uuid.uuid4().hex
    model_inputs = result.get("features_used") or provenance_predictors
    model_parameters = ({"n_clusters": result.get("optimal_k"), "n_init": 10, "random_state": 42}
                        if algorithm == "kmeans" else
                        {"selected_features": pca_candidates, "standardized": True}
                        if algorithm == "pca" else
                        {"test_size": 0.2, "random_state": 42,
                         "estimator": "LinearRegression" if algorithm == "linear_regression" else "sklearn CART"})
    if _uses_dummy_energy_feature_policy(df) and target_col == DUMMY_ENERGY_TARGET and algorithm in {"linear_regression", "decision_tree"}:
        model_parameters["feature_policy"] = "dummy_energy_nine_predictors_v1"
    preprocessing = ({"imputation": "median fitted on training split", "categorical_encoding": "one-hot, drop first",
                      "scaling": "StandardScaler fitted on training split"} if algorithm == "linear_regression" else
                     {"imputation": "median fitted on training split", "categorical_encoding": "one-hot, drop first"}
                     if algorithm == "decision_tree" else
                     {"imputation": "median", "scaling": "StandardScaler"} if algorithm in {"kmeans", "pca"} else {})
    result["provenance"] = _model_provenance(
        dataset, dataset_version, experiment_id, algorithm,
        target_col if algorithm in {"linear_regression", "decision_tree"} else None,
        provenance_predictors, model_inputs,
        excluded_cols + ([target_col] if algorithm in {"kmeans", "pca"} and target_col else []),
        preprocessing,
        {"test_size": 0.2, "random_state": 42} if algorithm in {"linear_regression", "decision_tree"} else None,
        model_parameters, warnings)
    result["provenance"]["experiment_id"] = experiment_id
    # Workspace results are returned directly and are not added to run history.
    col_mappings = [{"name": c.name, "unit": c.unit, "meaning": c.custom_meaning, "inferred_type": c.inferred_type, "selected_type": c.selected_type, "effective_type": c.selected_type or c.inferred_type} for c in dataset.columns]
    single_ai_payload = {
        "analysis_id": 0,
        "verified_workspace_results": True,
        "dataset_summary": {
            "original_name": dataset.original_name,
            "row_count": dataset.row_count,
            "col_count": dataset.col_count,
            "target": target_col,
            "algorithm_studied": algorithm
        },
        "column_mappings": col_mappings,
        "model_readiness": {},
        "experiment_statuses": {name: "completed" if name == algorithm else "not_yet_executed"
                                for name in ("linear_regression", "decision_tree", "kmeans", "pca")},
        "linear_regression": result if algorithm == "linear_regression" else None,
        "decision_tree": result if algorithm == "decision_tree" else None,
        "kmeans": result if algorithm == "kmeans" else None,
        "pca": result if algorithm == "pca" else None,
        "skipped_models": {},
        "data_improvement_advice": get_data_improvement_advisor(df),
        # Dataset-wide observations belong in the consolidated report once, not
        # repeated in every algorithm-specific companion.
        "direct_observations": []
    }

    ai_companion = interpret_analysis_with_gemini(single_ai_payload)

    return {
        "dataset_id": dataset.id,
        "run_id": experiment_id,
        "experiment_id": experiment_id,
        "dataset_version": dataset_version,
        "algorithm": algorithm,
        "target_column": target_col,
        "result": result,
        "ai_companion": ai_companion
    }

# --- ML EXECUTION & ANALYSIS ---

@router.post("/datasets/{dataset_id}/consolidate-workspaces", tags=["ML Engine"])
def consolidate_workspace_results(dataset_id: int, body: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    """Build a report from completed workspace artifacts; this endpoint never executes models."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    file_path = settings.UPLOADS_DIR / dataset.filename
    if not file_path.exists():
        file_path = settings.DATASETS_DIR / dataset.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dataset file missing on disk")
    current_version = _file_version(file_path)
    df, delimiter = load_clean_dataframe(file_path)
    experiments = body.get("experiments") or {}
    attempt_statuses = body.get("attempt_statuses") or {}
    expected = ("linear_regression", "decision_tree", "kmeans", "pca")
    selected: Dict[str, Optional[Dict[str, Any]]] = {}
    skipped: Dict[str, str] = {}
    experiment_statuses: Dict[str, str] = {}
    for algorithm in expected:
        experiment = experiments.get(algorithm)
        if not experiment:
            selected[algorithm] = None
            attempted_status = attempt_statuses.get(algorithm)
            if attempted_status in {"incomplete", "running"}:
                experiment_statuses[algorithm] = "incomplete"
                skipped[algorithm] = "The latest workspace attempt did not produce a completed result."
            else:
                experiment_statuses[algorithm] = "not_yet_executed"
                skipped[algorithm] = "No completed workspace result is available."
            continue
        provenance = ((experiment.get("result") or {}).get("provenance") or {})
        if (experiment.get("algorithm") != algorithm or experiment.get("dataset_id") != dataset.id
                or experiment.get("dataset_version") != current_version
                or provenance.get("experiment_id") != experiment.get("experiment_id")
                or provenance.get("dataset_id") != dataset.id
                or provenance.get("dataset_version") != current_version
                or provenance.get("algorithm") != algorithm):
            raise HTTPException(status_code=409, detail=f"Cannot consolidate {algorithm}: its dataset identity, version, or run metadata does not match the selected dataset. Re-run that workspace on the current dataset.")
        if _uses_dummy_energy_feature_policy(df) and algorithm in {"linear_regression", "decision_tree"}:
            if provenance.get("target_variable") != DUMMY_ENERGY_TARGET:
                raise HTTPException(status_code=409, detail=f"Cannot consolidate {algorithm}: rerun it with target '{DUMMY_ENERGY_TARGET}'.")
            if provenance.get("predictor_variables") != DUMMY_ENERGY_PREDICTORS:
                raise HTTPException(status_code=409, detail=f"Cannot consolidate {algorithm}: rerun it with the approved nine predictor variables.")
            if (provenance.get("model_parameters") or {}).get("feature_policy") != "dummy_energy_nine_predictors_v1":
                raise HTTPException(status_code=409, detail=f"Cannot consolidate {algorithm}: its results predate the approved feature policy and must be rerun.")
        selected[algorithm] = experiment.get("result")
        experiment_statuses[algorithm] = "completed"

    target_columns = {name: ((result or {}).get("provenance") or {}).get("target_variable")
                      for name, result in selected.items() if result}
    supervised_targets = {name: value for name, value in target_columns.items() if name in {"linear_regression", "decision_tree"} and value}
    target_col = next(iter(supervised_targets.values()), None)
    profile = profile_dataset(df, dataset.id, dataset.original_name, delimiter)
    direct_observations = build_direct_observations(df, target_col)
    dataset_assessment = {
        "source_type": "synthetic_or_sample_demonstration" if dataset.is_sample else "user_uploaded_dataset",
        "coverage_period": None, "target_summary": None,
        "data_quality_score": profile["data_quality_score"],
        "data_quality_indicators": profile["data_quality_indicators"],
        "feature_columns": sorted({column for result in selected.values() if result
                                    for column in ((result.get("provenance") or {}).get("predictor_variables") or [])}),
        "direct_observations": direct_observations,
        "scope_note": "This report consolidates the exact completed workspace results. It does not rerun models."
    }
    experiment_ids = [experiments[name]["experiment_id"] for name in expected if selected[name]]
    report_run_id = "workspace-" + "-".join(experiment_ids)
    ai_payload = {
        "analysis_id": 0,
        "verified_workspace_results": True,
        "experiment_statuses": experiment_statuses,
        "dataset_summary": {"original_name": dataset.original_name, "row_count": dataset.row_count,
                            "col_count": dataset.col_count, "target": target_columns,
                            "workspace_experiments": experiment_ids},
        "column_mappings": [], "model_readiness": {},
        "linear_regression": selected["linear_regression"],
        "decision_tree": selected["decision_tree"], "kmeans": selected["kmeans"], "pca": selected["pca"],
        "direct_observations": direct_observations, "skipped_models": skipped,
        "data_improvement_advice": [],
    }
    insights = interpret_analysis_with_gemini(ai_payload)
    report = {
        "analysis_id": 0, "run_id": report_run_id, "dataset_id": dataset.id,
        "dataset_version": current_version, "run_name": "Workspace experiment consolidation",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "INCOMPLETE" if skipped else "COMPLETED",
        "target_column": "Multiple targets" if len(set(supervised_targets.values())) > 1 else target_col,
        "target_variables": target_columns,
        "experiment_statuses": experiment_statuses,
        **selected,
        "model_provenance": {name: (result or {}).get("provenance") for name, result in selected.items() if result},
        "skipped_models": skipped, "dataset_assessment": dataset_assessment,
    }
    return {"report": report, "insights": insights}

@router.post("/datasets/{dataset_id}/analyse", response_model=FullAnalysisRunResponse, tags=["ML Engine"])
def run_analysis(
    dataset_id: int,
    run_name: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = settings.UPLOADS_DIR / dataset.filename
    if not file_path.exists():
        file_path = settings.DATASETS_DIR / dataset.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dataset file missing on disk")

    df, delimiter = load_clean_dataframe(file_path)

    # Fetch configuration
    target_col = None
    feature_cols = []
    excluded_cols = []
    col_mappings = []
    effective_types = {}

    for col in dataset.columns:
        effective_type = col.selected_type or col.inferred_type
        effective_types[col.name] = effective_type
        col_mappings.append({
            "name": col.name,
            "unit": col.unit,
            "meaning": col.custom_meaning,
            "is_target": col.is_target,
            "is_feature": col.is_feature,
            "inferred_type": col.inferred_type,
            "selected_type": col.selected_type,
            "effective_type": effective_type
        })
        if col.is_target:
            target_col = col.name
        elif col.is_excluded or effective_type in {"datetime", "text_identifier", "unknown", "constant"}:
            excluded_cols.append(col.name)
        elif col.is_feature or effective_type in {"continuous_numerical", "discrete_numerical", "binary", "categorical"}:
            feature_cols.append(col.name)

    numeric_types = {"continuous_numerical", "discrete_numerical", "binary"}
    if _uses_dummy_energy_feature_policy(df):
        feature_cols = _validate_supervised_predictors(
            df, target_col or "", "combined supervised models", feature_cols)
        excluded_cols = list(dict.fromkeys(excluded_cols + sorted(DUMMY_ENERGY_EXCLUDED_PREDICTORS)))
    numeric_feature_cols = [c for c in feature_cols if effective_types.get(c) in numeric_types]
    typed_df = df.copy()
    for col_name in feature_cols:
        if effective_types.get(col_name) in numeric_types and not pd.api.types.is_numeric_dtype(typed_df[col_name]):
            parsed = pd.to_numeric(typed_df[col_name], errors="coerce")
            if parsed.notna().sum() >= max(1, int(typed_df[col_name].notna().sum() * 0.95)):
                typed_df[col_name] = parsed
        if effective_types.get(col_name) == "binary" and not pd.api.types.is_numeric_dtype(typed_df[col_name]):
            levels = sorted(typed_df[col_name].dropna().astype(str).unique().tolist())
            if len(levels) == 2:
                typed_df[col_name] = typed_df[col_name].astype(str).map({levels[0]: 0, levels[1]: 1})
    supervised_df = typed_df.copy()
    for col_name in feature_cols:
        if effective_types.get(col_name) == "categorical":
            supervised_df[col_name] = "category:" + supervised_df[col_name].astype("string").fillna("__MISSING__")
    # Readiness assessment check uses the same selected types as execution.
    readiness = assess_model_readiness(supervised_df, target_col, feature_cols, excluded_cols)
    profile = profile_dataset(df, dataset.id, dataset.original_name, delimiter)
    data_advice = get_data_improvement_advisor(df)
    dataset_version = _file_version(file_path)

    # Create AnalysisRun entity
    run_title = run_name or f"Analysis Run ({dataset.original_name[:20]}) - {dataset.analyses.__len__() + 1}"
    analysis_run = AnalysisRun(
        dataset_id=dataset.id,
        run_name=run_title,
        target_column=target_col or "",
        status="RUNNING",
        data_quality_score=profile["data_quality_score"],
        data_quality_summary=f"Quality Score: {profile['data_quality_score']}/100",
        config_json=json.dumps({"dataset_version": dataset_version, "target": target_col,
                                "requested_features": feature_cols, "excluded_features": excluded_cols,
                                "feature_types": effective_types, "created_by": "combined_four_method_run"})
    )
    db.add(analysis_run)
    db.commit()
    db.refresh(analysis_run)

    lr_result = None
    dt_result = None
    km_result = None
    pca_result = None
    skipped_models = {}

    # 1. Run Linear Regression if READY or CONDITIONAL
    if readiness["models"]["linear_regression"]["is_runnable"] and target_col:
        try:
            lr_res = run_linear_regression(supervised_df, target_col, feature_cols, excluded_cols)
            lr_parameters = {"test_size": 0.2, "random_state": 42, "estimator": "sklearn.linear_model.LinearRegression"}
            if _uses_dummy_energy_feature_policy(df) and target_col == DUMMY_ENERGY_TARGET:
                lr_parameters["feature_policy"] = "dummy_energy_nine_predictors_v1"
            lr_res["provenance"] = _model_provenance(dataset, dataset_version, analysis_run.id, "linear_regression", target_col,
                feature_cols, [c["feature"] for c in lr_res.get("coefficients", [])], excluded_cols,
                {"imputation": "median", "categorical_encoding": "one-hot, drop first", "scaling": "StandardScaler"},
                {"test_size": 0.2, "random_state": 42}, lr_parameters,
                _leakage_warnings(df, target_col, feature_cols))
            lr_result = lr_res
            m_rec = ModelResult(
                analysis_id=analysis_run.id,
                model_name="linear_regression",
                status="COMPLETED",
                is_runnable=True,
                execution_time_ms=lr_res["execution_time_ms"],
                metrics_json=json.dumps({"r2": lr_res["r2_score"], "rmse": lr_res["rmse"], "mae": lr_res["mae"]}),
                artifacts_json=json.dumps(lr_res),
                explanation=f"OLS regression achieved R²={lr_res['r2_score']} on test split."
            )
            db.add(m_rec)
        except Exception as e:
            skipped_models["linear_regression"] = f"Execution error: {str(e)}"
    else:
        reason = "; ".join(readiness["models"]["linear_regression"]["missing_prerequisites"] or ["Target not selected"])
        skipped_models["linear_regression"] = f"Skipped: {reason}"

    # 2. Run Decision Tree if READY or CONDITIONAL
    if readiness["models"]["decision_tree"]["is_runnable"] and target_col:
        try:
            dt_res = run_decision_tree(supervised_df, target_col, feature_cols, excluded_cols)
            dt_parameters = {"max_depth": 4, "min_samples_leaf": 3, "estimator": "sklearn CART"}
            if _uses_dummy_energy_feature_policy(df) and target_col == DUMMY_ENERGY_TARGET:
                dt_parameters["feature_policy"] = "dummy_energy_nine_predictors_v1"
            dt_res["provenance"] = _model_provenance(dataset, dataset_version, analysis_run.id, "decision_tree", target_col,
                feature_cols, dt_res.get("features_used", feature_cols), excluded_cols,
                {"imputation": "median", "categorical_encoding": "one-hot, drop first"},
                {"test_size": 0.2, "random_state": 42}, dt_parameters,
                _leakage_warnings(df, target_col, feature_cols))
            dt_result = dt_res
            m_rec = ModelResult(
                analysis_id=analysis_run.id,
                model_name="decision_tree",
                status="COMPLETED",
                is_runnable=True,
                execution_time_ms=dt_res["execution_time_ms"],
                metrics_json=json.dumps(dt_res["metrics"]),
                artifacts_json=json.dumps(dt_res),
                explanation=f"Decision tree identified {len(dt_res['feature_importances'])} split variables."
            )
            db.add(m_rec)
        except Exception as e:
            skipped_models["decision_tree"] = f"Execution error: {str(e)}"
    else:
        reason = "; ".join(readiness["models"]["decision_tree"]["missing_prerequisites"] or ["Target not selected"])
        skipped_models["decision_tree"] = f"Skipped: {reason}"

    # 3. Run K-Means Clustering if READY or CONDITIONAL
    if readiness["models"]["kmeans"]["is_runnable"]:
        try:
            km_res = run_kmeans_clustering(typed_df, numeric_feature_cols, excluded_cols)
            km_res["provenance"] = _model_provenance(dataset, dataset_version, analysis_run.id, "kmeans", None,
                numeric_feature_cols, km_res.get("features_used", []), excluded_cols + ([target_col] if target_col else []),
                {"imputation": "median", "scaling": "StandardScaler"}, None,
                {"candidate_k": [2, 6], "n_init": 10, "selection": "maximum valid silhouette", "estimator": "sklearn.cluster.KMeans"},
                _leakage_warnings(df, None, numeric_feature_cols))
            km_result = km_res
            m_rec = ModelResult(
                analysis_id=analysis_run.id,
                model_name="kmeans",
                status="COMPLETED",
                is_runnable=True,
                execution_time_ms=km_res["execution_time_ms"],
                metrics_json=json.dumps({"optimal_k": km_res["optimal_k"], "silhouette_score": km_res["silhouette_score"]}),
                artifacts_json=json.dumps(km_res),
                explanation=f"Formed {km_res['optimal_k']} clusters with silhouette score of {km_res['silhouette_score']}."
            )
            db.add(m_rec)
        except Exception as e:
            skipped_models["kmeans"] = f"Execution error: {str(e)}"
    else:
        reason = "; ".join(readiness["models"]["kmeans"]["missing_prerequisites"])
        skipped_models["kmeans"] = f"Skipped: {reason}"

    # 4. Run PCA if READY or CONDITIONAL
    if readiness["models"]["pca"]["is_runnable"]:
        try:
            pca_res = run_pca_decomposition(typed_df, numeric_feature_cols, excluded_cols)
            pca_res["provenance"] = _model_provenance(dataset, dataset_version, analysis_run.id, "pca", None,
                numeric_feature_cols, pca_res.get("features_used", []), excluded_cols + ([target_col] if target_col else []),
                {"imputation": "median", "scaling": "StandardScaler", "categorical_encoding": "none in combined run"}, None,
                {"max_components": 4, "estimator": "sklearn.decomposition.PCA"},
                _leakage_warnings(df, None, numeric_feature_cols))
            pca_result = pca_res
            m_rec = ModelResult(
                analysis_id=analysis_run.id,
                model_name="pca",
                status="COMPLETED",
                is_runnable=True,
                execution_time_ms=pca_res["execution_time_ms"],
                metrics_json=json.dumps({"variance_explained": pca_res["explained_variance_ratio"]}),
                artifacts_json=json.dumps(pca_res),
                explanation=f"PCA decomposed data into {pca_res['n_components']} components."
            )
            db.add(m_rec)
        except Exception as e:
            skipped_models["pca"] = f"Execution error: {str(e)}"
    else:
        reason = "; ".join(readiness["models"]["pca"]["missing_prerequisites"])
        skipped_models["pca"] = f"Skipped: {reason}"

    analysis_run.status = "COMPLETED"
    db.commit()

    # Generate AI / Heuristic Insights
    ai_payload = {
        "analysis_id": analysis_run.id,
        "run_id": analysis_run.id,
        "dataset_version": dataset_version,
        "dataset_summary": {
            "original_name": dataset.original_name,
            "row_count": dataset.row_count,
            "col_count": dataset.col_count,
            "target": target_col
        },
        "column_mappings": col_mappings,
        "model_readiness": readiness["models"],
        "linear_regression": lr_result,
        "decision_tree": dt_result,
        "kmeans": km_result,
        "pca": pca_result,
        "direct_observations": build_direct_observations(df, target_col),
        "skipped_models": skipped_models,
        "data_improvement_advice": data_advice
    }

    try:
        insights = interpret_analysis_with_gemini(ai_payload)
        ai_rec = AiInsight(
            analysis_id=analysis_run.id,
            executive_summary=insights["executive_summary"],
            discoveries_json=json.dumps(insights["major_discoveries"]),
            cross_model_insights=insights["cross_model_insights"],
            inefficiencies_json=json.dumps(insights["potential_inefficiencies"]),
            recommendations_json=json.dumps(insights["practical_recommendations"]),
            data_recommendations_json=json.dumps(insights["data_collection_recommendations"]),
            confidence_notes=insights["confidence_and_evidence"],
            limitations=insights["limitations"],
            is_ai_generated=insights["is_ai_generated"],
            model_used=insights["model_used"]
        )
        db.add(ai_rec)
        db.commit()
    except Exception as e:
        pass

    date_coverage = None
    for col_name in df.columns:
        if any(token in col_name.lower() for token in ("date", "time", "timestamp")):
            parsed_dates = pd.to_datetime(df[col_name], errors="coerce", utc=True)
            if parsed_dates.notna().sum() >= max(2, int(len(df) * 0.5)):
                date_coverage = {"column": col_name, "start": parsed_dates.min().isoformat(), "end": parsed_dates.max().isoformat()}
                break
    target_summary = None
    if target_col and target_col in df.columns:
        target_values = df[target_col]
        if pd.api.types.is_numeric_dtype(target_values):
            values = target_values.replace([np.inf, -np.inf], np.nan).dropna()
            if len(values):
                target_summary = {"type": "numeric", "count": int(len(values)), "missing_count": int(target_values.isna().sum()), "minimum": float(values.min()), "median": float(values.median()), "maximum": float(values.max()), "mean": float(values.mean()), "standard_deviation": float(values.std(ddof=1)) if len(values) > 1 else 0.0}
        else:
            counts = target_values.dropna().astype(str).value_counts().head(8)
            target_summary = {"type": "categorical", "count": int(target_values.notna().sum()), "missing_count": int(target_values.isna().sum()), "observed_categories": [{"label": str(label), "count": int(count)} for label, count in counts.items()]}
    dataset_assessment = {
        "source_type": "synthetic_or_sample_demonstration" if dataset.is_sample else "user_uploaded_dataset",
        "coverage_period": date_coverage,
        "target_summary": target_summary,
        "data_quality_score": profile["data_quality_score"],
        "data_quality_indicators": profile["data_quality_indicators"],
        "feature_columns": feature_cols,
        "direct_observations": build_direct_observations(df, target_col),
        "scope_note": "Results describe the supplied data and computed model outputs. They do not establish causation or measured savings."
    }

    analysis_run.status = "COMPLETED"
    analysis_run.config_json = json.dumps({"dataset_version": dataset_version, "target": target_col,
        "requested_features": feature_cols, "excluded_features": excluded_cols, "feature_types": effective_types,
        "models": {key: (value or {}).get("provenance") for key, value in {
            "linear_regression": lr_result, "decision_tree": dt_result, "kmeans": km_result, "pca": pca_result}.items()}})
    db.commit()

    return {
        "analysis_id": analysis_run.id,
        "run_id": analysis_run.id,
        "dataset_id": dataset.id,
        "dataset_version": dataset_version,
        "run_name": analysis_run.run_name,
        "created_at": analysis_run.created_at,
        "status": "COMPLETED",
        "target_column": target_col,
        "linear_regression": lr_result,
        "decision_tree": dt_result,
        "kmeans": km_result,
        "pca": pca_result,
        "model_provenance": {key: value.get("provenance") for key, value in {
            "linear_regression": lr_result, "decision_tree": dt_result, "kmeans": km_result, "pca": pca_result}.items() if value},
        "skipped_models": skipped_models,
        "dataset_assessment": dataset_assessment
    }

# --- ANALYSES & INSIGHTS RETRIEVAL ---

@router.get("/analyses", tags=["Analyses"])
def list_analyses(db: Session = Depends(get_db)):
    runs = db.query(AnalysisRun).order_by(AnalysisRun.created_at.desc()).all()
    results = []
    for r in runs:
        results.append({
            "id": r.id,
            "dataset_id": r.dataset_id,
            "dataset_name": r.dataset.original_name if r.dataset else "Unknown",
            "run_name": r.run_name,
            "target_column": r.target_column,
            "created_at": r.created_at,
            "status": r.status,
            "data_quality_score": r.data_quality_score,
            "model_count": len(r.model_results)
            ,"dataset_version": json.loads(r.config_json or "{}").get("dataset_version")
        })
    return results

@router.get("/analyses/{analysis_id}", tags=["Analyses"])
def get_analysis_detail(analysis_id: int, db: Session = Depends(get_db)):
    run = db.query(AnalysisRun).filter(AnalysisRun.id == analysis_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Analysis run not found")

    models_data = {}
    for m in run.model_results:
        try:
            models_data[m.model_name] = json.loads(m.artifacts_json)
        except Exception:
            models_data[m.model_name] = {"status": m.status, "notes": [m.explanation]}

    return {
        "analysis_id": run.id,
        "dataset_id": run.dataset_id,
        "dataset_name": run.dataset.original_name if run.dataset else "Unknown",
        "run_name": run.run_name,
        "target_column": run.target_column,
        "created_at": run.created_at,
        "status": run.status,
        "data_quality_score": run.data_quality_score,
        "run_config": json.loads(run.config_json or "{}"),
        "linear_regression": models_data.get("linear_regression"),
        "decision_tree": models_data.get("decision_tree"),
        "kmeans": models_data.get("kmeans"),
        "pca": models_data.get("pca")
    }

@router.get("/analyses/{analysis_id}/insights", response_model=AiInsightResponse, tags=["AI Insights"])
def get_analysis_insights(analysis_id: int, db: Session = Depends(get_db)):
    ai_insight = db.query(AiInsight).filter(AiInsight.analysis_id == analysis_id).first()
    if not ai_insight:
        raise HTTPException(status_code=404, detail="Insights not found for this analysis run")

    return {
        "analysis_id": ai_insight.analysis_id,
        "executive_summary": ai_insight.executive_summary,
        "major_discoveries": json.loads(ai_insight.discoveries_json or "[]"),
        "cross_model_insights": ai_insight.cross_model_insights,
        "potential_inefficiencies": json.loads(ai_insight.inefficiencies_json or "[]"),
        "practical_recommendations": json.loads(ai_insight.recommendations_json or "[]"),
        "data_collection_recommendations": json.loads(ai_insight.data_recommendations_json or "[]"),
        "confidence_and_evidence": ai_insight.confidence_notes,
        "limitations": ai_insight.limitations,
        "is_ai_generated": ai_insight.is_ai_generated,
        "model_used": ai_insight.model_used,
        "interpretation_status": "gemini_active" if ai_insight.is_ai_generated else "local_fallback",
        "validated_against_results": not ai_insight.is_ai_generated or "validation failed" not in (ai_insight.model_used or "").lower()
    }
