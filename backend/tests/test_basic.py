import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path
import pandas as pd
import numpy as np
from io import StringIO

# Add root directory to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.main import app
from backend.app.ml_engine.executor import run_linear_regression, run_decision_tree, run_kmeans_clustering, run_pca_decomposition
from backend.app.ai_engine.interpreter import generate_local_heuristic_insights
from backend.app.data_engine.profiler import infer_column_type, profile_dataset

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "app_name" in data

def test_load_gujarat_sample_dataset():
    response = client.post("/api/datasets/load-sample/gujarat")
    assert response.status_code == 200
    data = response.json()
    assert data["row_count"] > 100
    assert data["data_quality_score"] > 80
    assert len(data["columns"]) >= 10

def test_load_himalayan_sample_dataset():
    response = client.post("/api/datasets/load-sample/himalayan")
    assert response.status_code == 200
    data = response.json()
    assert data["row_count"] > 100
    assert any("heating" in c["name"] or "wing" in c["name"] for c in data["columns"])

def test_educational_catalog():
    response = client.get("/api/educational/catalog")
    assert response.status_code == 200
    catalog = response.json()
    assert "linear_regression" in catalog
    assert "decision_tree" in catalog
    assert "kmeans" in catalog
    assert "pca" in catalog
    assert len(catalog["linear_regression"]) == 2
    assert len(catalog["decision_tree"]) == 2
    assert len(catalog["kmeans"]) == 2
    assert len(catalog["pca"]) == 2
    assert [item["id"] for item in catalog["linear_regression"]] == [item["id"] for item in catalog["pca"]]

def test_load_and_run_single_educational():
    # Load a shared hostel dataset; the same data can be used by all four workspaces.
    load_res = client.post("/api/educational/load/linear_regression/sample_gujarat")
    assert load_res.status_code == 200
    data = load_res.json()
    assert data["row_count"] == 540
    ds_id = data["dataset_id"]
    prior_runs = sum(run["dataset_id"] == ds_id for run in client.get("/api/analyses").json())

    # Run single algorithm
    run_res = client.post(f"/api/ml/train-single/{ds_id}/linear_regression?target_column=total_energy_kwh&feature_column=temperature_c")
    assert run_res.status_code == 200
    result_data = run_res.json()
    assert result_data["algorithm"] == "linear_regression"
    assert "r2_score" in result_data["result"]
    assert result_data["result"]["plot_feature"] == "temperature_c"
    assert len(result_data["result"]["fitted_line"]) == 2
    assert result_data["result"]["plot_observations"]
    assert "ai_companion" in result_data
    assert sum(run["dataset_id"] == ds_id for run in client.get("/api/analyses").json()) == prior_runs

def test_kmeans_uses_selected_cluster_count():
    loaded = client.post("/api/datasets/load-sample/gujarat").json()
    dataset_id = loaded["dataset_id"]
    response = client.post(f"/api/ml/train-single/{dataset_id}/kmeans?n_clusters=4")
    assert response.status_code == 200
    assert response.json()["result"]["optimal_k"] == 4
    invalid = client.post(f"/api/ml/train-single/{dataset_id}/kmeans?n_clusters=99")
    assert invalid.status_code == 400

def test_shared_demo_runs_all_four_algorithms_on_one_dataset():
    profile = client.post("/api/educational/load/pca/sample_gujarat").json()
    dataset_id = profile["dataset_id"]
    common = f"/api/ml/train-single/{dataset_id}"
    responses = [
        client.post(f"{common}/linear_regression?target_column=total_energy_kwh&feature_column=temperature_c"),
        client.post(f"{common}/decision_tree?target_column=total_energy_kwh"),
        client.post(f"{common}/kmeans?n_clusters=3"),
        client.post(f"{common}/pca"),
    ]
    assert [response.status_code for response in responses] == [200, 200, 200, 200]
    assert [response.json()["dataset_id"] for response in responses] == [dataset_id] * 4
    assert responses[2].json()["result"]["optimal_k"] == 3
    assert responses[3].json()["result"]["scatter_points"]

