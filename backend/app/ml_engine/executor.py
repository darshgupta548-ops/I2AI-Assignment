import time
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier, export_text
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, accuracy_score, f1_score, silhouette_score

def prepare_features_and_target(
    df: pd.DataFrame,
    target_col: Optional[str] = None,
    feature_cols: Optional[List[str]] = None,
    excluded_cols: Optional[List[str]] = None
) -> Tuple[pd.DataFrame, Optional[pd.Series], List[str]]:
    """
    Cleans, isolates predictors, and guards against target leakage.
    """
    excluded = set(excluded_cols or [])
    if target_col:
        excluded.add(target_col)
    
    # Identify available candidate features
    if feature_cols:
        features = [c for c in feature_cols if c in df.columns and c not in excluded]
    else:
        features = [c for c in df.columns if c not in excluded]

    # Filter out columns with zero variance (constants) or all-NaNs
    valid_features = []
    for col in features:
        if df[col].nunique() > 1 and df[col].notna().sum() > 5:
            valid_features.append(col)

    X = df[valid_features].copy()
    y = df[target_col].copy() if (target_col and target_col in df.columns) else None

    return X, y, valid_features

def encode_supervised_features(X: pd.DataFrame) -> pd.DataFrame:
    """Keep numeric measurements numeric and one-hot encode text categories."""
    numeric_parts = {}
    categorical_parts = {}
    for col in X.columns:
        values = X[col]
        parsed = pd.to_numeric(values, errors="coerce")
        nonmissing = int(values.notna().sum())
        parse_ratio = parsed.notna().sum() / nonmissing if nonmissing else 0.0
        if pd.api.types.is_numeric_dtype(values) or parse_ratio >= 0.95:
            numeric_parts[col] = parsed.replace([np.inf, -np.inf], np.nan)
        else:
            if values.nunique(dropna=True) > 100:
                raise ValueError(f"Categorical predictor '{col}' has more than 100 levels. Group rare levels or exclude it before supervised encoding.")
            categorical_parts[col] = values.astype("string").fillna("__MISSING__")
    result = pd.DataFrame(numeric_parts, index=X.index)
    if categorical_parts:
        categorical = pd.DataFrame(categorical_parts, index=X.index)
        result = pd.concat([result, pd.get_dummies(categorical, drop_first=True, dtype=float)], axis=1)
    return result

