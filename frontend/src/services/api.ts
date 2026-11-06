export interface ColumnProfile {
  name: string;
  original_dtype: string;
  inferred_type: string;
  selected_type?: string | null;
  effective_type?: string;
  custom_meaning?: string;
  unit?: string;
  is_target: boolean;
  is_feature: boolean;
  is_excluded: boolean;
  exclusion_reason?: string;
  missing_count: number;
  missing_percentage: number;
  unique_count: number;
  sample_values: any[];
  min_val?: number | null;
  max_val?: number | null;
  mean_val?: number | null;
  std_val?: number | null;
}

export const COLUMN_TYPES = [
  'datetime', 'continuous_numerical', 'discrete_numerical', 'binary',
  'categorical', 'text_identifier', 'unknown', 'constant',
] as const;
export const NUMERIC_COLUMN_TYPES = ['continuous_numerical', 'discrete_numerical', 'binary'];
export const FEATURE_COLUMN_TYPES = [...NUMERIC_COLUMN_TYPES, 'categorical'];
export const effectiveColumnType = (column: ColumnProfile) => column.selected_type || column.effective_type || column.inferred_type;

export interface DataQualityIndicator {
  category: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  score: number;
  details: string;
}

export interface DatasetProfile {
  dataset_id: number;
  original_name: string;
  row_count: number;
  col_count: number;
  delimiter: string;
  preview_rows: Record<string, any>[];
  columns: ColumnProfile[];
  data_quality_score: number;
  data_quality_indicators: DataQualityIndicator[];
  potential_targets: string[];
  high_correlation_pairs: { col1: string; col2: string; correlation: number }[];
}

export interface SingleModelReadiness {
  model_name: string;
  display_name: string;
  status: 'READY' | 'CONDITIONAL' | 'INSUFFICIENT' | 'COMPLETED';
  is_runnable: boolean;
  summary: string;
  requirements_met: string[];
  missing_prerequisites: string[];
  data_collection_suggestions: string[];
  risk_factors: string[];
}

export interface ReadinessResponse {
  dataset_id: number;
  target_column: string | null;
  models: {
    linear_regression: SingleModelReadiness;
    decision_tree: SingleModelReadiness;
    kmeans: SingleModelReadiness;
    pca: SingleModelReadiness;
  };
  overall_readiness_score: number;
  recommended_models: string[];
}

export interface AnalysisSummary {
  id: number;
  dataset_id: number;
  dataset_name: string;
  run_name: string;
  target_column: string;
  created_at: string;
  status: string;
  data_quality_score: number;
  model_count: number;
}

export interface AnalysisDetail {
  analysis_id: number;
  dataset_id: number;
  dataset_name: string;
  run_name: string;
  target_column: string;
  created_at: string;
  status: string;
  data_quality_score: number;
  linear_regression?: any;
  decision_tree?: any;
  kmeans?: any;
  pca?: any;
  skipped_models?: Record<string, string>;
}

export interface DatasetAssessment {
  source_type: string;
  coverage_period: { column: string; start: string; end: string } | null;
  target_summary: { type: string; count: number; missing_count: number; minimum?: number; median?: number; maximum?: number; mean?: number; standard_deviation?: number; observed_categories?: { label: string; count: number }[] } | null;
  data_quality_score: number;
  data_quality_indicators: DataQualityIndicator[];
  feature_columns: string[];
  scope_note: string;
}

export interface EducationalDatasetItem {
  id: string;
  name: string;
  file: string;
  context: string;
  rows: number;
  cols: number;
  target_column: string | null;
  learning_objective: string;
}

export type EducationalCatalog = Record<string, EducationalDatasetItem[]>;

export interface SingleAlgorithmTrainResponse {
  dataset_id: number;
  run_id?: number;
  dataset_version?: string;
  algorithm: string;
  target_column: string | null;
  result: any;
  ai_companion: AiCompanionResult | null;
}

export interface AiCompanionResult {
  executive_summary: string;
  major_discoveries: { topic: string; finding: string; evidence_source: string; impact: string }[];
  practical_recommendations: { action: string; expected_savings?: string; evidence_basis: string }[];
  confidence_and_evidence: string;
  limitations: string;
  is_ai_generated: boolean;
  model_used: string;
}