def test_workspace_consolidation_preserves_exact_runs_and_individual_configurations(monkeypatch):
    dataset_id = client.post("/api/educational/load/pca/sample_gujarat").json()["dataset_id"]
    base = f"/api/ml/train-single/{dataset_id}"
    runs = {
        "linear_regression": client.post(f"{base}/linear_regression?target_column=total_energy_kwh&feature_column=temperature_c").json(),
        "decision_tree": client.post(f"{base}/decision_tree?target_column=grid_import_kwh").json(),
        "kmeans": client.post(f"{base}/kmeans?n_clusters=4").json(),
        "pca": client.post(f"{base}/pca?feature_columns=temperature_c,humidity,occupancy").json(),
    }
    assert all(run.get("experiment_id") and run.get("dataset_version") for run in runs.values())
    from backend.app.api import endpoints
    ai_received = {}
    def capture_verified_payload(payload):
        ai_received.update(payload)
        return generate_local_heuristic_insights(payload, reason="Test evidence interpreter")
    monkeypatch.setattr(endpoints, "interpret_analysis_with_gemini", capture_verified_payload)
    prior_analysis_count = sum(item["dataset_id"] == dataset_id for item in client.get("/api/analyses").json())
    response = client.post(f"/api/datasets/{dataset_id}/consolidate-workspaces", json={"experiments": runs})
    assert response.status_code == 200, response.text
    report = response.json()["report"]
    assert report["linear_regression"] == runs["linear_regression"]["result"]
    assert report["decision_tree"] == runs["decision_tree"]["result"]
    assert report["kmeans"] == runs["kmeans"]["result"]
    assert report["pca"] == runs["pca"]["result"]
    assert report["target_variables"]["linear_regression"] == "total_energy_kwh"
    assert report["target_variables"]["decision_tree"] == "grid_import_kwh"
    assert report["linear_regression"]["provenance"]["predictor_variables"] == ["temperature_c"]
    assert report["kmeans"]["optimal_k"] == 4
    assert report["pca"]["provenance"]["model_parameters"]["selected_features"] == ["temperature_c", "humidity", "occupancy"]
    assert report["status"] == "COMPLETED"
    assert ai_received["verified_workspace_results"] is True
    for name, run in runs.items():
        assert ai_received[name] == run["result"]
    assert sum(item["dataset_id"] == dataset_id for item in client.get("/api/analyses").json()) == prior_analysis_count

def test_workspace_consolidation_marks_missing_methods_incomplete():
    dataset_id = client.post("/api/educational/load/pca/sample_gujarat").json()["dataset_id"]
    run = client.post(f"/api/ml/train-single/{dataset_id}/kmeans?n_clusters=3").json()
    response = client.post(f"/api/datasets/{dataset_id}/consolidate-workspaces", json={
        "experiments": {"kmeans": run},
        "attempt_statuses": {"linear_regression": "incomplete"},
    })
    assert response.status_code == 200, response.text
    report = response.json()["report"]
    assert report["status"] == "INCOMPLETE"
    assert report["kmeans"] == run["result"]
    assert report["linear_regression"] is None
    assert "linear_regression" in report["skipped_models"]
    assert report["experiment_statuses"]["linear_regression"] == "incomplete"
    assert report["experiment_statuses"]["decision_tree"] == "not_yet_executed"
    assert response.json()["insights"]["completion_status"]["incomplete"] == ["Linear Regression"]

def test_workspace_consolidation_rejects_dataset_version_mismatch():
    dataset_id = client.post("/api/educational/load/pca/sample_gujarat").json()["dataset_id"]
    run = client.post(f"/api/ml/train-single/{dataset_id}/kmeans?n_clusters=3").json()
    run["dataset_version"] = "different-version"
    response = client.post(f"/api/datasets/{dataset_id}/consolidate-workspaces", json={"experiments": {"kmeans": run}})
    assert response.status_code == 409
    assert "dataset identity, version, or run metadata" in response.json()["detail"]

def test_readiness_assessment():
    client.post("/api/datasets/load-sample/gujarat")
    datasets = client.get("/api/datasets").json()
    assert len(datasets) > 0
    ds_id = datasets[0]["id"]
    
    readiness_res = client.post(f"/api/datasets/{ds_id}/readiness")
    assert readiness_res.status_code == 200
    r_data = readiness_res.json()
    assert "linear_regression" in r_data["models"]
    assert "decision_tree" in r_data["models"]
    assert "kmeans" in r_data["models"]
    assert "pca" in r_data["models"]