def run_linear_regression(
    df: pd.DataFrame,
    target_col: str,
    feature_cols: Optional[List[str]] = None,
    excluded_cols: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Executes Linear Regression with rigorous train/test split, 
    prevention of leakage, coefficient analysis, and residual distributions.
    """
    start_time = time.time()
    
    # Isolate X and y
    X, y, features = prepare_features_and_target(df, target_col, feature_cols, excluded_cols)
    
    # One-hot encode selected categorical predictors; preserve numeric measurements.
    X_encoded = encode_supervised_features(X)
    numeric_features = list(X_encoded.columns)
    if not numeric_features:
        raise ValueError("Linear Regression requires at least one usable numerical or categorical predictor feature.")
    
    X_num = X_encoded[numeric_features].replace([np.inf, -np.inf], np.nan).copy()
    
    # Drop rows where target y is NaN
    y = pd.to_numeric(y, errors="coerce")
    valid_mask = y.notna() & np.isfinite(y)
    X_num = X_num[valid_mask]
    y = y[valid_mask]
    if len(y) < 10:
        raise ValueError("Linear Regression target must contain at least 10 valid numeric observations after parsing missing values.")

    # Train / Test split (80/20)
    X_train, X_test, y_train, y_test = train_test_split(X_num, y, test_size=0.2, random_state=42)

    # Select highly target-associated features on training rows only. Using the
    # held-out target values here would leak test information into preprocessing.
    leakage_warnings = []
    retained_features = list(numeric_features)
    for col in numeric_features:
        train_values = X_train[col]
        imputed_train = train_values.fillna(train_values.median())
        corr = np.corrcoef(imputed_train, y_train)[0, 1]
        if np.isfinite(corr) and np.abs(corr) > 0.999:
            leakage_warnings.append(f"'{col}' has a near-perfect association (|r|={abs(corr):.4f}) with the target on training rows. Correlation alone cannot establish leakage; verify its measurement timing and derivation.")

    X_train = X_train[retained_features]
    X_test = X_test[retained_features]
    X_final = X_num[retained_features]

    # Impute missing values ONLY fitted on X_train to prevent leakage
    imputer = SimpleImputer(strategy='median')
    X_train_imp = imputer.fit_transform(X_train)
    X_test_imp = imputer.transform(X_test)

    # Standardize predictors for meaningful coefficient comparison
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train_imp)
    X_test_scaled = scaler.transform(X_test_imp)

    # Fit Linear Regression
    model = LinearRegression()
    model.fit(X_train_scaled, y_train)

    # Predict
    y_pred_test = model.predict(X_test_scaled)

    # Statistical Evaluation Metrics on TEST split
    r2 = float(r2_score(y_test, y_pred_test))
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred_test)))
    mae = float(mean_absolute_error(y_test, y_pred_test))

    # Normalized Coefficients (importance ranking)
    coefficients = []
    raw_coefs = model.coef_ / scaler.scale_
    raw_intercept = float(model.intercept_ - np.sum(model.coef_ * scaler.mean_ / scaler.scale_))
    for name, coef, scaled_coef in zip(retained_features, raw_coefs, model.coef_):
        coefficients.append({
            "feature": name,
            "coefficient": round(float(coef), 4),
            "standardized_coefficient": round(float(scaled_coef), 4),
            "abs_impact": round(float(abs(scaled_coef)), 4),
            "direction": "Positive (+)" if coef >= 0 else "Negative (-)"
        })
    coefficients.sort(key=lambda x: x["abs_impact"], reverse=True)

    # Actual observed rows and the fitted one-feature line use the selected feature's
    # original units. Missing x/y values are omitted from the scatter, never coerced to zero.
    plot_points = []
    plot_feature = retained_features[0] if len(retained_features) == 1 else None
    if plot_feature:
        observed_x = X_final[plot_feature]
        valid_plot = observed_x.notna() & y.notna() & np.isfinite(observed_x.astype(float)) & np.isfinite(y.astype(float))
        plot_df = pd.DataFrame({"x": observed_x[valid_plot].astype(float), "y": y[valid_plot].astype(float)})
        plot_df = plot_df.reset_index(drop=True)
        stride = max(1, int(np.ceil(len(plot_df) / 300)))
        plot_points = [{"x": round(float(row.x), 5), "y": round(float(row.y), 5), "id": i + 1}
                       for i, row in plot_df.iloc[::stride].iterrows()]
        if len(plot_df):
            x_min, x_max = float(plot_df.x.min()), float(plot_df.x.max())
            fitted_line = [{"x": x_min, "y": round(raw_intercept + float(raw_coefs[0]) * x_min, 5)},
                           {"x": x_max, "y": round(raw_intercept + float(raw_coefs[0]) * x_max, 5)}]
        else:
            fitted_line = []
    else:
        fitted_line = []

    # Sample actual vs predicted points (up to 40 points)
    actual_vs_pred = []
    y_test_list = y_test.tolist()
    y_pred_list = y_pred_test.tolist()
    step = max(1, len(y_test_list) // 40)
    for i in range(0, len(y_test_list), step):
        act = float(y_test_list[i])
        prd = float(y_pred_list[i])
        actual_vs_pred.append({
            "index": i + 1,
            "actual": round(act, 2),
            "predicted": round(prd, 2),
            "residual": round(act - prd, 2)
        })

    # Residual Distribution
    residuals = y_test - y_pred_test
    hist, bin_edges = np.histogram(residuals, bins=10)
    residual_distribution = [
        {"bin": round(float(bin_edges[i]), 2), "count": int(hist[i])}
        for i in range(len(hist))
    ]

    exec_time = round((time.time() - start_time) * 1000, 1)

    return {
        "status": "COMPLETED",
        "r2_score": round(r2, 4),
        "rmse": round(rmse, 4),
        "mae": round(mae, 4),
        "target_variable": target_col,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "coefficients": coefficients,
        "intercept": round(raw_intercept, 4),
        "plot_feature": plot_feature,
        "plot_observations": plot_points,
        "fitted_line": fitted_line,
        "actual_vs_predicted": actual_vs_pred,
        "residuals_distribution": residual_distribution,
        "execution_time_ms": exec_time,
        "notes": leakage_warnings
    }

def run_decision_tree(
    df: pd.DataFrame,
    target_col: str,
    feature_cols: Optional[List[str]] = None,
    excluded_cols: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Executes DecisionTreeRegressor or DecisionTreeClassifier with feature importances
    and interpretable decision rules.
    """
    start_time = time.time()
    X, y, features = prepare_features_and_target(df, target_col, feature_cols, excluded_cols)
    
    # Numerical features
    X_encoded = encode_supervised_features(X)
    numeric_features = list(X_encoded.columns)
    if not numeric_features:
        raise ValueError("Decision Tree requires at least one usable numerical or categorical predictor feature.")

    valid_mask = y.notna()
    X_num = X_encoded[numeric_features].replace([np.inf, -np.inf], np.nan)[valid_mask]
    y_clean = y[valid_mask]

    # Determine whether task is Regression or Classification
    is_continuous = pd.api.types.is_numeric_dtype(y_clean) and y_clean.nunique() > 10
    task_type = "regression" if is_continuous else "classification"

    threshold_info = None
    if task_type == "classification" and pd.api.types.is_numeric_dtype(y_clean):
        # Continuous target explicitly converted to high vs low consumption
        median_val = float(y_clean.median())
        y_encoded = (y_clean > median_val).astype(int)
        threshold_info = {
            "strategy": "Median Split",
            "threshold_value": round(median_val, 2),
            "class_0_label": f"Low/Normal (<= {median_val:.1f})",
            "class_1_label": f"High (> {median_val:.1f})"
        }
    else:
        y_encoded = y_clean

    X_train, X_test, y_train, y_test = train_test_split(X_num, y_encoded, test_size=0.2, random_state=42)
    
    imputer = SimpleImputer(strategy='median')
    X_train_imp = imputer.fit_transform(X_train)
    X_test_imp = imputer.transform(X_test)

    metrics = {}
    if task_type == "regression":
        tree = DecisionTreeRegressor(max_depth=4, min_samples_leaf=3, random_state=42)
        tree.fit(X_train_imp, y_train)
        y_pred = tree.predict(X_test_imp)
        metrics["r2_score"] = round(float(r2_score(y_test, y_pred)), 4)
        metrics["rmse"] = round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4)
        metrics["mae"] = round(float(mean_absolute_error(y_test, y_pred)), 4)
    else:
        tree = DecisionTreeClassifier(max_depth=4, min_samples_leaf=3, random_state=42)
        tree.fit(X_train_imp, y_train)
        y_pred = tree.predict(X_test_imp)
        metrics["accuracy"] = round(float(accuracy_score(y_test, y_pred)), 4)
        metrics["f1_score"] = round(float(f1_score(y_test, y_pred, average='weighted')), 4)

    # Feature Importance (Mean Decrease in Impurity)
    importances = []
    for feat, imp in zip(numeric_features, tree.feature_importances_):
        importances.append({
            "feature": feat,
            "importance": round(float(imp), 4),
            "importance_pct": round(float(imp * 100), 2)
        })
    importances.sort(key=lambda x: x["importance"], reverse=True)

    # Export text rules
    rules_text = export_text(tree, feature_names=numeric_features, max_depth=3)
    rule_lines = [line for line in rules_text.split('\n') if line.strip()][:15]

    # Sample actual vs predicted
    test_paths = tree.decision_path(X_test_imp)
    tree_observations = []
    obs_step = max(1, int(np.ceil(len(X_test_imp) / 100)))
    for row_i in range(0, len(X_test_imp), obs_step):
        path = test_paths.indices[test_paths.indptr[row_i]:test_paths.indptr[row_i + 1]].astype(int).tolist()
        row_values = {name: round(float(value), 5) for name, value in zip(numeric_features, X_test_imp[row_i])}
        actual_value = y_test.iloc[row_i]
        predicted_value = y_pred[row_i]
        tree_observations.append({
            "id": int(X_test.index[row_i]) if isinstance(X_test.index[row_i], (int, np.integer)) else row_i + 1,
            "path_node_ids": path,
            "feature_values": row_values,
            "actual_value": round(float(actual_value), 5) if is_continuous else str(actual_value),
            "predicted_value": round(float(predicted_value), 5) if is_continuous else str(predicted_value),
        })

    sample_points = []
    y_test_l = y_test.tolist()
    y_pred_l = y_pred.tolist()
    step = max(1, len(y_test_l) // 30)
    for i in range(0, len(y_test_l), step):
        sample_points.append({
            "index": i + 1,
            "actual": round(float(y_test_l[i]), 2) if is_continuous else str(y_test_l[i]),
            "predicted": round(float(y_pred_l[i]), 2) if is_continuous else str(y_pred_l[i])
        })

    exec_time = round((time.time() - start_time) * 1000, 1)

    sklearn_tree = tree.tree_
    tree_nodes = []
    for node_id in range(sklearn_tree.node_count):
        left_id, right_id = int(sklearn_tree.children_left[node_id]), int(sklearn_tree.children_right[node_id])
        is_leaf = left_id == right_id
        raw_value = sklearn_tree.value[node_id][0]
        if task_type == "classification":
            class_counts = np.rint(raw_value * sklearn_tree.n_node_samples[node_id]).astype(int).tolist()
            predicted_value = str(tree.classes_[int(np.argmax(raw_value))])
        else:
            class_counts, predicted_value = [], round(float(raw_value[0]), 4)
        parent_id = next((p for p in range(sklearn_tree.node_count)
                          if sklearn_tree.children_left[p] == node_id or sklearn_tree.children_right[p] == node_id), None)
        tree_nodes.append({
            "id": node_id, "parent_id": parent_id,
            "left_child_id": None if is_leaf else left_id,
            "right_child_id": None if is_leaf else right_id,
            "depth": 0,
            "feature": None if is_leaf else numeric_features[int(sklearn_tree.feature[node_id])],
            "threshold": None if is_leaf else round(float(sklearn_tree.threshold[node_id]), 4),
            "sample_count": int(sklearn_tree.n_node_samples[node_id]),
            "impurity": round(float(sklearn_tree.impurity[node_id]), 5),
            "predicted_value": predicted_value, "class_distribution": class_counts, "is_leaf": is_leaf,
        })
    node_by_id = {n["id"]: n for n in tree_nodes}
    for node in tree_nodes:
        node["depth"] = 0 if node["parent_id"] is None else node_by_id[node["parent_id"]]["depth"] + 1

    return {
        "status": "COMPLETED",
        "task_type": task_type,
        "target_variable": target_col,
        "metrics": metrics,
        "feature_importances": importances,
        "tree_rules": rule_lines,
        "tree_nodes": tree_nodes,
        "tree_observations": tree_observations,
        "actual_vs_predicted": sample_points,
        "classification_threshold_info": threshold_info,
        "execution_time_ms": exec_time,
        "notes": [f"Trained depth-limited {task_type} tree to prevent leaf memorization."]
    }

def run_kmeans_clustering(
    df: pd.DataFrame,
    feature_cols: Optional[List[str]] = None,
    excluded_cols: Optional[List[str]] = None,
    k_range: Tuple[int, int] = (2, 6),
    n_clusters: Optional[int] = None
) -> Dict[str, Any]:
    """
    Executes K-Means with Elbow Curve, Silhouette evaluation,
    unscaled centroid profiling, and 2D cluster projection.
    """
    start_time = time.time()
    excluded = set(excluded_cols or [])
    
    if feature_cols:
        features = [c for c in feature_cols if c in df.columns and c not in excluded]
    else:
        features = [c for c in df.columns if c not in excluded]

    numeric_features = [c for c in features if pd.api.types.is_numeric_dtype(df[c]) and df[c].nunique() > 1]
    if len(numeric_features) < 2:
        raise ValueError("K-Means requires at least 2 variable numerical features.")

    X_raw = df[numeric_features].replace([np.inf, -np.inf], np.nan).copy()
    
    # Impute missing values
    imputer = SimpleImputer(strategy='median')
    X_imp = imputer.fit_transform(X_raw)

    # Standardize features for Euclidean distance calculations
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_imp)

    # Elbow method and Silhouette score
    max_k = min(k_range[1], len(df) - 1, 6)
    min_k = max(2, k_range[0])
    if max_k < min_k:
        raise ValueError("K-Means needs at least three observations to evaluate two or more clusters.")
    if n_clusters is not None and not min_k <= n_clusters <= max_k:
        raise ValueError(f"Selected cluster count must be between {min_k} and {max_k} for this dataset.")
    
    elbow_curve = []
    silhouette_scores = {}
    
    for k in range(min_k, max_k + 1):
        km_test = KMeans(n_clusters=k, random_state=42, n_init=10)
        km_test.fit(X_scaled)
        inertia = float(km_test.inertia_)
        n_labels = len(np.unique(km_test.labels_))
        sil = float(silhouette_score(X_scaled, km_test.labels_)) if 1 < n_labels < len(df) else float("nan")
        elbow_curve.append({
            "k": k,
            "inertia": round(inertia, 2),
            "silhouette": round(sil, 4) if np.isfinite(sil) else None
        })
        if np.isfinite(sil): silhouette_scores[k] = sil

    # Pick optimal k based on highest silhouette score
    optimal_k = n_clusters if n_clusters is not None else max(silhouette_scores, key=silhouette_scores.get) if silhouette_scores else min_k

    # Final fit with optimal k
    kmeans = KMeans(n_clusters=optimal_k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X_scaled)

    # Unscale cluster centroids back to original physical engineering units
    unscaled_centroids = scaler.inverse_transform(kmeans.cluster_centers_)

    cluster_profiles = []
    total_samples = len(df)
    for c_id in range(optimal_k):
        c_count = int(np.sum(labels == c_id))
        c_pct = round((c_count / total_samples) * 100, 1)
        
        centroid_dict = {}
        for feat_idx, feat_name in enumerate(numeric_features):
            centroid_dict[feat_name] = round(float(unscaled_centroids[c_id, feat_idx]), 2)

        # Build an objective description based strictly on the unscaled centroid values
        top_characteristics = []
        for feat_name, val in centroid_dict.items():
            overall_mean = X_raw[feat_name].mean()
            if val > overall_mean * 1.25:
                top_characteristics.append(f"High {feat_name} ({val})")
            elif val < overall_mean * 0.75:
                top_characteristics.append(f"Low {feat_name} ({val})")

        objective_summary = f"Cluster {c_id + 1}: " + (", ".join(top_characteristics) if top_characteristics else "Moderate baseline across all features")

        cluster_profiles.append({
            "cluster_id": c_id + 1,
            "sample_count": c_count,
            "sample_percentage": c_pct,
            "centroids": centroid_dict,
            "objective_description": objective_summary
        })

    # Project actual fitted assignments and centroids into the same PCA plane.
    pca_2d = PCA(n_components=2, random_state=42)
    coords_2d = pca_2d.fit_transform(X_scaled)

    scatter_points = []
    step = max(1, len(coords_2d) // 100)
    for i in range(0, len(coords_2d), step):
        scatter_points.append({
            "x": round(float(coords_2d[i, 0]), 2),
            "y": round(float(coords_2d[i, 1]), 2),
            "cluster": int(labels[i]) + 1
        })

    centroids_2d = pca_2d.transform(kmeans.cluster_centers_)
    centroid_points_2d = [{"x": round(float(point[0]), 4), "y": round(float(point[1]), 4), "cluster": idx + 1}
                          for idx, point in enumerate(centroids_2d)]

    exec_time = round((time.time() - start_time) * 1000, 1)

    return {
        "status": "COMPLETED",
        "optimal_k": optimal_k,
        "silhouette_score": round(silhouette_scores[optimal_k], 4) if optimal_k in silhouette_scores else None,
        "silhouette_unavailable_reason": None if optimal_k in silhouette_scores else "The fitted labels did not form two or more non-empty clusters, so silhouette is undefined.",
        "features_used": numeric_features,
        "elbow_curve": elbow_curve,
        "cluster_profiles": cluster_profiles,
        "cluster_scatter_points": scatter_points,
        "cluster_centroids_2d": centroid_points_2d,
        "execution_time_ms": exec_time,
        "notes": [f"Used selected k={optimal_k}. Silhouette was evaluated when mathematically valid." if n_clusters is not None else f"Selected k={optimal_k} maximizing silhouette coefficient across candidate clusters."]
    }

def run_pca_decomposition(
    df: pd.DataFrame,
    feature_cols: Optional[List[str]] = None,
    excluded_cols: Optional[List[str]] = None,
    n_components: Optional[int] = None
) -> Dict[str, Any]:
    """
    Executes PCA with standardization, explained variance ratio,
    factor loadings matrix, and biplot/scatter coordinates.
    """
    start_time = time.time()
    excluded = set(excluded_cols or [])
    
    if feature_cols:
        features = [c for c in feature_cols if c in df.columns and c not in excluded]
    else:
        features = [c for c in df.columns if c not in excluded]

    # CSV ingestion can leave numeric measurements as object columns. Parse valid
    # numerals, while excluding identifiers, dates, categories, and constants.
    candidates = [c for c in features if not any(token in str(c).lower() for token in ("date", "time", "timestamp", "_id", "identifier"))]
    converted = pd.DataFrame({c: pd.to_numeric(df[c], errors="coerce") for c in candidates}, index=df.index)
    exclusions = {}
    numeric_features = []
    for col in candidates:
        finite = converted[col].replace([np.inf, -np.inf], np.nan).dropna()
        if not len(finite):
            exclusions[col] = "No parseable finite numeric values."
        elif finite.nunique() < 2:
            exclusions[col] = "Constant after numeric conversion."
        else:
            numeric_features.append(col)
    if len(numeric_features) < 2:
        detected = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
        details = "; ".join(f"{name}: {reason}" for name, reason in exclusions.items()) or "No additional columns were eligible."
        raise ValueError(f"PCA needs at least 2 variable numeric measurements. Detected {len(detected)} numeric-typed columns; {len(candidates)} candidate columns checked; {len(numeric_features)} eligible. Excluded: {details} Select numeric measurement columns, remove identifiers/categories, or correct decimal formatting.")

    X_raw = converted[numeric_features].replace([np.inf, -np.inf], np.nan).copy()
    
    imputer = SimpleImputer(strategy='median')
    X_imp = imputer.fit_transform(X_raw)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_imp)

    n_comp = min(len(numeric_features), 4, len(df))
    if n_components:
        n_comp = min(n_components, len(numeric_features), len(df))

    pca = PCA(n_components=n_comp, random_state=42)
    X_projected = pca.fit_transform(X_scaled)

    exp_var = [round(float(v), 4) for v in pca.explained_variance_ratio_]
    cum_var = [round(float(v), 4) for v in np.cumsum(pca.explained_variance_ratio_)]

    # Loadings (eigenvectors * sqrt(eigenvalues))
    loadings = []
    for feat_idx, feat_name in enumerate(numeric_features):
        row = {"feature": feat_name}
        for c_idx in range(n_comp):
            val = pca.components_[c_idx, feat_idx]
            row[f"PC{c_idx + 1}"] = round(float(val), 4)
        loadings.append(row)

    # 2D projection points are available only when the data supports two components.
    scatter_points = []
    projected_stride = max(1, int(np.ceil(len(X_projected) / 500)))
    for i in range(0, len(X_projected), projected_stride):
        point = {"pc1": round(float(X_projected[i, 0]), 4), "id": i + 1}
        if n_comp > 1: point["pc2"] = round(float(X_projected[i, 1]), 4)
        if n_comp > 2: point["pc3"] = round(float(X_projected[i, 2]), 4)
        scatter_points.append(point)

    # Detailed notes explaining dominant components
    pc1_top = max(loadings, key=lambda x: abs(x.get("PC1", 0)))
    notes = [
        f"PC1 accounts for {round(exp_var[0]*100, 1)}% of total system variance, dominated by '{pc1_top['feature']}'."
    ]
    if n_comp > 1:
        pc2_top = max(loadings, key=lambda x: abs(x.get("PC2", 0)))
        notes.append(f"PC2 explains {round(exp_var[1]*100, 1)}% of variance, primarily aligned with '{pc2_top['feature']}'.")

    exec_time = round((time.time() - start_time) * 1000, 1)

    return {
        "status": "COMPLETED",
        "n_components": n_comp,
        "features_used": numeric_features,
        "feature_exclusions": exclusions,
        "explained_variance_ratio": exp_var,
        "cumulative_explained_variance": cum_var,
        "loadings": loadings,
        "scatter_points": scatter_points,
        "projection_unavailable_reason": None if n_comp >= 2 else "At least two usable numeric features and two independent components are required for a 2D projection.",
        "execution_time_ms": exec_time,
        "notes": notes
    }