export interface AiInsights {
  analysis_id: number;
  executive_summary: string;
  major_discoveries: { topic: string; finding: string; evidence_source: string; impact: string; evidence_level?: string; plain_language_explanation?: string; operational_implication?: string; recommended_verification?: string; confidence?: string; limitation?: string }[];
  direct_observations?: Record<string, unknown>[];
  cross_model_insights: string;
  potential_inefficiencies: { anomaly_type: string; description: string; affected_nodes: string; estimated_severity: string }[];
  practical_recommendations: { action: string; expected_savings?: string; implementation_complexity: string; evidence_basis: string; priority?: string; reason?: string; expected_benefit?: string; verify_before?: string; action_category?: string; responsible_role?: string }[];
  data_collection_recommendations: { missing_parameter: string; analytical_impact: string; recommended_sensor_or_log: string }[];
  confidence_and_evidence: string;
  limitations: string;
  is_ai_generated: boolean;
  model_used: string;
  validated_against_results?: boolean;
  interpretation_status?: 'gemini_active' | 'local_fallback' | 'unavailable';
}

const API_BASE = '/api';
const DUMMY_ENERGY_TARGET = 'total_electricity_consumption_kwh';
const DUMMY_ENERGY_PREDICTORS = [
  'occupied_residents', 'average_temperature_c', 'fan_operating_hours_per_day',
  'lighting_operating_hours_per_day', 'study_plug_hours_per_resident', 'weekend',
  'monsoon_season_flag', 'maintenance_activity_flag', 'hostel_block',
];

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async uploadDataset(file: File, description = ''): Promise<DatasetProfile> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    const res = await fetch(`${API_BASE}/datasets/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  async loadSample(sampleType: 'gujarat' | 'himalayan' | 'campus_original'): Promise<DatasetProfile> {
    const res = await fetch(`${API_BASE}/datasets/load-sample/${sampleType}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to load sample' }));
      throw new Error(err.detail || 'Failed to load sample');
    }
    return res.json();
  },

  async getDatasets() {
    const res = await fetch(`${API_BASE}/datasets`);
    return res.json();
  },

  async getDatasetProfile(datasetId: number): Promise<DatasetProfile> {
    const res = await fetch(`${API_BASE}/datasets/${datasetId}/profile`);
    return res.json();
  },

  async configureDataset(datasetId: number, targetColumn: string | null, columnConfigs: any[]) {
    const res = await fetch(`${API_BASE}/datasets/${datasetId}/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_column: targetColumn, column_configs: columnConfigs }),
    });
    const response = await res.json();
    if (res.ok) {
      for (const algorithm of ['linear_regression', 'decision_tree']) {
        this.invalidateWorkspaceExperimentIfTargetChanged(datasetId, algorithm, targetColumn || '');
      }
    }
    return response;
  },

  async checkReadiness(datasetId: number): Promise<ReadinessResponse> {
    const res = await fetch(`${API_BASE}/datasets/${datasetId}/readiness`, {
      method: 'POST',
    });
    return res.json();
  },

  async runAnalysis(datasetId: number, runName?: string) {
    const formData = new FormData();
    if (runName) formData.append('run_name', runName);
    const res = await fetch(`${API_BASE}/datasets/${datasetId}/analyse`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Analysis failed' }));
      throw new Error(err.detail || 'Analysis execution failed');
    }
    return res.json();
  },

  async getAnalyses(): Promise<AnalysisSummary[]> {
    const res = await fetch(`${API_BASE}/analyses`);
    return res.json();
  },

  async getAnalysisDetail(analysisId: number): Promise<AnalysisDetail> {
    const res = await fetch(`${API_BASE}/analyses/${analysisId}`);
    return res.json();
  },

  async getInsights(analysisId: number): Promise<AiInsights> {
    const res = await fetch(`${API_BASE}/analyses/${analysisId}/insights`);
    return res.json();
  },

  getWorkspaceExperiments(datasetId: number): Record<string, SingleAlgorithmTrainResponse> {
    try { return JSON.parse(localStorage.getItem(`hostel-workspace-experiments-${datasetId}`) || '{}'); }
    catch { return {}; }
  },

  getWorkspaceAttemptStatuses(datasetId: number): Record<string, 'running' | 'incomplete' | 'completed'> {
    try { return JSON.parse(localStorage.getItem(`hostel-workspace-attempts-${datasetId}`) || '{}'); }
    catch { return {}; }
  },

  setWorkspaceAttemptStatus(datasetId: number, algorithm: string, status: 'running' | 'incomplete' | 'completed') {
    try {
      const statuses = this.getWorkspaceAttemptStatuses(datasetId);
      statuses[algorithm] = status;
      localStorage.setItem(`hostel-workspace-attempts-${datasetId}`, JSON.stringify(statuses));
    } catch { /* The workspace can still run when browser storage is unavailable. */ }
  },

  invalidateWorkspaceExperimentIfTargetChanged(datasetId: number, algorithm: string, targetColumn: string) {
    try {
      const experiments = this.getWorkspaceExperiments(datasetId);
      const previous = experiments[algorithm];
      if (previous && previous.target_column !== targetColumn) {
        delete experiments[algorithm];
        localStorage.setItem(`hostel-workspace-experiments-${datasetId}`, JSON.stringify(experiments));
        this.setWorkspaceAttemptStatus(datasetId, algorithm, 'incomplete');
        return true;
      }
    } catch { /* The caller still clears its in-memory result. */ }
    return false;
  },

  async consolidateWorkspaceExperiments(datasetId: number) {
    const experiments = this.getWorkspaceExperiments(datasetId);
    const res = await fetch(`${API_BASE}/datasets/${datasetId}/consolidate-workspaces`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experiments, attempt_statuses: this.getWorkspaceAttemptStatuses(datasetId) }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Workspace results could not be consolidated.' }));
      throw new Error(err.detail || 'Workspace results could not be consolidated.');
    }
    return res.json();
  },

  async getEducationalCatalog(): Promise<EducationalCatalog> {
    const res = await fetch(`${API_BASE}/educational/catalog`);
    if (!res.ok) throw new Error('Failed to load educational catalog');
    return res.json();
  },

  async loadEducationalDataset(method: string, datasetId: string): Promise<DatasetProfile> {
    const res = await fetch(`${API_BASE}/educational/load/${method}/${datasetId}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Load failed' }));
      throw new Error(err.detail || 'Failed to load educational dataset');
    }
    return res.json();
  },

  async trainSingleAlgorithm(
    datasetId: number,
    algorithm: string,
    targetColumn?: string,
    featureColumn?: string,
    featureColumns?: string[],
    nClusters?: number,
  ): Promise<SingleAlgorithmTrainResponse> {
    if ((algorithm === 'linear_regression' || algorithm === 'decision_tree') && !targetColumn) {
      throw new Error(`${algorithm === 'linear_regression' ? 'Linear Regression' : 'Decision Tree'} requires an explicitly selected target column.`);
    }
    this.setWorkspaceAttemptStatus(datasetId, algorithm, 'running');
    const query = new URLSearchParams();
    if (targetColumn) query.set('target_column', targetColumn);
    const useApprovedEnergyInputs = targetColumn === DUMMY_ENERGY_TARGET &&
      (algorithm === 'linear_regression' || algorithm === 'decision_tree') && featureColumns === undefined;
    if (useApprovedEnergyInputs) query.set('feature_columns', DUMMY_ENERGY_PREDICTORS.join(','));
    else {
      if (featureColumn) query.set('feature_column', featureColumn);
      if (featureColumns?.length) query.set('feature_columns', featureColumns.join(','));
    }
    if (nClusters !== undefined) query.set('n_clusters', String(nClusters));
    const params = query.size ? `?${query.toString()}` : '';
    try {
      const res = await fetch(`${API_BASE}/ml/train-single/${datasetId}/${algorithm}${params}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Training failed' }));
        throw new Error(err.detail || 'Algorithm execution failed');
      }
      const response: SingleAlgorithmTrainResponse = await res.json();
      const saved = this.getWorkspaceExperiments(datasetId);
      saved[algorithm] = response;
      localStorage.setItem(`hostel-workspace-experiments-${datasetId}`, JSON.stringify(saved));
      this.setWorkspaceAttemptStatus(datasetId, algorithm, 'completed');
      return response;
    } catch (err) {
      this.setWorkspaceAttemptStatus(datasetId, algorithm, 'incomplete');
      throw err;
    }
  },
};