def test_run_analysis_and_insights():
    client.post("/api/datasets/load-sample/gujarat")
    datasets = client.get("/api/datasets").json()
    ds_id = datasets[0]["id"]

    analysis_res = client.post(f"/api/datasets/{ds_id}/analyse")
    assert analysis_res.status_code == 200
    analysis = analysis_res.json()
    assert analysis["status"] == "COMPLETED"
    assert "kmeans" in analysis
    assert "pca" in analysis
    assert analysis["dataset_assessment"]["source_type"] == "synthetic_or_sample_demonstration"
    assert analysis["dataset_assessment"]["target_summary"] is not None

    insights_res = client.get(f"/api/analyses/{analysis['analysis_id']}/insights")
    assert insights_res.status_code == 200
    insights = insights_res.json()
    assert len(insights["executive_summary"]) > 20
    assert len(insights["practical_recommendations"]) > 0

def test_actual_model_graph_payloads_have_hierarchy_and_centroids():
    rng = np.random.default_rng(20)
    tree_df = pd.DataFrame({
        "ambient_temp_c": np.tile(np.linspace(18, 38, 60), 2),
        "occupancy_ratio": rng.uniform(0.2, 1.0, 120),
        "consumption_regime": np.repeat(["low", "high"], 60),
    })
    tree = run_decision_tree(tree_df, "consumption_regime", ["ambient_temp_c", "occupancy_ratio"])
    nodes = tree["tree_nodes"]
    node_ids = {node["id"] for node in nodes}
    assert nodes[0]["parent_id"] is None
    assert all(node["parent_id"] is None or node["parent_id"] in node_ids for node in nodes)
    assert all(node["is_leaf"] or (node["left_child_id"] in node_ids and node["right_child_id"] in node_ids) for node in nodes)
    assert tree["tree_observations"]
    assert all(set(row["path_node_ids"]).issubset(node_ids) for row in tree["tree_observations"])

    cluster_df = pd.DataFrame(np.vstack([
        rng.normal([0, 0], 0.25, size=(40, 2)),
        rng.normal([4, 4], 0.25, size=(40, 2)),
        rng.normal([8, 0], 0.25, size=(40, 2)),
    ]), columns=["meter_a", "meter_b"])
    clusters = run_kmeans_clustering(cluster_df)
    assert len(clusters["cluster_centroids_2d"]) == clusters["optimal_k"]
    assert clusters["cluster_scatter_points"]

    load = rng.normal(100, 20, size=100)
    pca_df = pd.DataFrame({"meter_a": load, "meter_b": load * 0.7 + rng.normal(0, 1, 100), "meter_c": load * 0.3 + rng.normal(0, 1, 100)})
    pca = run_pca_decomposition(pca_df)
    assert pca["scatter_points"]
    if pca["n_components"] > 2:
        assert all("pc3" in point for point in pca["scatter_points"])

def test_local_assessment_fallback_does_not_invent_savings_or_inefficiencies():
    result = generate_local_heuristic_insights({
        "dataset_summary": {"original_name": "checked.csv", "row_count": 80, "col_count": 3},
        "linear_regression": {"status": "COMPLETED", "target_variable": "energy_kwh", "r2_score": 0.2, "rmse": 3.1, "mae": 2.2, "test_size": 16, "coefficients": [{"feature": "occupancy", "coefficient": 0.3, "standardized_coefficient": 0.1, "direction": "Positive (+)"}]},
        "decision_tree": None, "kmeans": None, "pca": None, "skipped_models": {"decision_tree": "insufficient rows"},
        "data_improvement_advice": []
    })
    assert result["potential_inefficiencies"] == []
    assert all("expected_savings" not in rec for rec in result["practical_recommendations"])
    assert all("no savings estimate" in rec["evidence_basis"].lower() for rec in result["practical_recommendations"])
    assert not any(rec["action"].lower().endswith("not estimated from these analyses") for rec in result["practical_recommendations"])
    assert result["completion_status"] == {
        "completed": ["Linear Regression"], "incomplete": [],
        "not_yet_executed": ["Decision Tree", "K-Means", "PCA"],
    }
    assert "Not run: none reported" not in result["executive_summary"]
    assert result["is_ai_generated"] is False

