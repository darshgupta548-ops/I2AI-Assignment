from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

# --- Column Schemas ---
class ColumnProfile(BaseModel):
    name: str
    original_dtype: str
    inferred_type: str # profiler's value-based classification
    selected_type: Optional[str] = None
    effective_type: Optional[str] = None
    custom_meaning: Optional[str] = ""
    unit: Optional[str] = ""
    is_target: bool = False
    is_feature: bool = True
    is_excluded: bool = False
    exclusion_reason: Optional[str] = ""
    missing_count: int = 0
    missing_percentage: float = 0.0
    unique_count: int = 0
    sample_values: List[Any] = []
    min_val: Optional[float] = None
    max_val: Optional[float] = None
    mean_val: Optional[float] = None
    std_val: Optional[float] = None

class ColumnConfigUpdate(BaseModel):
    name: str
    selected_type: Optional[str] = None
    custom_meaning: Optional[str] = None
    unit: Optional[str] = None
    is_target: Optional[bool] = None
    is_feature: Optional[bool] = None
    is_excluded: Optional[bool] = None
    exclusion_reason: Optional[str] = None

class DatasetConfigPayload(BaseModel):
    target_column: Optional[str] = None
    column_configs: List[ColumnConfigUpdate] = []

# --- Dataset Schemas ---
class DatasetSummary(BaseModel):
    id: int
    filename: str
    original_name: str
    file_size_bytes: int
    row_count: int
    col_count: int
    delimiter: str
    description: str
    is_sample: bool
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DataQualityIndicator(BaseModel):
    category: str # missing_values, duplicate_rows, constant_columns, high_cardinality, sample_size
    status: str # PASS, WARNING, FAIL
    score: float # 0 to 100
    details: str

class DatasetProfileResponse(BaseModel):
    dataset_id: int
    original_name: str
    row_count: int
    col_count: int
    delimiter: str
    preview_rows: List[Dict[str, Any]]
    columns: List[ColumnProfile]
    data_quality_score: float
    data_quality_indicators: List[DataQualityIndicator]
    potential_targets: List[str]
    high_correlation_pairs: List[Dict[str, Any]] = []

# --- Model Readiness Schemas ---
class SingleModelReadiness(BaseModel):
    model_name: str # linear_regression, decision_tree, kmeans, pca
    display_name: str
    status: str # READY, CONDITIONAL, INSUFFICIENT, COMPLETED
    is_runnable: bool
    summary: str
    requirements_met: List[str]
    missing_prerequisites: List[str]
    data_collection_suggestions: List[str]
    risk_factors: List[str] = []

class ReadinessAssessmentResponse(BaseModel):
    dataset_id: int
    target_column: Optional[str]
    models: Dict[str, SingleModelReadiness]
    overall_readiness_score: float
    recommended_models: List[str]

# --- ML Execution Schemas ---
class LinearRegressionResult(BaseModel):
    status: str
    r2_score: float
    rmse: float
    mae: float
    target_variable: str
    train_size: int
    test_size: int
    coefficients: List[Dict[str, Any]]
    intercept: float
    actual_vs_predicted: List[Dict[str, float]] # sample points for visualization
    residuals_distribution: List[Dict[str, float]]
    notes: List[str] = []
    provenance: Dict[str, Any] = {}

class DecisionTreeResult(BaseModel):
    status: str
    task_type: str # regression or classification
    target_variable: str
    metrics: Dict[str, float] # r2, rmse, mae for reg OR accuracy, precision, recall, f1 for clf
    feature_importances: List[Dict[str, Any]]
    tree_rules: List[str]
    actual_vs_predicted: List[Dict[str, Any]]
    classification_threshold_info: Optional[Dict[str, Any]] = None
    notes: List[str] = []
    provenance: Dict[str, Any] = {}

class KMeansResult(BaseModel):
    status: str
    optimal_k: int
    silhouette_score: float
    features_used: List[str]
    elbow_curve: List[Dict[str, float]]
    cluster_profiles: List[Dict[str, Any]] # centroid values, size, percentage, objective description
    cluster_scatter_points: List[Dict[str, Any]] # 2D projected cluster coordinates
    notes: List[str] = []
    provenance: Dict[str, Any] = {}

class PCAResult(BaseModel):
    status: str
    n_components: int
    features_used: List[str] = []
    feature_exclusions: Dict[str, str] = {}
    explained_variance_ratio: List[float]
    cumulative_explained_variance: List[float]
    loadings: List[Dict[str, Any]] # feature loadings per PC
    scatter_points: List[Dict[str, Any]] # PC1 vs PC2 coordinates
    projection_unavailable_reason: Optional[str] = None
    notes: List[str] = []
    provenance: Dict[str, Any] = {}

class FullAnalysisRunResponse(BaseModel):
    analysis_id: int
    run_id: Optional[int] = None
    dataset_id: int
    dataset_version: Optional[str] = None
    model_provenance: Dict[str, Any] = {}
    run_name: str
    created_at: datetime
    status: str
    target_column: Optional[str]
    linear_regression: Optional[LinearRegressionResult] = None
    decision_tree: Optional[DecisionTreeResult] = None
    kmeans: Optional[KMeansResult] = None
    pca: Optional[PCAResult] = None
    skipped_models: Dict[str, str] = {}
    dataset_assessment: Dict[str, Any] = {}

# --- Gemini Structured Insights Schemas ---
class EvidenceDiscovery(BaseModel):
    topic: str
    finding: str
    evidence_source: str # e.g. "Linear Regression R²=0.84 & Coefficient of ac_hours=12.4"
    impact: str # HIGH, MEDIUM, LOW
    confidence: Optional[str] = None
    limitation: Optional[str] = None
    evidence_level: Optional[str] = None
    plain_language_explanation: Optional[str] = None
    operational_implication: Optional[str] = None
    recommended_verification: Optional[str] = None

class InefficiencyItem(BaseModel):
    anomaly_type: str
    description: str
    affected_nodes: str
    estimated_severity: str

class RecommendationItem(BaseModel):
    action: str
    expected_savings: Optional[str] = None
    implementation_complexity: str # LOW, MEDIUM, HIGH
    evidence_basis: str
    priority: Optional[str] = None
    reason: Optional[str] = None
    expected_benefit: Optional[str] = None
    verify_before: Optional[str] = None
    action_category: Optional[str] = None
    responsible_role: Optional[str] = None

class DataCollectionAdvice(BaseModel):
    missing_parameter: str # e.g. "Occupancy Rate / Footfall"
    analytical_impact: str # What analysis is currently blocked
    recommended_sensor_or_log: str

class AiInsightResponse(BaseModel):
    analysis_id: int
    executive_summary: str
    major_discoveries: List[EvidenceDiscovery]
    direct_observations: List[Dict[str, Any]] = []
    cross_model_insights: str
    potential_inefficiencies: List[InefficiencyItem]
    practical_recommendations: List[RecommendationItem]
    data_collection_recommendations: List[DataCollectionAdvice]
    confidence_and_evidence: str
    limitations: str
    is_ai_generated: bool
    model_used: str
    validated_against_results: bool = False
    interpretation_status: str = "local_fallback"
