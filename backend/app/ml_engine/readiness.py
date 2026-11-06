from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np

def assess_model_readiness(
    df: pd.DataFrame,
    target_col: Optional[str] = None,
    feature_cols: Optional[List[str]] = None,
    excluded_cols: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Assesses dataset readiness independently for Linear Regression, Decision Tree,
    K-Means Clustering, and PCA based on rigorous statistical and domain prerequisites.
    """
    n_rows, n_cols = df.shape
    excluded = set(excluded_cols or [])
    
    # Identify available numeric and categorical columns
    all_numeric_cols = [c for c in df.select_dtypes(include=[np.number]).columns if c not in excluded]
    all_categorical_cols = [c for c in df.select_dtypes(exclude=[np.number]).columns if c not in excluded]
    
    # Features candidates
    if feature_cols:
        active_features = [c for c in feature_cols if c in df.columns and c != target_col and c not in excluded]
    else:
        active_features = [c for c in df.columns if c != target_col and c not in excluded]

    active_numeric_features = []
    active_categorical_features = []
    for col in active_features:
        values = pd.to_numeric(df[col], errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
        if len(values) and values.nunique() > 1:
            active_numeric_features.append(col)
        elif not pd.api.types.is_numeric_dtype(df[col]) and df[col].nunique() > 1 and df[col].nunique() <= min(100, max(25, int(len(df) * 0.5))):
            active_categorical_features.append(col)
    active_supervised_features = active_numeric_features + active_categorical_features
    
    # Target validity check
    target_exists = target_col is not None and target_col in df.columns
    target_is_numeric = target_exists and pd.api.types.is_numeric_dtype(df[target_col])
    target_unique_count = df[target_col].nunique() if target_exists else 0
    target_missing_count = int(df[target_col].isna().sum()) if target_exists else 0
    target_missing_pct = (target_missing_count / n_rows * 100) if (target_exists and n_rows > 0) else 0.0

    models_assessment = {}

    # -------------------------------------------------------------
    # 1. LINEAR REGRESSION
    # -------------------------------------------------------------
    lr_reqs_met = []
    lr_missing = []
    lr_suggestions = []
    lr_risks = []
    lr_status = "READY"
    lr_runnable = True

    if not target_exists:
        lr_status = "INSUFFICIENT"
        lr_runnable = False
        lr_missing.append("Target variable not selected or not found in dataset.")
        lr_suggestions.append("Select a continuous numerical target (e.g. total_energy_kwh or grid_import_kwh).")
    elif not target_is_numeric:
        lr_status = "INSUFFICIENT"
        lr_runnable = False
        lr_missing.append(f"Target '{target_col}' is non-numeric. Linear regression requires a continuous numerical response.")
        lr_suggestions.append("Choose a numerical metric or use classification algorithms.")
    elif target_unique_count < 10:
        lr_status = "CONDITIONAL"
        lr_risks.append(f"Target variable has only {target_unique_count} distinct levels; behaves more like discrete ordinal/categorical data than a continuous response.")
    else:
        lr_reqs_met.append(f"Valid continuous numerical target '{target_col}' confirmed.")

    if len(active_supervised_features) < 1:
        lr_status = "INSUFFICIENT"
        lr_runnable = False
        lr_missing.append("At least 1 numerical predictor feature is required for linear regression.")
        lr_suggestions.append("Map and include numerical variables (occupancy, temperature, appliance hours).")
    else:
        lr_reqs_met.append(f"{len(active_numeric_features)} numerical and {len(active_categorical_features)} encodable categorical predictor feature(s) available.")

    # Sample-to-feature ratio checks
    p = len(active_supervised_features)
    if n_rows < 15:
        lr_status = "INSUFFICIENT"
        lr_runnable = False
        lr_missing.append(f"Sample size ({n_rows} rows) is statistically inadequate (minimum 15 required).")
    elif n_rows < 10 * p:
        if lr_status == "READY":
            lr_status = "CONDITIONAL"
        lr_risks.append(f"Sample size ({n_rows}) is below the recommended 10 observations per feature ({10 * p}). High risk of overfitting.")
        lr_suggestions.append(f"Collect at least {10 * p - n_rows} additional observations or reduce predictor count.")
    else:
        lr_reqs_met.append(f"Sufficient observation-to-feature ratio ({n_rows} samples for {p} predictors).")

    if target_missing_pct > 25.0:
        if lr_status == "READY":
            lr_status = "CONDITIONAL"
        lr_risks.append(f"Target column has {target_missing_pct:.1f}% missing values. High rate of dropped samples.")

    models_assessment["linear_regression"] = {
        "model_name": "linear_regression",
        "display_name": "Linear Regression (Ordinary Least Squares)",
        "status": lr_status,
        "is_runnable": lr_runnable,
        "summary": "Fits a linear parametric relationship between hostel environmental/operational variables and energy demand." if lr_runnable else "Cannot execute: critical target or feature preconditions not satisfied.",
        "requirements_met": lr_reqs_met,
        "missing_prerequisites": lr_missing,
        "data_collection_suggestions": lr_suggestions,
        "risk_factors": lr_risks
    }

    # -------------------------------------------------------------
    # 2. DECISION TREE
    # -------------------------------------------------------------
    dt_reqs_met = []
    dt_missing = []
    dt_suggestions = []
    dt_risks = []
    dt_status = "READY"
    dt_runnable = True

    if not target_exists:
        dt_status = "INSUFFICIENT"
        dt_runnable = False
        dt_missing.append("Supervised Decision Tree requires a target variable.")
        dt_suggestions.append("Select a regression target (energy usage) or a categorical target (peak/off-peak, block).")
    else:
        task_mode = "Regression" if target_is_numeric and target_unique_count > 5 else "Classification"
        dt_reqs_met.append(f"Target '{target_col}' detected for {task_mode} Tree.")

    if len(active_features) < 1:
        dt_status = "INSUFFICIENT"
        dt_runnable = False
        dt_missing.append("Requires at least one usable feature.")
    else:
        dt_reqs_met.append(f"{len(active_features)} candidate feature(s) available.")

    if n_rows < 20:
        dt_status = "INSUFFICIENT"
        dt_runnable = False
        dt_missing.append(f"Sample size ({n_rows}) too small for tree splits without severe leaf starvation.")
    elif n_rows < 50:
        if dt_status == "READY":
            dt_status = "CONDITIONAL"
        dt_risks.append(f"Small sample size ({n_rows}). Tree depth will be constrained to prevent leaf memorization.")

    models_assessment["decision_tree"] = {
        "model_name": "decision_tree",
        "display_name": "Decision Tree (CART Regressor / Classifier)",
        "status": dt_status,
        "is_runnable": dt_runnable,
        "summary": "Generates hierarchical decision splits revealing non-linear threshold rules driving consumption regimes.",
        "requirements_met": dt_reqs_met,
        "missing_prerequisites": dt_missing,
        "data_collection_suggestions": dt_suggestions,
        "risk_factors": dt_risks
    }

    # -------------------------------------------------------------
    # 3. K-MEANS CLUSTERING
    # -------------------------------------------------------------
    km_reqs_met = []
    km_missing = []
    km_suggestions = []
    km_risks = []
    km_status = "READY"
    km_runnable = True

    # K-means does NOT require a target
    km_reqs_met.append("Unsupervised algorithm: no target variable required.")

    if len(active_numeric_features) < 2:
        km_status = "INSUFFICIENT"
        km_runnable = False
        km_missing.append(f"Requires at least 2 numerical features for multidimensional distance clustering (found {len(active_numeric_features)}).")
        km_suggestions.append("Include numerical metrics such as cooling hours, occupancy count, solar generation.")
    else:
        km_reqs_met.append(f"{len(active_numeric_features)} numerical features available for distance calculation.")

    if n_rows < 15:
        km_status = "INSUFFICIENT"
        km_runnable = False
        km_missing.append(f"Sample size ({n_rows}) is too small to form stable geometric clusters.")
    elif n_rows < 30:
        if km_status == "READY":
            km_status = "CONDITIONAL"
        km_risks.append("Sample size under 30 rows; clusters may be sensitive to single outlier points.")

    models_assessment["kmeans"] = {
        "model_name": "kmeans",
        "display_name": "K-Means Clustering (Operational Regime Discovery)",
        "status": km_status,
        "is_runnable": km_runnable,
        "summary": "Groups days or wings into distinct operational behavior clusters based on standardized Euclidean distance.",
        "requirements_met": km_reqs_met,
        "missing_prerequisites": km_missing,
        "data_collection_suggestions": km_suggestions,
        "risk_factors": km_risks
    }

    # -------------------------------------------------------------
    # 4. PRINCIPAL COMPONENT ANALYSIS (PCA)
    # -------------------------------------------------------------
    pca_reqs_met = []
    pca_missing = []
    pca_suggestions = []
    pca_risks = []
    pca_status = "READY"
    pca_runnable = True

    # PCA does not require a target
    pca_reqs_met.append("Unsupervised dimensionality reduction: operates purely on feature covariance.")

    pca_numeric_features = []
    for col in active_features:
        name = str(col).lower()
        if any(token in name for token in ("date", "time", "timestamp", "_id", "identifier")):
            continue
        parsed = pd.to_numeric(df[col], errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
        if len(parsed) and parsed.nunique() > 1:
            pca_numeric_features.append(col)

    if len(pca_numeric_features) < 3:
        if len(pca_numeric_features) == 2:
            pca_status = "CONDITIONAL"
            pca_risks.append("Only 2 variable numeric measurements are available. PCA can return two components, but further dimensionality reduction is not possible.")
        else:
            pca_status = "INSUFFICIENT"
            pca_runnable = False
            pca_missing.append(f"Requires at least 2 variable numeric measurements; found {len(pca_numeric_features)} among the selected features.")
            pca_suggestions.append("Select numeric measurement columns, correct decimal formatting, and exclude date, identifier, and categorical fields.")
    else:
        pca_reqs_met.append(f"{len(pca_numeric_features)} variable numeric measurements available.")

    if n_rows < len(pca_numeric_features) + 2:
        pca_status = "INSUFFICIENT"
        pca_runnable = False
        pca_missing.append(f"Number of samples ({n_rows}) is too small for {len(pca_numeric_features)} selected numeric measurements.")
    elif n_rows < 25:
        if pca_status == "READY":
            pca_status = "CONDITIONAL"
        pca_risks.append("Low sample size may yield unstable eigenvector estimates for lower-ranked components.")

    models_assessment["pca"] = {
        "model_name": "pca",
        "display_name": "Principal Component Analysis (PCA)",
        "status": pca_status,
        "is_runnable": pca_runnable,
        "summary": "Decomposes multivariate energy covariance into orthogonal principal axes to isolate dominant latent drivers.",
        "requirements_met": pca_reqs_met,
        "missing_prerequisites": pca_missing,
        "data_collection_suggestions": pca_suggestions,
        "risk_factors": pca_risks
    }

    # Calculate overall readiness score (percentage of ready or conditional models)
    ready_count = sum(1 for m in models_assessment.values() if m["status"] in ["READY", "CONDITIONAL"])
    overall_score = round((ready_count / 4.0) * 100, 1)
    recommended = [k for k, v in models_assessment.items() if v["status"] in ["READY", "CONDITIONAL"]]

    return {
        "dataset_id": 0,
        "target_column": target_col,
        "models": models_assessment,
        "overall_readiness_score": overall_score,
        "recommended_models": recommended
    }

def get_data_improvement_advisor(df: pd.DataFrame) -> List[Dict[str, str]]:
    """Return only measurement gaps that limit interpretation of the columns provided."""
    names = [str(c).lower() for c in df.columns]
    advice: List[Dict[str, str]] = []
    energy_context = any(any(token in name for token in ("energy", "consumption", "electric", "power", "kwh", "watt", "eui")) for name in names)
    has_time = any(any(token in name for token in ("time", "date", "hour", "timestamp")) for name in names)

    if not has_time:
        advice.append({"missing_parameter": "Date and time for each measurement", "analytical_impact": "The records cannot be compared by hour, day, or season, and the assessment period cannot be reported.", "recommended_sensor_or_log": "Time-stamped meter records at a consistent interval, with timezone and interval definitions."})
    if energy_context and not any(any(token in name for token in ("occupan", "resident", "headcount", "person", "student")) for name in names):
        advice.append({"missing_parameter": "Occupancy counts aligned to meter intervals", "analytical_impact": "Consumption cannot be normalized by the number of residents or compared at similar occupancy.", "recommended_sensor_or_log": "Privacy-appropriate daily occupancy counts aligned with the meter reporting periods."})
    if energy_context and not any(any(token in name for token in ("submeter", "circuit", "appliance", "equipment", "device")) for name in names):
        advice.append({"missing_parameter": "Circuit or equipment-level readings", "analytical_impact": "Whole-site or whole-building readings cannot locate which circuit contributes to a pattern.", "recommended_sensor_or_log": "Time-aligned submeter readings for selected circuits, supported by a documented equipment inventory."})
    if energy_context and not any(any(token in name for token in ("temp", "weather", "ambient", "outdoor")) for name in names):
        advice.append({"missing_parameter": "Outdoor temperature aligned to readings", "analytical_impact": "The analysis cannot check whether demand patterns coincide with outdoor temperature changes.", "recommended_sensor_or_log": "A nearby weather station or a reputable local weather record using matching timestamps."})
    if energy_context and not any(any(token in name for token in ("tariff", "price", "cost", "rate")) for name in names):
        advice.append({"missing_parameter": "Applicable electricity tariff and bill period", "analytical_impact": "The analysis cannot estimate electricity cost or assess financial return.", "recommended_sensor_or_log": "Utility bills and the tariff schedule applicable to the same meter and dates."})
    return advice