def test_interpreter_formats_tree_metrics_and_deduplicates_dataset_findings():
    duplicate = {"kind": "observed_association", "column": "energy_kwh", "feature": "temperature_c",
                 "correlation": 0.4, "count": 20, "limitation": "Correlation does not establish causation."}
    result = generate_local_heuristic_insights({
        "dataset_summary": {"original_name": "checked.csv", "row_count": 80, "col_count": 3},
        "direct_observations": [duplicate, duplicate],
        "linear_regression": None,
        "decision_tree": {"status": "COMPLETED", "metrics": {"accuracy": 0.9, "f1_score": 0.8},
                          "tree_nodes": [{"id": 0, "parent_id": None, "is_leaf": False, "feature": "temperature_c",
                                          "threshold": 27.5, "sample_count": 64}], "feature_importances": []},
        "kmeans": None, "pca": None, "skipped_models": {}, "data_improvement_advice": []
    })
    tree_finding = next(item["finding"] for item in result["major_discoveries"] if item["topic"] == "Decision tree's first split")
    assert "accuracy: 0.9" in tree_finding and "f1 score: 0.8" in tree_finding
    assert "{'accuracy'" not in tree_finding
    assert len([item for item in result["major_discoveries"] if item["topic"] == "Observed association with temperature_c"]) == 1
    assert all(not item["topic"].upper().endswith("LOW") for item in result["major_discoveries"])

def test_interpreter_distinguishes_incomplete_attempt_from_not_yet_executed():
    result = generate_local_heuristic_insights({
        "dataset_summary": {"original_name": "checked.csv", "row_count": 20, "col_count": 2},
        "linear_regression": {"status": "COMPLETED"}, "decision_tree": None, "kmeans": None, "pca": None,
        "experiment_statuses": {"linear_regression": "completed", "decision_tree": "incomplete",
                              "kmeans": "not_yet_executed", "pca": "not_yet_executed"},
        "skipped_models": {"decision_tree": "The latest workspace attempt failed."},
    })
    assert result["completion_status"] == {
        "completed": ["Linear Regression"], "incomplete": ["Decision Tree"],
        "not_yet_executed": ["K-Means", "PCA"],
    }
    assert "Incomplete experiments: Decision Tree" in result["executive_summary"]
    assert "Not yet executed: K-Means, PCA" in result["executive_summary"]

def test_executive_summary_synthesizes_each_completed_algorithm():
    result = generate_local_heuristic_insights({
        "dataset_summary": {"original_name": "dummy.csv", "row_count": 100, "col_count": 10},
        "linear_regression": {"status": "COMPLETED", "target_variable": "energy_kwh", "r2_score": 0.7,
                              "rmse": 3.0, "test_size": 20, "coefficients": [{"feature": "temperature_c", "coefficient": 1.2, "standardized_coefficient": 0.6}]},
        "decision_tree": {"status": "COMPLETED", "target_variable": "energy_kwh", "metrics": {"r2_score": 0.6, "rmse": 3.2},
                          "tree_nodes": [{"id": 0, "parent_id": None, "is_leaf": False, "feature": "occupancy", "threshold": 0.5, "sample_count": 80}], "feature_importances": []},
        "kmeans": {"status": "COMPLETED", "optimal_k": 3, "silhouette_score": 0.4, "features_used": ["temperature_c"], "cluster_profiles": []},
        "pca": {"status": "COMPLETED", "explained_variance_ratio": [0.6, 0.2], "cumulative_explained_variance": [0.6, 0.8], "features_used": ["temperature_c", "occupancy"], "loadings": []},
        "skipped_models": {},
    })
    summary = result["executive_summary"]
    for method in ("Linear Regression", "Decision Tree", "K-Means", "PCA"):
        assert method in summary
    assert result["completion_status"]["completed"] == ["Linear Regression", "Decision Tree", "K-Means", "PCA"]

def test_final_report_quality_uses_exact_features_and_four_method_metrics():
    from backend.app.ai_engine.interpreter import _clean_finding_title, generate_local_heuristic_insights
    assert _clean_finding_title("Regression identified a fitted associationLow impact") == "Regression identified a fitted association"
    assert _clean_finding_title("Tree pattern — MEDIUM IMPACT") == "Tree pattern"
    approved = [
        "occupied_residents", "average_temperature_c", "fan_operating_hours_per_day",
        "lighting_operating_hours_per_day", "study_plug_hours_per_resident", "weekend",
        "monsoon_season_flag", "maintenance_activity_flag", "hostel_block",
    ]
    result = generate_local_heuristic_insights({
        "dataset_summary": {"original_name": "DUMMY_UNI_DATASET.csv", "row_count": 1464, "col_count": 21},
        "linear_regression": {"status": "COMPLETED", "target_variable": "total_electricity_consumption_kwh",
                              "r2_score": .8831, "rmse": 10.0784, "test_size": 293,
                              "coefficients": [{"feature": "average_temperature_c", "coefficient": 1.2, "standardized_coefficient": .6},
                                               {"feature": "fan_operating_hours_per_day", "coefficient": .8, "standardized_coefficient": .4}],
                              "provenance": {"predictor_variables": approved}},
        "decision_tree": {"status": "COMPLETED", "target_variable": "total_electricity_consumption_kwh",
                          "metrics": {"r2_score": .7638, "rmse": 14.32, "mae": 11.52},
                          "tree_nodes": [{"id": 0, "parent_id": None, "is_leaf": False, "feature": "fan_operating_hours_per_day", "threshold": 6.5, "sample_count": 1171}],
                          "feature_importances": [{"feature": "fan_operating_hours_per_day", "importance": .4},
                                                   {"feature": "hostel_block_category:Block A", "importance": .3}],
                          "provenance": {"predictor_variables": approved}},
        "kmeans": {"status": "COMPLETED", "optimal_k": 3, "silhouette_score": .2049, "cluster_profiles": []},
        "pca": {"status": "COMPLETED", "explained_variance_ratio": [.3044, .2345],
                "cumulative_explained_variance": [.3044, .5389],
                "features_used": ["grid_import_kwh", "solar_generation_kwh", "average_temperature_c"], "loadings": []},
        "skipped_models": {},
    })
    summary = result["executive_summary"]
    for phrase in ("Linear Regression", "R² was 0.8831", "RMSE was 10.0784", "Decision Tree",
                   "R² was 0.7638", "RMSE was 14.3200", "MAE was 11.5200", "K-Means",
                   "3 clusters", "weak separation", "PCA", "PC1 30.44%", "first two PCs 53.89%",
                   "does not predict consumption", "strongest held-out R²"):
        assert phrase in summary
    cross = result["cross_model_insights"]
    assert "average_temperature_c" in cross
    assert "fan_operating_hours_per_day" in cross
    assert "average, fan, occupied" not in cross
    assert "grid_import_kwh, solar_generation_kwh, average_temperature_c" in cross
    reg_finding = next(item for item in result["major_discoveries"] if item["topic"].startswith("Linear Regression"))
    assert reg_finding["topic"] == "Linear Regression predictive association"
    assert reg_finding["impact"] == "LOW"
    assert "Low impact" not in reg_finding["topic"]

def test_workspace_companion_keeps_dataset_observations_out_of_method_interpretation(monkeypatch):
    dataset_id = client.post("/api/educational/load/linear_regression/sample_gujarat").json()["dataset_id"]
    from backend.app.api import endpoints
    captured = {}
    def capture_payload(payload):
        captured.update(payload)
        return generate_local_heuristic_insights(payload)
    monkeypatch.setattr(endpoints, "interpret_analysis_with_gemini", capture_payload)
    response = client.post(f"/api/ml/train-single/{dataset_id}/linear_regression?target_column=total_energy_kwh&feature_column=temperature_c")
    assert response.status_code == 200, response.text
    assert captured["direct_observations"] == []
    assert captured["linear_regression"] == response.json()["result"]
    assert captured["decision_tree"] is None and captured["kmeans"] is None and captured["pca"] is None
    assert captured["experiment_statuses"] == {
        "linear_regression": "completed", "decision_tree": "not_yet_executed",
        "kmeans": "not_yet_executed", "pca": "not_yet_executed",
    }
    assert "Not yet executed: Decision Tree, K-Means, PCA" in response.json()["ai_companion"]["executive_summary"]

def test_dummy_dataset_runs_both_supervised_models_with_approved_target_and_nine_predictors():
    csv_path = ROOT_DIR / "backend" / "storage" / "uploads" / "10395898_DUMMY_UNI_DATASET.csv"
    contents = csv_path.read_bytes()
    uploaded = client.post("/api/datasets/upload", files={"file": ("DUMMY_UNI_DATASET.csv", contents, "text/csv")})
    assert uploaded.status_code == 200, uploaded.text
    profile = uploaded.json()
    dataset_id = profile["dataset_id"]
    target = "total_electricity_consumption_kwh"
    predictors = [
        "occupied_residents", "average_temperature_c", "fan_operating_hours_per_day",
        "lighting_operating_hours_per_day", "study_plug_hours_per_resident", "weekend",
        "monsoon_season_flag", "maintenance_activity_flag", "hostel_block",
    ]
    excluded = {target, "grid_import_kwh", "grid_export_kwh", "solar_generation_kwh", "solar_self_consumption_kwh"}
    configs = [{
        "name": column["name"], "is_target": column["name"] == target,
        "is_feature": column["name"] in predictors,
        "is_excluded": column["name"] in excluded - {target} or column.get("is_excluded", False),
    } for column in profile["columns"]]
    configured = client.post(f"/api/datasets/{dataset_id}/configure", json={
        "target_column": target, "column_configs": configs,
    })
    assert configured.status_code == 200, configured.text
    configured_profile = client.get(f"/api/datasets/{dataset_id}/profile").json()
    assert next(column["name"] for column in configured_profile["columns"] if column["is_target"]) == target

    stale_target = client.post(f"/api/ml/train-single/{dataset_id}/linear_regression?target_column=solar_irradiance_kwh_m2_day&feature_columns={','.join(predictors)}")
    assert stale_target.status_code == 422 and "supervised target must be" in stale_target.json()["detail"]
    query_features = ",".join(predictors)
    lr_response = client.post(f"/api/ml/train-single/{dataset_id}/linear_regression?target_column={target}&feature_columns={query_features}")
    dt_response = client.post(f"/api/ml/train-single/{dataset_id}/decision_tree?target_column={target}&feature_columns={query_features}")
    assert lr_response.status_code == 200, lr_response.text
    assert dt_response.status_code == 200, dt_response.text
    lr_run, dt_run = lr_response.json(), dt_response.json()

    for run in (lr_run, dt_run):
        assert run["target_column"] == target
        assert run["result"]["target_variable"] == target
        assert run["result"]["provenance"]["target_variable"] == target
        assert run["result"]["provenance"]["predictor_variables"] == predictors
        assert excluded.issubset(set(run["result"]["provenance"]["excluded_variables"]))

    source_frame = pd.read_csv(csv_path)
    expected = run_linear_regression(source_frame, target, predictors)
    for metric in ("r2_score", "rmse", "mae"):
        assert lr_run["result"][metric] == expected[metric]
    expected_tree_frame = source_frame.copy()
    expected_tree_frame["hostel_block"] = "category:" + expected_tree_frame["hostel_block"].astype("string").fillna("__MISSING__")
    expected_tree = run_decision_tree(expected_tree_frame, target, predictors)
    assert dt_run["result"]["metrics"] == expected_tree["metrics"]
    assert dt_run["result"]["feature_importances"] == expected_tree["feature_importances"]
    assert dt_run["result"]["tree_nodes"][0] == expected_tree["tree_nodes"][0]
    importance_features = {row["feature"] for row in dt_run["result"]["feature_importances"]}
    # The nine original predictors include categorical hostel_block, which is
    # expanded into three one-hot columns for the fitted sklearn tree.
    assert len(importance_features) == 11
    assert sum(feature.startswith("hostel_block_") for feature in importance_features) == 3
    assert all(feature in predictors[:8] or feature.startswith("hostel_block_") for feature in importance_features)
    assert dt_run["result"]["tree_nodes"][0]["feature"] in predictors or dt_run["result"]["tree_nodes"][0]["feature"].startswith("hostel_block_")

    report_response = client.post(f"/api/datasets/{dataset_id}/consolidate-workspaces", json={
        "experiments": {"linear_regression": lr_run, "decision_tree": dt_run},
    })
    assert report_response.status_code == 200, report_response.text
    report = report_response.json()["report"]
    assert report["linear_regression"] == lr_run["result"]
    assert report["target_variables"]["linear_regression"] == target
    assert report["decision_tree"] == dt_run["result"]
    assert report["target_variables"]["decision_tree"] == target
    assert report["model_provenance"]["linear_regression"]["predictor_variables"] == predictors
    assert report["model_provenance"]["decision_tree"]["predictor_variables"] == predictors

def test_supervised_execution_rejects_missing_or_nonexistent_target_instead_of_falling_back():
    csv_path = ROOT_DIR / "backend" / "storage" / "uploads" / "10395898_DUMMY_UNI_DATASET.csv"
    uploaded = client.post("/api/datasets/upload", files={"file": ("DUMMY_UNI_DATASET.csv", csv_path.read_bytes(), "text/csv")})
    assert uploaded.status_code == 200
    dataset_id = uploaded.json()["dataset_id"]
    missing = client.post(f"/api/ml/train-single/{dataset_id}/linear_regression?feature_column=average_temperature_c")
    unknown = client.post(f"/api/ml/train-single/{dataset_id}/linear_regression?target_column=not_a_column&feature_column=average_temperature_c")
    assert missing.status_code == 422 and "explicitly selected target_column" in missing.json()["detail"]
    assert unknown.status_code == 422 and "does not exist" in unknown.json()["detail"]

def test_dummy_supervised_models_reject_target_and_energy_accounting_predictors():
    csv_path = ROOT_DIR / "backend" / "storage" / "uploads" / "10395898_DUMMY_UNI_DATASET.csv"
    uploaded = client.post("/api/datasets/upload", files={"file": ("DUMMY_UNI_DATASET.csv", csv_path.read_bytes(), "text/csv")})
    assert uploaded.status_code == 200
    dataset_id = uploaded.json()["dataset_id"]
    target = "total_electricity_consumption_kwh"
    valid = [
        "occupied_residents", "average_temperature_c", "fan_operating_hours_per_day",
        "lighting_operating_hours_per_day", "study_plug_hours_per_resident", "weekend",
        "monsoon_season_flag", "maintenance_activity_flag", "hostel_block",
    ]
    attempts = [
        ("linear_regression", valid + [target], "cannot also be used as a predictor"),
        ("linear_regression", valid + ["grid_import_kwh"], "Excluded energy-accounting fields"),
        ("linear_regression", valid + ["grid_export_kwh"], "Excluded energy-accounting fields"),
        ("decision_tree", valid + ["solar_generation_kwh"], "Excluded energy-accounting fields"),
        ("decision_tree", valid + ["solar_self_consumption_kwh"], "Excluded energy-accounting fields"),
    ]
    for algorithm, predictors, expected_message in attempts:
        response = client.post(
            f"/api/ml/train-single/{dataset_id}/{algorithm}",
            params={"target_column": target, "feature_columns": ",".join(predictors)},
        )
        assert response.status_code == 422
        assert expected_message in response.json()["detail"]

def test_pca_parses_numeric_text_and_excludes_constant_and_identifier_columns():
    frame = pd.DataFrame({
        "record_id": range(40),
        "meter_a": [str(i * 1.25) for i in range(40)],
        "meter_b": [str((i % 7) + 0.5) for i in range(40)],
        "constant": ["1"] * 40,
        "category": ["north", "south"] * 20,
    })
    result = run_pca_decomposition(frame)
    assert result["features_used"] == ["meter_a", "meter_b"]
    assert result["n_components"] == 2
    assert len(result["scatter_points"]) == 40
    assert "constant" in result["feature_exclusions"]

def test_pca_ineligible_columns_explain_why_execution_cannot_proceed():
    frame = pd.DataFrame({"code": ["A", "B", "C"], "constant": [1, 1, 1], "date": ["2025-01-01"] * 3})
    with pytest.raises(ValueError, match="numeric measurements.*eligible.*Excluded"):
        run_pca_decomposition(frame)

def test_general_column_type_inference_distinguishes_measurements_flags_dates_and_ids():
    assert infer_column_type(pd.Series([20, 25, 30, 20] * 10), "capacity_residents") == "discrete_numerical"
    assert infer_column_type(pd.Series([2, 4, 6, 2] * 10), "solar_system_capacity_kwp") == "continuous_numerical"
    assert infer_column_type(pd.Series([0, 1] * 20), "solar_system_downtime_flag") == "binary"
    assert infer_column_type(pd.Series(["2026-01-01", "2026-01-02", "2026-01-03"]), "date") == "datetime"
    assert infer_column_type(pd.Series([1.5, None, 2.25, 3.0] * 8), "temperature_c") == "continuous_numerical"
    assert infer_column_type(pd.Series([f"{10000+i}" for i in range(40)]), "student_id") == "text_identifier"
    assert infer_column_type(pd.Series(["Block A", "Block B"] * 10), "hostel_block") == "categorical"
    assert infer_column_type(pd.Series([7] * 20), "constant_sensor") == "constant"
    assert infer_column_type(pd.Series([None, None]), "empty") == "unknown"

def test_column_type_override_is_persisted_separately_from_inference():
    csv_data = "capacity_residents,energy_kwh,category\n20,10.5,A\n25,12.0,B\n30,13.5,A\n20,14.0,B\n"
    response = client.post("/api/datasets/upload", files={"file": ("type_override.csv", csv_data.encode(), "text/csv")})
    assert response.status_code == 200
    profile = response.json()
    capacity = next(c for c in profile["columns"] if c["name"] == "capacity_residents")
    assert capacity["inferred_type"] == "discrete_numerical"
    dataset_id = profile["dataset_id"]
    config = client.post(f"/api/datasets/{dataset_id}/configure", json={
        "target_column": "energy_kwh",
        "column_configs": [{"name": "capacity_residents", "selected_type": "categorical", "is_feature": True, "is_excluded": False}]
    })
    assert config.status_code == 200
    reloaded = client.get(f"/api/datasets/{dataset_id}/profile").json()
    capacity = next(c for c in reloaded["columns"] if c["name"] == "capacity_residents")
    assert capacity["inferred_type"] == "discrete_numerical"
    assert capacity["selected_type"] == "categorical"
    assert capacity["effective_type"] == "categorical"

def test_profiled_upload_runs_all_four_models_with_type_appropriate_inputs():
    rows = ["date,hostel_block,capacity_residents,occupancy_rate_pct,average_temperature_c,solar_generation_kwh,grid_import_kwh,total_electricity_consumption_kwh,solar_system_downtime_flag"]
    for i in range(160):
        capacity = [20, 25, 30, 35][i % 4]
        occupancy = 45 + ((i * 13) % 50)
        temperature = 18 + ((i * 7) % 19) * 0.4
        solar = 4 + ((i * 11) % 37) * 0.3
        grid = 15 + ((i * 17) % 61) * 0.45
        total = grid + solar * 0.35 + ((i * 5) % 9) * 0.15
        block = ["North", "South", "East", "West"][i % 4]
        rows.append(f"2025-01-{(i % 28) + 1:02d},{block},{capacity},{occupancy},{temperature:.1f},{solar:.1f},{grid:.2f},{total:.2f},{i % 2}")
    uploaded = client.post("/api/datasets/upload", files={"file": ("typed_pipeline.csv", "\n".join(rows).encode(), "text/csv")})
    assert uploaded.status_code == 200
    profile = uploaded.json()
    inferred = {col["name"]: col["inferred_type"] for col in profile["columns"]}
    assert inferred["date"] == "datetime"
    assert inferred["hostel_block"] == "categorical"
    assert inferred["capacity_residents"] == "discrete_numerical"
    assert inferred["solar_system_downtime_flag"] == "binary"
    dataset_id = profile["dataset_id"]
    configured = client.post(f"/api/datasets/{dataset_id}/configure", json={
        "target_column": "total_electricity_consumption_kwh",
        "column_configs": [{"name": "hostel_block", "selected_type": "categorical", "is_feature": True, "is_excluded": False}]
    })
    assert configured.status_code == 200
    readiness = client.post(f"/api/datasets/{dataset_id}/readiness")
    assert readiness.status_code == 200
    analysis_res = client.post(f"/api/datasets/{dataset_id}/analyse")
    assert analysis_res.status_code == 200
    analysis = analysis_res.json()
    assert analysis["linear_regression"] is not None
    assert analysis["decision_tree"] is not None
    assert analysis["kmeans"] is not None
    assert analysis["pca"] is not None
    assert len(analysis["pca"]["features_used"]) >= 2
    assert any(coef["feature"].startswith("hostel_block_") for coef in analysis["linear_regression"]["coefficients"])
    assert any(item["feature"].startswith("hostel_block_") for item in analysis["decision_tree"]["feature_importances"])
    assert all(not name.startswith("hostel_block_") for name in analysis["pca"]["features_used"])
